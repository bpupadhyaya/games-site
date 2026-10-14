// Thanjavur Dancing Doll: 3D models (game-owned). The clay doll is a sculpted toy: a heavy round clay base, a bell-shaped painted
// body turned on a lathe, arms folded in front, a nodding head with painted face and sculpted headgear. The set is the toy-maker's
// room: plaster wall, painted dado, arched window with a shaft of light and drifting dust, paper bunting, a hanging brass lamp and
// the teak shelf the dolls rock on. Local doll units: 1 = base radius R, +y up, origin = centre of the base circle.
import * as THREE from '../vendor3d/three.js';
import { CHARS, VARIANT_SHIFT } from '../src/doll.js';
import { PAL, hueShift, mixHex } from '../src/art.js';

const TAU = Math.PI * 2;
const hash = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

// "hsl(h s% l%)" (from hueShift) and "rgb(r,g,b)" / "#rrggbb" -> THREE.Color
export function col(str) {
  const m = /^hsl\((\d+)\s+(\d+)%\s+(\d+)%\)$/.exec(str);
  if (m) return new THREE.Color().setHSL(Number(m[1]) / 360, Number(m[2]) / 100, Number(m[3]) / 100);
  return new THREE.Color(str);
}
export function canvasTex(w, h, draw, o = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = o.linear ? THREE.NoColorSpace : THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (o.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(o.repeat[0], o.repeat[1]); }
  return t;
}
const texCache = new Map();
const cached = (key, make) => { let t = texCache.get(key); if (!t) { t = make(); texCache.set(key, t); } return t; };
export function disposeCaches() { for (const t of texCache.values()) t.dispose?.(); texCache.clear(); }

// ---- textures -----------------------------------------------------------------------------------------------------------------
function clayNoise(g, w, h, a = 0.1) {
  for (let i = 0; i < w * h * 0.012; i++) { const x = hash(i * 3.1) * w, y = hash(i * 7.7) * h, r = 0.6 + hash(i) * 1.6; g.fillStyle = `rgba(${hash(i + 9) > 0.5 ? '255,235,200' : '60,25,10'},${a * hash(i + 4)})`; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); }
}
// The painted bell body wrapped around the lathe: v = 0 is the hem (y 0), v = 1 the shoulders (y 2.42). u wraps once.
function bodyTexture(ch, variant, paint) {
  const key = `body|${ch}|${variant}|${paint}`;
  return cached(key, () => canvasTex(1024, 512, (g, w, h) => {
    const c = CHARS[ch], vs = VARIANT_SHIFT[variant] ?? 0, painted = paint >= 1;
    const gcol = painted ? hueShift(c.g, vs) : mixHex('#d49a72', c.g, 0.32);
    g.fillStyle = painted ? gcol : mixHex('#e0a982', c.g, 0.25); g.fillRect(0, 0, w, h);
    const Y = (y) => h * (1 - y / 2.42);    // doll height -> canvas row
    if (painted) {
      const lg = g.createLinearGradient(0, 0, w, 0);
      for (let i = 0; i <= 8; i++) lg.addColorStop(i / 8, i % 2 ? 'rgba(255,255,255,0.0)' : 'rgba(0,0,0,0.07)');
      g.fillStyle = lg; g.fillRect(0, 0, w, h);
      // hem band + dots
      g.fillStyle = c.sash; g.fillRect(0, Y(0.42), w, Y(0) - Y(0.42));
      g.fillStyle = PAL.cream; for (let i = 0; i < 22; i++) { g.beginPath(); g.arc((i + 0.5) * w / 22, Y(0.21), h * 0.017, 0, TAU); g.fill(); }
      // belt
      g.fillStyle = c.sash; g.fillRect(0, Y(1.62), w, Y(1.38) - Y(1.62));
      g.fillStyle = c.trim; for (let i = 0; i < 22; i++) { g.beginPath(); g.arc((i + 0.5) * w / 22, Y(1.5), h * 0.009, 0, TAU); g.fill(); }
      // pleats
      g.strokeStyle = 'rgba(0,0,0,0.16)'; g.lineWidth = 2;
      for (let i = 0; i < 16; i++) { const x = (i + 0.5) * w / 16; g.beginPath(); g.moveTo(x, Y(0.46)); g.lineTo(x, Y(1.36)); g.stroke(); }
      if (paint >= 3) {
        g.fillStyle = PAL.goldHi;
        for (let i = 0; i < 12; i++) { g.save(); g.translate((i + 0.5) * w / 12, Y(0.95)); g.rotate(Math.PI / 4); g.fillRect(-8, -8, 16, 16); g.restore(); }
        g.strokeStyle = PAL.goldHi; g.lineWidth = 6; g.beginPath(); g.moveTo(0, Y(2.0)); g.lineTo(w, Y(2.0)); g.stroke();
        g.lineWidth = 3; g.beginPath(); g.moveTo(0, Y(1.74)); g.lineTo(w, Y(1.74)); g.stroke();
      }
    } else {
      g.strokeStyle = 'rgba(80,36,14,0.28)'; g.lineWidth = 3;
      for (let i = 0; i < 5; i++) { const y = Y(0.4 + i * 0.5); g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    }
    clayNoise(g, w, h, painted ? 0.07 : 0.14);
  }));
}
// Hemisphere base (v: 0.5 at the equator down to 0 at the bottom pole).
function baseTexture(ch, paint) {
  const key = `base|${ch}|${paint >= 1}`;
  return cached(key, () => canvasTex(512, 256, (g, w, h) => {
    const painted = paint >= 1, c = CHARS[ch];
    g.fillStyle = painted ? '#c76a3c' : '#d98c5f'; g.fillRect(0, 0, w, h);
    if (painted) {
      const y = h * (1 - 0.36);
      g.fillStyle = c.sash; g.fillRect(0, y - h * 0.05, w, h * 0.1);
      g.fillStyle = PAL.cream; for (let i = 0; i < 20; i++) { g.beginPath(); g.arc((i + 0.5) * w / 20, y + h * 0.1, h * 0.022, 0, TAU); g.fill(); }
      g.fillStyle = 'rgba(255,214,120,0.9)'; for (let i = 0; i < 20; i++) { g.beginPath(); g.arc((i + 0.5) * w / 20, y - h * 0.1, h * 0.014, 0, TAU); g.fill(); }
    }
    clayNoise(g, w, h, 0.16);
  }));
}
// Equirectangular head: the face sits at u = 0.25 (the +z pole of a THREE sphere); same scale as the 2D painter.
function headTexture(ch, paint) {
  const key = `head|${ch}|${paint}`;
  return cached(key, () => canvasTex(1024, 512, (g, w, h) => {
    const c = CHARS[ch], painted = paint >= 1;
    const skin = painted && paint >= 2 ? c.skin : painted ? '#d9a577' : '#d49a72';
    g.fillStyle = skin; g.fillRect(0, 0, w, h);
    if (paint >= 2) {
      const HY = -2.95;   // the 2D face code is written around HEAD.y
      g.save(); g.translate(w * 0.25, h / 2 - HY * 263); g.scale(263, 263);
      const ey = HY - 0.02;
      g.fillStyle = 'rgba(224,80,70,0.38)'; for (const s of [-1, 1]) { g.beginPath(); g.arc(s * 0.34, HY + 0.17, 0.12, 0, TAU); g.fill(); }
      g.fillStyle = '#ffffff'; for (const s of [-1, 1]) { g.beginPath(); g.ellipse(s * 0.22, ey, 0.115, 0.095, 0, 0, TAU); g.fill(); }
      g.fillStyle = '#1b0e0c'; for (const s of [-1, 1]) { g.beginPath(); g.arc(s * 0.22, ey + 0.01, 0.065, 0, TAU); g.fill(); }
      g.fillStyle = '#fff'; for (const s of [-1, 1]) { g.beginPath(); g.arc(s * 0.22 + 0.025, ey - 0.02, 0.022, 0, TAU); g.fill(); }
      g.lineCap = 'round'; g.strokeStyle = '#1b0e0c'; g.lineWidth = 0.045;
      for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 0.1, ey - 0.17); g.quadraticCurveTo(s * 0.24, ey - 0.27, s * 0.38, ey - 0.15); g.stroke(); }
      g.strokeStyle = 'rgba(58,22,32,0.55)'; g.lineWidth = 0.04; g.beginPath(); g.moveTo(0, ey + 0.05); g.quadraticCurveTo(0.05, ey + 0.17, -0.03, ey + 0.2); g.stroke();
      g.strokeStyle = '#b8201c'; g.lineWidth = 0.065; g.beginPath(); g.moveTo(-0.17, HY + 0.3); g.quadraticCurveTo(0, HY + 0.42, 0.17, HY + 0.3); g.stroke();
      if (paint >= 3) { g.fillStyle = '#c0392b'; g.beginPath(); g.arc(0, ey - 0.2, 0.05, 0, TAU); g.fill(); }
      g.restore();
    } else {
      g.save(); g.translate(w * 0.25, h / 2 + 2.95 * 263); g.scale(263, 263);
      g.strokeStyle = 'rgba(80,36,14,0.4)'; g.lineWidth = 0.04; g.beginPath(); g.moveTo(-0.3, -2.95); g.lineTo(-0.12, -2.95); g.moveTo(0.12, -2.95); g.lineTo(0.3, -2.95); g.stroke(); g.restore();
    }
    clayNoise(g, w, h, 0.05);
  }));
}
export function woodTexture(light = '#b8703a', dark = '#6a3416') {
  return cached(`wood|${light}|${dark}`, () => canvasTex(1024, 256, (g, w, h) => {
    const lg = g.createLinearGradient(0, 0, 0, h); lg.addColorStop(0, light); lg.addColorStop(1, dark); g.fillStyle = lg; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) {
      const y = hash(i * 1.7) * h, a = 0.05 + hash(i * 3.3) * 0.16;
      g.strokeStyle = hash(i) > 0.45 ? `rgba(40,16,6,${a})` : `rgba(255,220,170,${a * 0.7})`; g.lineWidth = 0.6 + hash(i * 5.1) * 2.2;
      g.beginPath(); g.moveTo(0, y);
      for (let x = 0; x <= w; x += 64) g.lineTo(x, y + Math.sin(x * 0.012 + i) * 3 + Math.sin(x * 0.037 + i * 2) * 1.5);
      g.stroke();
    }
    for (let k = 0; k < 3; k++) { const x = hash(k * 9.3) * w, y = hash(k * 4.1) * h; for (let r = 4; r < 20; r += 4) { g.strokeStyle = 'rgba(40,16,6,0.14)'; g.lineWidth = 1.4; g.beginPath(); g.ellipse(x, y, r * 2.6, r, 0, 0, TAU); g.stroke(); } }
  }, { repeat: [1, 1] }));
}
function plasterTexture() {
  return cached('plaster', () => canvasTex(512, 512, (g, w, h) => {
    g.fillStyle = '#f3dfb4'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2600; i++) {
      const x = hash(i * 2.3) * w, y = hash(i * 5.9) * h, r = 2 + hash(i * 1.3) * 22;
      g.fillStyle = hash(i + 3) > 0.5 ? `rgba(255,250,236,${0.04 + hash(i) * 0.06})` : `rgba(190,140,80,${0.015 + hash(i) * 0.03})`;
      g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    }
  }, { repeat: [3, 3] }));
}
function zigzagTexture() {
  return cached('zig', () => canvasTex(256, 64, (g, w, h) => {
    g.fillStyle = PAL.dado; g.fillRect(0, 0, w, h);
    g.fillStyle = '#fff7e4';
    for (let x = 0; x < w; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 16, h * 0.55); g.lineTo(x + 32, 0); g.closePath(); g.fill(); }
    g.fillStyle = '#a8431f'; for (let x = 0; x < w; x += 32) { g.beginPath(); g.arc(x + 16, h * 0.78, 4, 0, TAU); g.fill(); }
    g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(0, 0, w, 3);
  }, { repeat: [1, 1] }));
}
export function blobTexture() {
  return cached('blob', () => canvasTex(128, 128, (g, w, h) => {
    const r = g.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
    r.addColorStop(0, 'rgba(20,6,2,0.7)'); r.addColorStop(0.5, 'rgba(20,6,2,0.32)'); r.addColorStop(1, 'rgba(20,6,2,0)'); g.fillStyle = r; g.fillRect(0, 0, w, h);
  }));
}
export function glowTexture(rgb = '255,214,120') {
  return cached('glow' + rgb, () => canvasTex(128, 128, (g, w, h) => {
    const r = g.createRadialGradient(w / 2, h / 2, 1, w / 2, h / 2, w / 2);
    r.addColorStop(0, `rgba(${rgb},0.95)`); r.addColorStop(0.35, `rgba(${rgb},0.38)`); r.addColorStop(1, `rgba(${rgb},0)`); g.fillStyle = r; g.fillRect(0, 0, w, h);
  }));
}
function shaftTexture() {
  return cached('shaft', () => canvasTex(64, 256, (g, w, h) => {
    const v = g.createLinearGradient(0, 0, 0, h); v.addColorStop(0, 'rgba(255,240,180,0.55)'); v.addColorStop(1, 'rgba(255,240,180,0)');
    g.fillStyle = v; g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'destination-in';
    const hz = g.createLinearGradient(0, 0, w, 0); hz.addColorStop(0, 'rgba(0,0,0,0)'); hz.addColorStop(0.5, 'rgba(0,0,0,1)'); hz.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = hz; g.fillRect(0, 0, w, h);
  }));
}
function skyTexture() {
  return cached('sky', () => canvasTex(128, 256, (g, w, h) => {
    const s = g.createLinearGradient(0, 0, 0, h); s.addColorStop(0, '#9fdcf0'); s.addColorStop(0.7, '#fff3c4'); s.addColorStop(1, '#ffe39a'); g.fillStyle = s; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.8)'; for (let i = 0; i < 3; i++) { g.beginPath(); g.ellipse(30 + i * 40, 60 + i * 28, 30, 9, 0, 0, TAU); g.fill(); }
    g.fillStyle = 'rgba(70,120,60,0.55)'; for (let i = 0; i < 6; i++) { g.beginPath(); g.ellipse(10 + i * 22, h - 6, 18, 26 + hash(i) * 14, 0, 0, TAU); g.fill(); }
  }));
}

// ---- geometry helpers -----------------------------------------------------------------------------------------------------------
// Bell profile from the 2D painter's bezier, as lathe points (x = radius, y = height) in base-radius units.
function bodyProfile() {
  const pts = [];
  const bez = (p0, p1, p2, p3, t) => { const u = 1 - t; return [u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0], u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]]; };
  for (let i = 0; i <= 18; i++) { const p = bez([1.0, 0], [1.06, 0.9], [0.78, 1.5], [0.6, 2.05], i / 18); pts.push(new THREE.Vector2(p[0], p[1])); }
  for (let i = 1; i <= 6; i++) { const t = i / 6, u = 1 - t, x = u * u * 0.6 + 2 * u * t * 0.5 + t * t * 0.2, y = u * u * 2.05 + 2 * u * t * 2.36 + t * t * 2.42; pts.push(new THREE.Vector2(x, y)); }
  pts.push(new THREE.Vector2(0.001, 2.42));
  return pts;
}
const PROFILE = bodyProfile();

function std(color, o = {}) { return new THREE.MeshStandardMaterial({ color: col(color), roughness: 0.6, metalness: 0, ...o }); }
function phys(color, o = {}) { return new THREE.MeshPhysicalMaterial({ color: col(color), roughness: 0.5, clearcoat: 0.6, clearcoatRoughness: 0.35, ...o }); }
function mesh(geo, mat, x = 0, y = 0, z = 0) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; return m; }
function ring(r, tube, y, rotX = Math.PI / 2) { const g = new THREE.TorusGeometry(r, tube, 12, 36); const m = new THREE.Mesh(g); m.rotation.x = rotX; m.position.y = y; return m; }
function lathe(pts, seg = 36) { return new THREE.LatheGeometry(pts.map((p) => new THREE.Vector2(p[0], p[1])), seg); }

// ---- the doll ---------------------------------------------------------------------------------------------------------------------
// returns a Group; userData: { base, torso, head, body (materials for tap flash), plume }
export function makeDoll(chIdx, variant = 0, paint = 3) {
  const c = CHARS[chIdx], vs = VARIANT_SHIFT[variant] ?? 0, painted = paint >= 1;
  const root = new THREE.Group();
  const baseG = new THREE.Group(); root.add(baseG);
  // clay base: lower hemisphere
  const baseMat = phys('#ffffff', { map: baseTexture(chIdx, paint), roughness: 0.78, clearcoat: painted ? 0.45 : 0.05, clearcoatRoughness: 0.45 });
  const baseGeo = new THREE.SphereGeometry(1, 56, 28, 0, TAU, Math.PI / 2, Math.PI / 2);
  baseG.add(mesh(baseGeo, baseMat));
  // torso: pivots at y = 0.35
  const torso = new THREE.Group(); torso.position.y = 0.35; baseG.add(torso);
  const tin = new THREE.Group(); tin.position.y = -0.35; torso.add(tin);
  const bodyMat = phys('#ffffff', { map: bodyTexture(chIdx, variant, paint), roughness: 0.55, clearcoat: painted ? 0.55 : 0.08, clearcoatRoughness: 0.3 });
  const body = mesh(new THREE.LatheGeometry(PROFILE, 64), bodyMat); body.rotation.y = Math.PI; tin.add(body);
  const skinC = painted ? c.skin : '#cc9068';
  const skinMat = phys(painted ? skinC : '#d49a72', { roughness: 0.6, clearcoat: 0.25 });
  // arms folded in front
  const armColor = painted ? hueShift(c.g, vs) : mixHex('#d49a72', c.g, 0.32);
  const armMat = phys(armColor, { roughness: 0.7, clearcoat: 0.1 });
  for (const s of [-1, 1]) {
    const arm = mesh(new THREE.SphereGeometry(1, 24, 16), armMat, s * 0.42, 1.45, 0.62);
    arm.scale.set(0.19, 0.4, 0.2); arm.rotation.z = -s * 0.55; arm.rotation.x = -0.1; tin.add(arm);
    const cuff = mesh(new THREE.SphereGeometry(0.15, 16, 12), std(painted ? c.sash : '#c08058', { roughness: 0.5 }), s * 0.2, 1.1, 0.76); cuff.scale.y = 0.7; tin.add(cuff);
  }
  tin.add(mesh(new THREE.SphereGeometry(0.17, 18, 14), skinMat, 0, 1.12, 0.8));
  // head: pivots at the neck (y 2.42)
  const head = new THREE.Group(); head.position.y = 2.42; tin.add(head);
  const hin = new THREE.Group(); hin.position.y = -2.42; head.add(hin);
  const neck = mesh(new THREE.CylinderGeometry(0.26, 0.34, 0.42, 20), skinMat, 0, 2.5, 0); hin.add(neck);
  const headMat = phys('#ffffff', { map: headTexture(chIdx, paint), roughness: 0.55, clearcoat: 0.3, clearcoatRoughness: 0.4 });
  const headMesh = mesh(new THREE.SphereGeometry(0.62, 48, 32), headMat, 0, 2.95, 0); hin.add(headMesh);
  const ears = [];
  if (paint >= 3) for (const s of [-1, 1]) {
    const e = mesh(new THREE.SphereGeometry(0.075, 14, 10), std('#ffd868', { metalness: 0.9, roughness: 0.25 }), s * 0.63, 2.84, 0.05); hin.add(e); ears.push(e);
  }
  const hairMat = std(c.hair, { roughness: 0.4 });
  const plume = new THREE.Group(); plume.position.set(0, 3.5, 0); hin.add(plume);
  const hairCap = (thetaLen = Math.PI * 0.4, back = true) => {
    const t = mesh(new THREE.SphereGeometry(0.645, 40, 20, 0, TAU, 0, thetaLen), hairMat, 0, 2.95, 0); hin.add(t);
    if (back) { const b = mesh(new THREE.SphereGeometry(0.648, 40, 20, Math.PI, Math.PI, 0, Math.PI * 0.72), hairMat, 0, 2.95, 0); hin.add(b); }
  };
  const gcCol = painted ? hueShift(c.gc, ['granny', 'bun', 'straw'].includes(c.gear) ? 0 : vs) : '#c08058';
  const gc = phys(gcCol, { roughness: 0.55, clearcoat: 0.2 });
  const gold = std('#ffd868', { metalness: 0.9, roughness: 0.25, emissive: '#6a4400', emissiveIntensity: 0.25 });
  if (!painted) {
    hin.add(mesh(new THREE.SphereGeometry(0.67, 32, 16, 0, TAU, 0, Math.PI * 0.36), std('#c08058', { roughness: 0.8 }), 0, 2.97, 0));
  } else if (c.gear === 'turban') {
    for (const [r, y, tube] of [[0.6, 3.22, 0.15], [0.54, 3.42, 0.14], [0.44, 3.6, 0.13]]) { const rg = ring(r, tube, y); rg.material = gc; rg.castShadow = true; rg.rotation.x = Math.PI / 2 + (y > 3.3 ? 0.12 : -0.05); hin.add(rg); }
    const dome = mesh(new THREE.SphereGeometry(0.42, 24, 16), gc, 0.04, 3.7, 0); dome.scale.y = 0.75; hin.add(dome);
    const tail = mesh(new THREE.SphereGeometry(0.2, 16, 12), gc, 0.5, 3.45, 0.3); tail.scale.set(1.2, 0.7, 0.8); hin.add(tail);
    hin.add(mesh(new THREE.SphereGeometry(0.1, 14, 10), gold, 0.08, 3.4, 0.6));
  } else if (c.gear === 'bun' || c.gear === 'granny') {
    hairCap(Math.PI * 0.4, true);
    const bun = mesh(new THREE.SphereGeometry(0.3, 24, 16), hairMat, 0, 3.78, -0.08); plume.add(bun); bun.position.set(0, 0.28, -0.08);
    if (c.gear === 'bun') for (let i = -3; i <= 3; i++) {
      const a = (i / 3) * 1.05, f = mesh(new THREE.SphereGeometry(0.095, 12, 10), std('#ffffff', { roughness: 0.4, emissive: '#bbbbbb', emissiveIntensity: 0.25 }), Math.sin(a) * 0.6, 3.46 + Math.abs(i) * -0.04, Math.cos(a) * 0.56);
      hin.add(f);
    }
    if (c.gear === 'granny') {
      const shawl = mesh(new THREE.TorusGeometry(0.62, 0.22, 14, 36), phys(hueShift('#eaa91c', vs), { roughness: 0.7, clearcoat: 0.1 }), 0, 2.2, 0); shawl.rotation.x = Math.PI / 2; shawl.scale.set(1.05, 1, 0.9); tin.add(shawl);
      const drape = mesh(new THREE.SphereGeometry(0.52, 20, 14), phys(hueShift('#eaa91c', vs), { roughness: 0.7, clearcoat: 0.1 }), 0, 1.7, 0.45); drape.scale.set(1.0, 0.8, 0.45); tin.add(drape);
    }
  } else if (c.gear === 'cap') {
    const cap = mesh(new THREE.SphereGeometry(0.69, 36, 18, 0, TAU, 0, Math.PI * 0.42), gc, 0, 2.97, 0); hin.add(cap);
    const band = ring(0.665, 0.05, 3.2); band.material = gold; hin.add(band);
    hin.add(mesh(new THREE.SphereGeometry(0.08, 12, 10), gold, 0, 3.64, 0));
  } else if (c.gear === 'tall') {
    hairCap(Math.PI * 0.36, true);
    const hat = mesh(lathe([[0.6, 3.3], [0.63, 3.45], [0.56, 4.15], [0.44, 4.62], [0.24, 4.78], [0.001, 4.8]], 40), gc, 0, 0, 0); hin.add(hat);
    const band = ring(0.62, 0.075, 3.55); band.material = std(hueShift(c.sash, 0)); hin.add(band);
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0.1, 4.6, 0), new THREE.Vector3(0.42, 4.78, 0.02), new THREE.Vector3(0.62, 5.0, 0.0), new THREE.Vector3(0.5, 5.25, 0.0)]);
    const feather = mesh(new THREE.TubeGeometry(curve, 16, 0.05, 8), gold); plume.add(feather); feather.position.y = -3.5;
  } else if (c.gear === 'band') {
    hairCap(Math.PI * 0.4, true);
    const band = ring(0.65, 0.075, 3.36); band.material = std(hueShift(c.sash, vs)); hin.add(band);
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(0.4, 3.45, 0.2), new THREE.Vector3(0.78, 3.7, 0.1), new THREE.Vector3(0.9, 4.0, 0.05), new THREE.Vector3(0.7, 4.3, 0)]);
    const pl = mesh(new THREE.TubeGeometry(curve, 16, 0.07, 8), gc); plume.add(pl); pl.position.y = -3.5;
  } else if (c.gear === 'straw') {
    const brim = mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.07, 48), gc, 0, 3.42, 0); brim.rotation.z = 0.05; hin.add(brim);
    const dome = mesh(new THREE.SphereGeometry(0.62, 32, 16, 0, TAU, 0, Math.PI / 2), gc, 0, 3.42, 0); dome.scale.y = 0.75; hin.add(dome);
    const band = ring(0.62, 0.06, 3.5); band.material = std(c.sash); hin.add(band);
  } else if (c.gear === 'tufts') {
    hairCap(Math.PI * 0.4, true);
    for (const s of [-1, 1]) {
      const t = mesh(new THREE.SphereGeometry(0.22, 18, 14), hairMat, s * 0.62, 3.4, 0); hin.add(t);
      hin.add(mesh(new THREE.SphereGeometry(0.09, 12, 10), gc, s * 0.62, 3.22, 0.05));
    }
  }
  const o = { base: baseG, torso, head, plume, bodyMat, ears, headMesh };
  root.userData = o;
  root.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  return root;
}

// The ghost: a faint teal silhouette with a bright outline (inverted hull) so the doll and the pattern stay readable together.
export function makeGhost() {
  const root = new THREE.Group();
  const fill = new THREE.MeshBasicMaterial({ color: col('#6fe8d8'), transparent: true, opacity: 0.1, depthWrite: true });
  const hull = new THREE.MeshBasicMaterial({ color: col('#10c0b0'), transparent: true, opacity: 0.8, side: THREE.BackSide, depthWrite: false });
  const baseG = new THREE.Group(); root.add(baseG);
  const baseGeo = new THREE.SphereGeometry(1, 36, 18, 0, TAU, Math.PI / 2, Math.PI / 2);
  const add = (parent, geo, y = 0) => {
    const a = new THREE.Mesh(geo, fill); a.position.y = y; a.renderOrder = 4; parent.add(a);
    const b = new THREE.Mesh(geo, hull); b.position.y = y; b.scale.setScalar(1.045); b.renderOrder = 5; parent.add(b);
  };
  add(baseG, baseGeo);
  const torso = new THREE.Group(); torso.position.y = 0.35; baseG.add(torso);
  const tin = new THREE.Group(); tin.position.y = -0.35; torso.add(tin);
  add(tin, new THREE.LatheGeometry(PROFILE, 40));
  const head = new THREE.Group(); head.position.y = 2.42; tin.add(head);
  const hin = new THREE.Group(); hin.position.y = -2.42; head.add(hin);
  const hg = new THREE.SphereGeometry(0.62, 28, 18);
  const hm = new THREE.Mesh(hg, fill); hm.position.y = 2.95; hm.renderOrder = 4; hin.add(hm);
  const hh = new THREE.Mesh(hg, hull); hh.position.y = 2.95; hh.scale.setScalar(1.1); hh.renderOrder = 5; hin.add(hh);
  root.userData = { base: baseG, torso, head, hullMat: hull };
  return root;
}

// ---- the room ------------------------------------------------------------------------------------------------------------------------
// One set; layout() positions it for the current screen. Every position is given in screen virtual units (x right, y down) at the
// plane z = 0 (where the dolls stand), and is converted to world coordinates for the depth the object really sits at, so the 3D
// shelf lines up exactly with the 2D rails and tags drawn on top.
export const WALL_Z = 360;
export function buildSet() {
  const group = new THREE.Group();
  const flags = [], motes = [];
  // wall
  const wallMat = new THREE.MeshStandardMaterial({ map: plasterTexture(), roughness: 0.95, color: '#f4e4c0' });
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), wallMat); wall.receiveShadow = false; group.add(wall);
  // dado band
  const zig = zigzagTexture(); zig.repeat.set(1, 1);
  const dado = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardMaterial({ map: zig, roughness: 0.8 })); dado.position.z = 1.5; group.add(dado);
  const wain = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardMaterial({ color: '#b9803f', roughness: 0.9 })); wain.position.z = 1; group.add(wain);
  const rail = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ map: woodTexture(), roughness: 0.5 })); rail.castShadow = true; rail.receiveShadow = true; group.add(rail);
  // arched window
  const win = new THREE.Group(); group.add(win);
  const glass = new THREE.Mesh(new THREE.ShapeGeometry(archShape(1, 1)), new THREE.MeshBasicMaterial({ map: skyTexture(), toneMapped: false })); glass.position.z = 2; win.add(glass);
  const frameShape = archShape(1.2, 1.1, -0.06); frameShape.holes.push(new THREE.Path(archShape(1, 1).getPoints(24)));
  const frame = new THREE.Mesh(new THREE.ExtrudeGeometry(frameShape, { depth: 0.08, bevelEnabled: true, bevelSize: 0.015, bevelThickness: 0.015, bevelSegments: 2 }), new THREE.MeshStandardMaterial({ map: woodTexture('#fff2d8', '#e0c08a'), roughness: 0.5 }));
  frame.castShadow = true; win.add(frame);
  const mull = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: '#fff2d8', roughness: 0.5 })); win.add(mull);
  const mull2 = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mull.material); win.add(mull2);
  const shaft = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: shaftTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.35 })); shaft.position.z = 6; group.add(shaft);
  // bunting
  const triG = new THREE.BufferGeometry(); triG.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, 0, -1, 0], 3)); triG.computeVertexNormals();
  const FC = ['#d9402a', '#eaa91c', '#1f8a5b', '#2757a8', '#e0568a', '#14958c'].map((c) => std(c, { side: THREE.DoubleSide, roughness: 0.85 }));
  for (let i = 0; i < 44; i++) { const pv = new THREE.Group(); const m = new THREE.Mesh(triG, FC[i % 6]); m.castShadow = true; pv.add(m); group.add(pv); flags.push({ pv, m }); }
  let stringLine = null;
  // lamp
  const lamp = new THREE.Group(); group.add(lamp);
  const chain = mesh(new THREE.CylinderGeometry(0.02, 0.02, 1, 6), std('#3a2a1a')); lamp.add(chain);
  const shade = mesh(lathe([[0.001, 0.55], [0.45, 0.5], [0.7, 0.05], [0.8, -0.1]], 24), std('#a86f0c', { metalness: 0.9, roughness: 0.3, side: THREE.DoubleSide })); lamp.add(shade);
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.3, 20, 14), new THREE.MeshBasicMaterial({ color: '#fff2b0', toneMapped: false })); bulb.position.y = -0.05; lamp.add(bulb);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('255,214,120'), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.8 })); lamp.add(halo);
  // shelf
  const woodM = new THREE.MeshStandardMaterial({ map: woodTexture('#d89a5a', '#8c4a22'), roughness: 0.42, metalness: 0 });
  const shelfTop = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), woodM); shelfTop.castShadow = true; shelfTop.receiveShadow = true; group.add(shelfTop);
  const apronM = new THREE.MeshStandardMaterial({ map: woodTexture('#a8602c', '#4a200c'), roughness: 0.55 });
  const apron = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), apronM); apron.castShadow = true; apron.receiveShadow = true; group.add(apron);
  const trim = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), std('#ffd868', { metalness: 0.9, roughness: 0.32 })); group.add(trim);
  // dust motes
  const mp = new Float32Array(60 * 3);
  const moteGeo = new THREE.BufferGeometry(); moteGeo.setAttribute('position', new THREE.BufferAttribute(mp, 3));
  const moteMat = new THREE.PointsMaterial({ map: glowTexture('255,244,200'), size: 10, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.8, sizeAttenuation: true });
  const dust = new THREE.Points(moteGeo, moteMat); dust.frustumCulled = false; group.add(dust);
  const lampLight = new THREE.PointLight('#ffcf80', 1, 0, 1.3); group.add(lampLight);
  const winLight = new THREE.SpotLight('#fff0c0', 1, 0, 0.9, 0.8, 1); group.add(winLight); group.add(winLight.target);

  const S = { D: 2000, W: 720, H: 1280, flagN: 20, lampBase: 0, moteBox: null, bunt: null, lampPos: null };
  const wallXY = (sx, sy) => ({ x: S.W / 2 + (sx - S.W / 2) * (S.D + WALL_Z) / S.D, y: -(S.H / 2 + (sy - S.H / 2) * (S.D + WALL_Z) / S.D) });
  const k = () => (S.D + WALL_Z) / S.D;
  // Position everything for a screen of W x H virtual units with the stage rect + shelf edge from the 2D layout.
  function layout(W, H, D, st) {
    Object.assign(S, { W, H, D });
    const { S: R, gy } = st, top = R.y, u = Math.max(18, Math.min(R.w / 9, (gy - top) / 11)), kk = k();
    const cw = W * kk * 1.12, chh = H * kk * 1.12;
    wall.scale.set(cw, chh, 1); wall.position.set(W / 2, -H / 2, -WALL_Z);
    wallMat.map.repeat.set(cw / 640, chh / 640);
    // dado
    const dh = u * 1.3, dy = gy - dh * 1.6, a = wallXY(0, dy), b = wallXY(0, dy + dh * 0.5);
    dado.scale.set(cw, Math.abs(a.y - b.y), 1); dado.position.set(W / 2, (a.y + b.y) / 2, -WALL_Z + 1.5);
    dado.material.map.repeat.set(cw / (u * 2.4), 1);
    const c2 = wallXY(0, gy);
    wain.scale.set(cw, Math.abs(b.y - c2.y), 1); wain.position.set(W / 2, (b.y + c2.y) / 2, -WALL_Z + 1);
    rail.scale.set(cw, Math.max(3, u * 0.12), 6); rail.position.set(W / 2, a.y + 1, -WALL_Z + 3);
    // window (anchored to the stage like the 2D room)
    const ww = Math.min(R.w * 0.2, u * 3.2), wh = Math.min((gy - top) * 0.52, u * 5.6), wy = top + (gy - top) * 0.14, wx = R.x + R.w * 0.82;
    const wtop = wallXY(wx, wy), wbot = wallXY(wx, wy + wh), wwid = ww * kk, whgt = Math.abs(wtop.y - wbot.y) - 0;
    win.position.set(wtop.x, wbot.y, -WALL_Z + 4);
    glass.scale.set(wwid, whgt, 1); frame.scale.set(wwid, whgt, 1); frame.position.set(0, 0, -0.06);
    mull.scale.set(Math.max(3, wwid * 0.04), whgt * 0.9, 5); mull.position.set(0, whgt * 0.45, 3);
    mull2.scale.set(wwid, Math.max(3, whgt * 0.03), 5); mull2.position.set(0, whgt * 0.42, 3);
    // shaft of light: a slanted additive quad from the sill down-left to the shelf
    const sh0 = wallXY(wx, wy + wh), sh1 = wallXY(wx - R.w * 0.55, gy);
    const dx = sh1.x - sh0.x, dyy = sh1.y - sh0.y, len = Math.hypot(dx, dyy);
    shaft.scale.set(wwid * 1.3 + len * 0.18, len, 1); shaft.position.set((sh0.x + sh1.x) / 2, (sh0.y + sh1.y) / 2, -WALL_Z + 8);
    shaft.rotation.z = Math.atan2(dyy, dx) + Math.PI / 2;
    // bunting + lamp + lights
    const nf = Math.min(44, Math.max(8, Math.round(R.w / (u * 1.1)))), sag = u * 0.9, by = top + u * 0.55;
    S.bunt = { nf, sag, by, x0: R.x, w: R.w, u };
    S.lampPos = { sx: R.x + R.w * 0.16, sy: top + (gy - top) * 0.2, u };
    const lp = wallXY(S.lampPos.sx, S.lampPos.sy);
    lamp.position.set(lp.x, lp.y, -WALL_Z + 40); lamp.scale.setScalar(u * kk * 0.85);
    const topAnchor = wallXY(S.lampPos.sx, by + sag * 0.3);
    chain.scale.set(1, Math.max(0.1, (topAnchor.y - lp.y) / (u * kk * 0.85) - 0.6), 1); chain.position.y = (chain.scale.y / 2) + 0.55;
    halo.scale.set(5, 5, 1);
    lampLight.position.set(lp.x, lp.y - u * 0.5, -WALL_Z + 160); lampLight.distance = Math.max(W, H) * 1.3; lampLight.decay = 1.3;
    winLight.position.set(win.position.x - wwid * 0.1, win.position.y + whgt * 0.4, -WALL_Z + 120); winLight.target.position.set(R.x + R.w * 0.3, -gy, 0); winLight.distance = Math.max(W, H) * 2;
    S.moteBox = { x0: Math.min(wx, sh1.x), x1: wtop.x + wwid, y0: wbot.y, y1: sh1.y };
    // shelf: top face at y = -gy spanning wall to a little in front of the dolls; front apron below
    const zf = Math.max(40, st.R * 0.9), zb = -WALL_Z + 6, th = Math.max(16, st.R * 0.22), sw = W * 1.4;
    shelfTop.scale.set(sw, th, zf - zb); shelfTop.position.set(W / 2, -gy - th / 2, (zf + zb) / 2);
    const aTop = -gy - th, apH = Math.max(100, H * 1.3 + aTop);
    apron.scale.set(sw, apH, 30); apron.position.set(W / 2, aTop - apH / 2 + th * 0.2, zf - 15);
    trim.scale.set(sw, Math.max(3, th * 0.12), 4); trim.position.set(W / 2, -gy - th * 0.62, zf + 1);
    S.shelf = { zf, th, gy };
    // wallXY ranges for bunting string
    buildString();
  }
  function buildString() {
    if (stringLine) { group.remove(stringLine); stringLine.geometry.dispose(); }
    const { x0, w, sag, by } = S.bunt, n = 28, pts = [];
    for (let i = 0; i <= n; i++) { const f = i / n, p = wallXY(x0 + f * w, by + Math.sin(f * Math.PI) * sag); pts.push(new THREE.Vector3(p.x, p.y, -WALL_Z + 30)); }
    stringLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: '#5a3a28' })); group.add(stringLine);
  }
  function update(t, lampGlow, calm) {
    // flags
    const B = S.bunt; if (!B) return;
    for (let i = 0; i < flags.length; i++) {
      const f = flags[i]; if (i >= B.nf) { f.pv.visible = false; continue; }
      f.pv.visible = true; const fr = (i + 0.5) / B.nf, p = wallXY(B.x0 + fr * B.w, B.by + Math.sin(fr * Math.PI) * B.sag);
      f.pv.position.set(p.x, p.y, -WALL_Z + 32);
      const s = B.u * 0.64 * k();
      f.m.scale.set(s, s * 1.1, 1);
      f.m.rotation.z = calm ? 0 : Math.sin(t * 1.4 + i * 0.9) * 0.09;
      f.m.rotation.x = calm ? 0 : Math.sin(t * 1.9 + i * 1.3) * 0.12;
    }
    // lamp
    lampLight.intensity = 0.7 + lampGlow * 1.3; halo.material.opacity = 0.5 + lampGlow * 0.4; halo.scale.setScalar(4.5 + lampGlow * 2);
    lamp.rotation.z = calm ? 0 : Math.sin(t * 0.7) * 0.025;
    // dust motes
    const bx = S.moteBox; if (bx) {
      const pos = dust.geometry.attributes.position;
      for (let i = 0; i < 60; i++) {
        const fx = (hash(i * 2.1) + t * 0.004 * (0.5 + hash(i))) % 1, fy = (hash(i * 4.7) - t * 0.006 * (0.3 + hash(i * 3))) % 1;
        const yy = fy < 0 ? fy + 1 : fy;
        const lerp = (a, b, f) => a + (b - a) * f;
        pos.setXYZ(i, lerp(bx.x0, bx.x1, fx) + Math.sin(t * 0.5 + i) * 6, lerp(bx.y0, bx.y1, yy) + Math.cos(t * 0.4 + i * 2) * 6, -40 + hash(i * 7.1) * 120);
      }
      pos.needsUpdate = true;
      dust.material.size = 7 + S.W * 0.006; dust.material.opacity = calm ? 0.35 : 0.8;
    }
    shaft.material.opacity = 0.32 + Math.sin(t * 0.25) * 0.08;
  }
  return { group, layout, update, lampLight, winLight, S, wallXY, shelfParts: [shelfTop, apron, trim] };
}

function archShape(w, h) {
  // unit arch: width w, height h, origin at the bottom centre
  const r = 0.5 * w, s = new THREE.Shape();
  s.moveTo(-r, 0); s.lineTo(-r, h - r * 0.9 * 1);
  s.absarc(0, h - r * 0.9, r, Math.PI, 0, true); s.lineTo(r, 0); s.lineTo(-r, 0);
  return s;
}

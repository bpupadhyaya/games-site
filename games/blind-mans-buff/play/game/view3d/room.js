// The four rooms of Blind Man's Buff as real lit 3D sets (presentation only; the sim never sees any of this).
//
// Metres, y up, the 1000-unit room is 6.4 m wide, centred on the origin (x = (ux - 500) / UPM, z = (uy - 500) / UPM).
// Prop heights are kept below ~1 m on purpose: the play camera leans over the room and a tall prop would hide the guests behind it.
// Candles flicker (flame sprites and point lights share one seeded flicker), the fountain jets and ripples, the rug has fringe,
// parquet and tiles carry bump + clearcoat so the candle pools slide across them.
import { board3d as B, THREE } from '../vendor3d/index.js';

export const UPM = 1000 / 6.4;
const TAU = Math.PI * 2;
const M = (u) => u / UPM;
const rng = (seed) => { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; };
const cvs = (w, h = w) => { const c = globalThis.document.createElement('canvas'); c.width = w; c.height = h; return c; };
const tex = (c, { srgb = true, rep = null, aniso = 4 } = {}) => {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = aniso;
  if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
  return t;
};
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0, ...o });
const phys = (color, o = {}) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.6, metalness: 0, ...o });
const velvet = (color) => phys(color, { roughness: 0.9, sheen: 1, sheenColor: new THREE.Color('#ffd7e2'), sheenRoughness: 0.45 });
const mesh = (geo, mat, x = 0, y = 0, z = 0, shadow = true) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = shadow; m.receiveShadow = true; return m; };

// ---- procedural textures ---------------------------------------------------------------------------------------------------------------
function noiseInto(g, w, h, r, n, a, light = true) {
  for (let i = 0; i < n; i++) { g.fillStyle = `rgba(${light ? '255,240,210' : '20,10,0'},${r() * a})`; g.fillRect(r() * w, r() * h, 1 + r() * 3, 1 + r() * 3); }
}
function floorMaps(kind, N = 1024) {
  const c = cvs(N), g = c.getContext('2d'), b = cvs(N), bg = b.getContext('2d'), r = rng(kind.length * 977 + 5);
  const U = N / 1000;
  bg.fillStyle = '#808080'; bg.fillRect(0, 0, N, N);
  if (kind === 'parquet') {
    g.fillStyle = '#7a4d2a'; g.fillRect(0, 0, N, N);
    const T = 80 * U, S = 8;
    for (let y = 0; y < 1000 / 80; y++) for (let x = 0; x < 1000 / 80; x++) {
      const dir = (x + y) % 2;
      for (let s = 0; s < S; s++) {
        const tone = 0.82 + r() * 0.32, hueS = r();
        const R = Math.round(176 * tone), G = Math.round((124 + hueS * 14) * tone), Bc = Math.round((76 + hueS * 8) * tone);
        g.fillStyle = `rgb(${R},${G},${Bc})`;
        const sw = T / S;
        const rx = dir ? x * T + s * sw : x * T, ry = dir ? y * T : y * T + s * sw, rw = dir ? sw - 1.2 : T - 1.2, rh = dir ? T - 1.2 : sw - 1.2;
        g.fillRect(rx, ry, rw, rh);
        // grain
        g.strokeStyle = `rgba(60,28,8,${0.1 + r() * 0.16})`; g.lineWidth = 1;
        for (let k = 0; k < 3; k++) { g.beginPath(); if (dir) { const gx = rx + rw * (0.2 + r() * 0.6); g.moveTo(gx, ry); g.lineTo(gx + (r() - 0.5) * 3, ry + rh); } else { const gy = ry + rh * (0.2 + r() * 0.6); g.moveTo(rx, gy); g.lineTo(rx + rw, gy + (r() - 0.5) * 3); } g.stroke(); }
        bg.fillStyle = `rgb(${128 + (tone - 1) * 60},${128 + (tone - 1) * 60},${128 + (tone - 1) * 60})`; bg.fillRect(rx, ry, rw, rh);
      }
    }
    noiseInto(g, N, N, r, 3500, 0.12); noiseInto(g, N, N, r, 2500, 0.18, false);
  } else if (kind === 'gravel') {
    const lg = g.createLinearGradient(0, 0, N, N); lg.addColorStop(0, '#8c9c78'); lg.addColorStop(1, '#657a5b');
    g.fillStyle = lg; g.fillRect(0, 0, N, N);
    for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(${r() > 0.5 ? '25,60,25' : '175,205,140'},${0.1 + r() * 0.2})`; g.fillRect(r() * N, r() * N, 2 + r() * 6, 2 + r() * 3); }
    g.strokeStyle = '#d6cba6'; g.lineWidth = 120 * U; g.beginPath(); g.arc(N / 2, N / 2, 290 * U, 0, TAU); g.stroke();
    g.lineWidth = 100 * U; g.beginPath(); g.moveTo(N / 2, 40 * U); g.lineTo(N / 2, N - 40 * U); g.moveTo(40 * U, N / 2); g.lineTo(N - 40 * U, N / 2); g.stroke();
    for (let i = 0; i < 9000; i++) {
      const x = r() * N, y = r() * N, d = Math.hypot(x - N / 2, y - N / 2) / U, onPath = Math.abs(d - 290) < 60 || Math.abs(x / U - 500) < 50 || Math.abs(y / U - 500) < 50;
      const pebble = onPath ? 1 : 0.35, rr = 1.2 + r() * 2.2;
      g.fillStyle = `rgba(${r() > 0.5 ? '110,92,64' : '255,250,232'},${0.3 * pebble})`; g.beginPath(); g.arc(x, y, rr, 0, TAU); g.fill();
      bg.fillStyle = `rgba(${r() > 0.5 ? 255 : 30},${r() > 0.5 ? 255 : 30},${r() > 0.5 ? 255 : 30},0.5)`; bg.beginPath(); bg.arc(x, y, rr, 0, TAU); bg.fill();
    }
  } else if (kind === 'tiles') {
    const T = 100 * U;
    for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++) {
      const dark = (x + y) % 2 === 0, q = r();
      g.fillStyle = dark ? `rgb(${52 + q * 14},${116 + q * 14},${122 + q * 12})` : `rgb(${228 + q * 12},${216 + q * 10},${190 + q * 14})`;
      g.fillRect(x * T, y * T, T, T);
      const gl = g.createLinearGradient(x * T, y * T, x * T + T, y * T + T); gl.addColorStop(0, 'rgba(255,255,255,0.14)'); gl.addColorStop(1, 'rgba(0,0,0,0.1)');
      g.fillStyle = gl; g.fillRect(x * T, y * T, T, T);
      g.strokeStyle = 'rgba(40,52,52,0.7)'; g.lineWidth = 3; g.strokeRect(x * T, y * T, T, T);
      bg.strokeStyle = '#000'; bg.lineWidth = 6; bg.strokeRect(x * T, y * T, T, T);
      if (!dark) { g.strokeStyle = 'rgba(170,150,110,0.35)'; g.lineWidth = 1.5; g.strokeRect(x * T + T * 0.18, y * T + T * 0.18, T * 0.64, T * 0.64); }
    }
  } else {   // marble
    const T = 125 * U;
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      const dark = (x + y) % 2 === 0, q = r();
      g.fillStyle = dark ? `rgb(${40 + q * 10},${36 + q * 8},${64 + q * 14})` : `rgb(${236 + q * 10},${230 + q * 10},${240})`;
      g.fillRect(x * T, y * T, T, T);
      g.strokeStyle = dark ? 'rgba(255,255,255,0.18)' : 'rgba(110,90,150,0.28)'; g.lineWidth = 1.6;
      for (let k = 0; k < 4; k++) { g.beginPath(); let px = x * T + r() * T, py = y * T + r() * T; g.moveTo(px, py); for (let s = 0; s < 4; s++) { px += (r() - 0.3) * T * 0.35; py += (r() - 0.5) * T * 0.35; g.lineTo(px, py); } g.stroke(); }
      g.strokeStyle = 'rgba(20,16,36,0.55)'; g.lineWidth = 2.5; g.strokeRect(x * T, y * T, T, T);
      bg.strokeStyle = '#000'; bg.lineWidth = 5; bg.strokeRect(x * T, y * T, T, T);
    }
  }
  return { map: c, bump: b };
}

function rugMap(N = 512) {
  const c = cvs(N, N), g = c.getContext('2d'), s = N / 480;
  g.clearRect(0, 0, N, N);
  const fr = 14 * s, W = N, rr = rng(31);
  // fringe
  g.strokeStyle = '#efe3c4'; g.lineWidth = 2;
  for (let i = 0; i < 48; i++) { const x = (i + 0.5) * (N / 48); for (const y0 of [fr, N - fr]) { g.beginPath(); g.moveTo(x, y0); g.lineTo(x + (rr() - 0.5) * 4, y0 + (y0 < N / 2 ? -1 : 1) * fr * (0.9 + rr() * 0.1)); g.stroke(); } }
  g.fillStyle = '#7a1f3b'; g.fillRect(0, fr, W, N - 2 * fr);
  g.fillStyle = '#e8c26a'; g.fillRect(14 * s, fr + 14 * s, N - 28 * s, N - 2 * fr - 28 * s);
  g.fillStyle = '#5a1530'; g.fillRect(20 * s, fr + 20 * s, N - 40 * s, N - 2 * fr - 40 * s);
  g.fillStyle = '#8f2b4a'; g.fillRect(52 * s, fr + 52 * s, N - 104 * s, N - 2 * fr - 104 * s);
  // medallion + corner motifs
  g.save(); g.translate(N / 2, N / 2);
  for (let k = 0; k < 8; k++) { g.save(); g.rotate((k * TAU) / 8); g.fillStyle = k % 2 ? '#e8c26a' : '#2c5b6e'; g.beginPath(); g.ellipse(0, -92 * s, 22 * s, 56 * s, 0, 0, TAU); g.fill(); g.restore(); }
  g.fillStyle = '#5a1530'; g.beginPath(); g.arc(0, 0, 54 * s, 0, TAU); g.fill();
  g.strokeStyle = '#e8c26a'; g.lineWidth = 4 * s; g.beginPath(); g.arc(0, 0, 54 * s, 0, TAU); g.stroke();
  g.fillStyle = '#e8c26a'; for (let k = 0; k < 12; k++) { g.save(); g.rotate((k * TAU) / 12); g.beginPath(); g.moveTo(0, -20 * s); g.lineTo(6 * s, -42 * s); g.lineTo(-6 * s, -42 * s); g.fill(); g.restore(); }
  g.restore();
  g.strokeStyle = 'rgba(255,230,180,0.05)'; g.lineWidth = 1;
  for (let i = 0; i < 90; i++) { g.beginPath(); const y = rr() * N; g.moveTo(0, y); g.lineTo(N, y + (rr() - 0.5) * 3); g.stroke(); }
  return c;
}

function leafMap(base, hi, N = 256) {
  const c = cvs(N), g = c.getContext('2d'), r = rng(base.length * 31 + 7);
  g.fillStyle = base; g.fillRect(0, 0, N, N);
  for (let i = 0; i < 900; i++) { g.fillStyle = r() > 0.5 ? hi : 'rgba(10,40,10,0.7)'; g.globalAlpha = 0.18 + r() * 0.3; g.beginPath(); g.ellipse(r() * N, r() * N, 3 + r() * 6, 2 + r() * 3, r() * TAU, 0, TAU); g.fill(); }
  g.globalAlpha = 1;
  return c;
}

const flameTex = (() => {
  let t = null;
  return () => {
    if (t) return t;
    const c = cvs(64, 96), g = c.getContext('2d');
    const rg = g.createRadialGradient(32, 62, 2, 32, 62, 34); rg.addColorStop(0, 'rgba(255,255,230,1)'); rg.addColorStop(0.25, 'rgba(255,214,120,0.95)'); rg.addColorStop(0.6, 'rgba(255,140,40,0.35)'); rg.addColorStop(1, 'rgba(255,100,20,0)');
    g.fillStyle = rg; g.beginPath(); g.moveTo(32, 4); g.bezierCurveTo(54, 40, 56, 70, 32, 92); g.bezierCurveTo(8, 70, 10, 40, 32, 4); g.fill();
    return (t = tex(c));
  };
})();
const poolTex = (() => {
  let t = null;
  return () => {
    if (t) return t;
    const c = cvs(128), g = c.getContext('2d'), rg = g.createRadialGradient(64, 64, 2, 64, 64, 64);
    rg.addColorStop(0, 'rgba(255,200,130,0.32)'); rg.addColorStop(0.5, 'rgba(255,170,90,0.1)'); rg.addColorStop(1, 'rgba(255,160,80,0)');
    g.fillStyle = rg; g.fillRect(0, 0, 128, 128);
    return (t = tex(c));
  };
})();

// ---- props -----------------------------------------------------------------------------------------------------------------------------
function leafyBlob(radius, material, seed, detail = 2, squash = 1) {
  const geo = new THREE.SphereGeometry(radius, 10 + detail * 3, 7 + detail * 2), r = rng(seed), p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const k = 1 + (r() - 0.5) * 0.28; p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * squash, p.getZ(i) * k); }
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, material);
}

export class RoomKit {
  constructor() {
    this.mats = {};
    this.mat = {
      brass: B.material('brass'), dark: B.material('darkWood'), wood: B.material('wood'), cream: std('#f1e6cc', { roughness: 0.7 }),
      terracotta: B.material('clay', { color: '#b8693f', color2: '#d28a5c' }),
      stone: std('#d9d2c2', { roughness: 0.78 }), stoneDark: std('#a79d89', { roughness: 0.8 }),
      marble: phys('#f2eef6', { roughness: 0.22, clearcoat: 0.6, clearcoatRoughness: 0.2 }),
      water: phys('#3f93ad', { roughness: 0.04, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.02, transparent: true, opacity: 0.88, emissive: '#0c3a4a', emissiveIntensity: 0.5 }),
      cloth: std('#fffaf0', { roughness: 0.9, side: THREE.DoubleSide }), curtain: velvet('#7a1730'), gold: std('#e8c26a', { roughness: 0.28, metalness: 0.85 }),
    };
    this.leafs = {};
    this.flames = [];       // { sprite, light|null, phase, base }
    this.anim = [];         // (t) => void
    this.lights = [];
  }
  leaf(name, a, b) { return this.leafs[name] ||= phys('#ffffff', { map: tex(leafMap(a, b), { rep: [2, 2] }), roughness: 0.82, sheen: 0.4, sheenColor: new THREE.Color(b) }); }
  flame(parent, x, y, z, size = 0.085, withLight = false) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameTex(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    s.scale.set(size, size * 1.5, 1); s.position.set(x, y + size * 0.7, z); s.center.set(0.5, 0.2);
    parent.add(s);
    const f = { sprite: s, light: null, phase: this.flames.length * 1.7 + 0.3, size };
    if (withLight) {
      const l = new THREE.PointLight(0xffb366, 0, 5.2, 2); l.position.set(x, y + 0.25, z); parent.add(l); f.light = l; f.base = 3.4; this.lights.push(l);
    }
    this.flames.push(f);
    return f;
  }
  candle(parent, x, y, z, h = 0.14, withLight = false) {
    parent.add(mesh(new THREE.CylinderGeometry(0.013, 0.015, h, 12), this.mat.cream, x, y + h / 2, z));
    parent.add(mesh(new THREE.CylinderGeometry(0.0035, 0.0035, 0.025, 6), std('#201510'), x, y + h + 0.01, z, false));
    return this.flame(parent, x, y + h + 0.02, z, 0.075, withLight);
  }
  candelabra(g, x, z, withLight = true, h = 0.95) {
    const k = new THREE.Group(); k.position.set(x, 0, z);
    const br = this.mat.brass;
    k.add(mesh(B.lathe([[0, 0], [0.12, 0], [0.12, 0.02], [0.09, 0.05], [0.055, 0.1], [0.03, 0.16], [0.025, h * 0.5], [0.04, h * 0.52], [0.022, h * 0.56], [0.02, h * 0.9], [0.05, h * 0.93], [0.07, h * 0.96], [0, h * 0.96]], 28), br));
    const n = 3;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + 0.4, ax = Math.cos(a) * 0.15, az = Math.sin(a) * 0.15;
      const arm = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.01, 6, 12, Math.PI), br); arm.position.set(ax / 2, h * 0.9, az / 2); arm.rotation.y = -a; arm.rotation.z = Math.PI; arm.castShadow = false;
      k.add(arm);
      k.add(mesh(new THREE.CylinderGeometry(0.03, 0.02, 0.025, 12), br, ax, h * 0.9, az, false));
      this.candle(k, ax, h * 0.9 + 0.012, az, 0.12, false);
    }
    this.candle(k, 0, h * 0.96, 0, 0.16, withLight);
    g.add(k);
    return k;
  }

  // ---- the individual props: local origin at the floor centre of the footprint
  build(o) {
    const g = new THREE.Group();
    const w = o.k === 'r' ? M(o.w) : M(o.r) * 2, d = o.k === 'r' ? M(o.h) : M(o.r) * 2;
    const cx = o.k === 'r' ? o.x + o.w / 2 : o.x, cy = o.k === 'r' ? o.y + o.h / 2 : o.y;
    g.position.set(M(cx - 500), 0, M(cy - 500));
    const m = this.mat, r = rng((o.x | 0) * 13 + (o.y | 0));
    const back = cy < 500 ? -1 : 1;                                     // props with a back sit it against the nearer wall
    if (o.art === 'sofa') {
      const velv = velvet('#8a2f50'), velvLite = velvet('#a84a6c');
      g.add(mesh(B.roundedBox(w, 0.22, d, 0.04), velv, 0, 0.2, 0));
      for (const sx of [-1, 1]) {
        g.add(mesh(B.roundedBox(0.14, 0.52, d, 0.06), velv, sx * (w / 2 - 0.07), 0.38, 0));       // arms
        g.add(mesh(new THREE.CylinderGeometry(0.075, 0.075, d * 0.98, 16), velvLite, sx * (w / 2 - 0.07), 0.64, 0).rotateX(Math.PI / 2)); // roll
      }
      g.add(mesh(B.roundedBox(w - 0.1, 0.5, 0.15, 0.06), velv, 0, 0.5, back * (d / 2 - 0.075)));    // back
      for (let i = 0; i < 3; i++) g.add(mesh(B.roundedBox((w - 0.36) / 3 - 0.02, 0.12, d - 0.26, 0.05), velvLite, -((w - 0.36) / 3) + i * ((w - 0.36) / 3), 0.38, -back * 0.05));
      for (let i = 0; i < 3; i++) g.add(mesh(new THREE.SphereGeometry(0.014, 8, 6), m.gold, -((w - 0.36) / 3) + i * ((w - 0.36) / 3), 0.66, back * (d / 2 - 0.15), false));
      g.add(mesh(B.roundedBox(w + 0.02, 0.025, d + 0.02, 0.01), m.gold, 0, 0.115, 0));
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(mesh(B.lathe([[0.03, 0], [0.045, 0.04], [0.03, 0.09], [0.02, 0.1]], 12), m.brass, sx * (w / 2 - 0.1), 0, sz * (d / 2 - 0.1)));
      // a throw cushion
      const cu = mesh(B.roundedBox(0.2, 0.2, 0.08, 0.04), phys('#e8c26a', { roughness: 0.8, sheen: 1 }), -w / 2 + 0.35, 0.58, -back * 0.0); cu.rotation.set(0.5 * back, 0.3, 0.15); g.add(cu);
    } else if (o.art === 'harpsichord') {
      const lac = phys('#2a1812', { roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.08 });
      g.add(mesh(B.roundedBox(w, 0.17, d, 0.03), lac, 0, 0.72, 0));
      g.add(mesh(B.roundedBox(w - 0.1, 0.02, d - 0.1, 0.01), std('#8a5a34', { roughness: 0.4 }), 0, 0.812, 0, false));
      // painted soundboard ornament and strings
      for (let i = 0; i < 18; i++) g.add(mesh(new THREE.BoxGeometry(0.003, 0.002, d * 0.6), m.gold, -w / 2 + 0.1 + (i / 17) * (w - 0.2), 0.826, back * 0.04, false));
      // lid propped open on a stick
      const lid = mesh(B.roundedBox(w - 0.03, 0.025, d * 0.82, 0.012), lac, 0, 0.98, back * (d * 0.3)); lid.rotation.x = -back * 0.62; g.add(lid);
      // keyboard
      g.add(mesh(new THREE.BoxGeometry(w - 0.2, 0.035, 0.17), std('#f6efd9', { roughness: 0.35 }), 0, 0.82, -back * (d / 2 - 0.02)));
      for (let i = 0; i < 14; i++) if (i % 7 !== 2 && i % 7 !== 6) g.add(mesh(new THREE.BoxGeometry(0.014, 0.02, 0.1), std('#15100c'), -w / 2 + 0.16 + (i + 0.5) * ((w - 0.32) / 14), 0.84, -back * (d / 2 + 0.0 - 0.06), false));
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(mesh(B.lathe([[0.02, 0], [0.03, 0.08], [0.035, 0.3], [0.045, 0.45], [0.06, 0.6], [0.05, 0.63]], 12), m.dark, sx * (w / 2 - 0.08), 0, sz * (d / 2 - 0.08)));
    } else if (o.art === 'table') {
      const rad = M(o.r);
      g.add(mesh(B.lathe([[0, 0], [rad * 0.55, 0], [rad * 0.5, 0.03], [0.07, 0.1], [0.05, 0.3], [0.07, 0.62], [0.03, 0.66]], 28), m.dark));
      g.add(mesh(new THREE.CylinderGeometry(rad, rad, 0.04, 40), m.dark, 0, 0.7, 0));
      const cloth = mesh(B.lathe([[0, 0.725], [rad * 1.02, 0.725], [rad * 1.06, 0.62], [rad * 1.1, 0.5], [rad * 1.08, 0.48]], 40), phys('#e6d6b4', { roughness: 0.85, sheen: 0.6, side: THREE.DoubleSide }));
      g.add(cloth);
      g.add(mesh(new THREE.TorusGeometry(rad * 1.09, 0.008, 6, 40), m.gold, 0, 0.49, 0, false).rotateX(Math.PI / 2));
      const cand = this.candelabra(g, 0, 0, true, 0.38); cand.position.y = 0.72;
      for (let k = 0; k < 4; k++) {
        const a = k * (TAU / 4) + 0.6, px = Math.cos(a) * rad * 0.62, pz = Math.sin(a) * rad * 0.62;
        g.add(mesh(B.lathe([[0.001, 0.72], [0.03, 0.72], [0.012, 0.74], [0.01, 0.78], [0.036, 0.84], [0.034, 0.86]], 14).clone(), B.material('glass'), px, 0, pz, false));
        g.add(mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.006, 22), m.cream, Math.cos(a + 0.5) * rad * 0.7, 0.725, Math.sin(a + 0.5) * rad * 0.7, false));
      }
    } else if (o.art === 'urn') {
      const rad = M(o.r);
      g.add(mesh(B.lathe([[0, 0], [rad * 1.25, 0], [rad * 1.25, 0.05], [rad * 0.9, 0.08], [rad * 0.85, 0.5], [rad * 1.0, 0.56], [0, 0.56]], 24), m.marble));
      const urn = phys('#3d6f8a', { roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.08 });
      g.add(mesh(B.lathe([[0.001, 0.56], [rad * 0.55, 0.56], [rad * 0.95, 0.68], [rad * 1.05, 0.82], [rad * 0.8, 0.98], [rad * 0.52, 1.04], [rad * 0.7, 1.1], [rad * 0.62, 1.12], [rad * 0.5, 1.06]], 28), urn));
      g.add(mesh(new THREE.TorusGeometry(rad * 0.98, 0.012, 6, 28), m.gold, 0, 0.8, 0, false).rotateX(Math.PI / 2));
      const f = this.leaf('urn', '#2f7a34', '#8fd06c');
      for (let i = 0; i < 6; i++) { const b = leafyBlob(0.07 + r() * 0.04, f, i + 40, 1); b.position.set((r() - 0.5) * 0.15, 1.12 + r() * 0.06, (r() - 0.5) * 0.15); b.castShadow = true; g.add(b); }
    } else if (o.art === 'fountain') {
      const R = M(o.r);
      const stone = m.stone;
      g.add(mesh(B.lathe([[0, 0], [R, 0], [R, 0.12], [R * 0.97, 0.16], [R * 0.9, 0.2], [R * 0.9, 0.14], [0, 0.14]], 48), stone));
      g.add(mesh(new THREE.CylinderGeometry(R * 0.89, R * 0.89, 0.02, 48), m.water, 0, 0.14, 0, false));
      g.add(mesh(B.lathe([[0.001, 0.14], [0.14, 0.14], [0.16, 0.24], [0.11, 0.34], [0.08, 0.48], [0.22, 0.56], [0.3, 0.62], [0.26, 0.64], [0.2, 0.6], [0.001, 0.58]], 28), stone));
      g.add(mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.014, 32), m.water, 0, 0.63, 0, false));
      // the jet: droplets on parabolic arcs (deterministic in t)
      const dropG = new THREE.SphereGeometry(0.014, 6, 5), dropM = std('#dff6ff', { roughness: 0.1, emissive: '#9ad7ee', emissiveIntensity: 0.5, transparent: true, opacity: 0.85 });
      const drops = []; for (let i = 0; i < 26; i++) { const d = new THREE.Mesh(dropG, dropM); d.castShadow = false; g.add(d); drops.push(d); }
      // ripples on the basin
      const rings = []; for (let i = 0; i < 3; i++) { const rg = new THREE.Mesh(new THREE.RingGeometry(0.97, 1, 48), new THREE.MeshBasicMaterial({ color: '#e8fbff', transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide })); rg.rotation.x = -Math.PI / 2; rg.position.y = 0.155; g.add(rg); rings.push(rg); }
      this.anim.push((t) => {
        drops.forEach((d, i) => {
          const ph = ((t * 0.9 + i / drops.length) % 1), ang = (i * 2.399) % TAU, out = 0.05 + 0.34 * (i % 5) / 5 + 0.05;
          const rr = out * Math.sin(ph * Math.PI * 0.5 + 0.1) * 1.4;
          d.position.set(Math.cos(ang) * rr, 0.66 + 0.7 * (4 * ph * (1 - ph)) * (0.7 + 0.3 * ((i * 7) % 5) / 5) - (i % 3) * 0.02, Math.sin(ang) * rr);
        });
        rings.forEach((rg, i) => { const k = ((t * 0.35 + i / 3) % 1); const s = R * (0.18 + 0.7 * k); rg.scale.set(s, s, s); rg.material.opacity = 0.5 * (1 - k); });
      });
    } else if (o.art === 'hedge') {
      const hh = 0.5, mat = this.leaf('hedge', '#2b5a2c', '#7ec26a');
      const geo = new THREE.BoxGeometry(w, hh, d, Math.max(6, Math.round(w * 9)), 5, 3), p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        const cx0 = Math.max(0, Math.abs(x) - (w / 2 - 0.06)) + Math.max(0, Math.abs(z) - (d / 2 - 0.06));   // round the vertical edges
        const nz = (Math.sin(x * 55 + z * 31) + Math.sin(x * 23 - y * 40)) * 0.012;
        p.setXYZ(i, x - Math.sign(x) * cx0 * 0.4 + nz, y + (y > 0 ? nz * 1.5 : 0), z - Math.sign(z) * cx0 * 0.4 + nz);
      }
      geo.computeVertexNormals();
      g.add(mesh(geo, mat, 0, hh / 2 + 0.1, 0));
      g.add(mesh(new THREE.BoxGeometry(w * 0.9, 0.1, d * 0.8), m.dark, 0, 0.05, 0));
    } else if (o.art === 'bench') {
      const left = cx < 500 ? -1 : 1;
      for (let i = 0; i < 4; i++) g.add(mesh(B.roundedBox(w, 0.025, d / 4 - 0.015, 0.008), m.wood, 0, 0.42, -d / 2 + (i + 0.5) * (d / 4)));
      g.add(mesh(B.roundedBox(0.04, 0.4, d, 0.012), m.wood, left * (w / 2 - 0.02), 0.58, 0).rotateZ(left * 0.12));
      for (const sz of [-1, 1]) g.add(mesh(B.roundedBox(w * 0.9, 0.04, 0.05, 0.01), std('#2b2b30', { roughness: 0.5, metalness: 0.6 }), 0, 0.2, sz * (d / 2 - 0.05)));
      for (const sz of [-1, 1]) for (const sx of [-1, 1]) g.add(mesh(new THREE.BoxGeometry(0.04, 0.4, 0.04), std('#2b2b30', { roughness: 0.5, metalness: 0.6 }), sx * (w / 2 - 0.04), 0.2, sz * (d / 2 - 0.05)));
    } else if (o.art === 'planters') {
      g.add(mesh(B.roundedBox(w, 0.3, d, 0.04), m.terracotta, 0, 0.15, 0));
      g.add(mesh(new THREE.BoxGeometry(w - 0.06, 0.02, d - 0.06), std('#3a2412', { roughness: 1 }), 0, 0.3, 0, false));
      const n = Math.max(4, Math.floor(w / 0.5)), f = this.leaf('orange', '#2d6a2f', '#a6e07a');
      for (let i = 0; i < n; i++) {
        const x = -w / 2 + (i + 0.5) * (w / n);
        const b = leafyBlob(0.17, f, 100 + i, 2, 0.9); b.position.set(x, 0.46, (r() - 0.5) * 0.03); b.castShadow = true; g.add(b);
        for (let k = 0; k < 3; k++) { const a = k * 2.1 + i; g.add(mesh(new THREE.SphereGeometry(0.036, 10, 8), std('#ff9b2a', { roughness: 0.45 }), x + Math.cos(a) * 0.12, 0.5 + Math.sin(a * 1.7) * 0.05, Math.sin(a) * 0.1, false)); }
      }
    } else if (o.art === 'tree') {
      const R = M(o.r);
      g.add(mesh(B.lathe([[0, 0], [R * 0.7, 0], [R * 0.9, 0.04], [R * 1.0, 0.3], [R * 1.05, 0.34], [R * 0.9, 0.34], [0, 0.3]], 28), m.terracotta));
      g.add(mesh(new THREE.CylinderGeometry(0.03, 0.045, 0.45, 8), m.dark, 0, 0.55, 0));
      const f = this.leaf('orange', '#2d6a2f', '#a6e07a');
      const crown = new THREE.Group(); crown.position.set(0, 0.95, 0);
      for (let i = 0; i < 6; i++) { const a = i * 1.047, b = leafyBlob(0.17 + (i % 2) * 0.03, f, 200 + i + (o.x | 0), 2); b.position.set(Math.cos(a) * 0.13, (i % 3) * 0.05, Math.sin(a) * 0.13); b.castShadow = true; crown.add(b); }
      const top = leafyBlob(0.2, f, 255, 2); top.position.set(0, 0.12, 0); top.castShadow = true; crown.add(top);
      for (let k = 0; k < 6; k++) { const a = k * 1.1 + o.y; crown.add(mesh(new THREE.SphereGeometry(0.036, 10, 8), std('#ff9b2a', { roughness: 0.45 }), Math.cos(a) * 0.27, 0.02 + (k % 3) * 0.06, Math.sin(a) * 0.27, false)); }
      g.add(crown);
      this.anim.push((t) => { crown.rotation.z = Math.sin(t * 0.9 + o.x) * 0.012; crown.rotation.x = Math.cos(t * 0.7 + o.y) * 0.012; });
    } else if (o.art === 'column') {
      const R = M(o.r), hh = 1.05;
      g.add(mesh(B.lathe([[0, 0], [R * 1.5, 0], [R * 1.5, 0.08], [R * 1.25, 0.12], [R * 1.05, 0.16], [R * 0.9, 0.2], [R * 0.86, hh - 0.14], [R * 1.1, hh - 0.1], [R * 1.3, hh - 0.05], [R * 1.5, hh - 0.02], [R * 1.5, hh], [0, hh]], 32), m.marble));
      g.add(mesh(new THREE.TorusGeometry(R * 0.9, 0.012, 6, 28), m.gold, 0, 0.2, 0, false).rotateX(Math.PI / 2));
      this.candle(g, 0, hh, 0, 0.22, false);
      g.add(mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.012, 14), m.brass, 0, hh + 0.006, 0, false));
    } else if (o.art === 'stage') {
      const hh = 0.28;
      g.add(mesh(B.roundedBox(w, hh, d, 0.02), m.wood, 0, hh / 2, 0));
      g.add(mesh(new THREE.BoxGeometry(w + 0.02, 0.07, 0.02), this.mat.curtain, 0, hh - 0.04, d / 2 + 0.0, false));
      g.add(mesh(new THREE.BoxGeometry(w + 0.06, 0.012, d + 0.06), m.gold, 0, 0.006, 0, false));
      // a backdrop curtain with folds
      const cg = new THREE.PlaneGeometry(w, 0.6, 48, 1), cp = cg.attributes.position;
      for (let i = 0; i < cp.count; i++) cp.setZ(i, Math.sin(cp.getX(i) * 22) * 0.025);
      cg.computeVertexNormals();
      const cur = new THREE.Mesh(cg, velvet('#7a1730')); cur.material.side = THREE.DoubleSide; cur.position.set(0, hh + 0.3, -d / 2 + 0.03); cur.castShadow = true; g.add(cur);
      this.candelabra(g, -w / 2 + 0.15, 0.0, false, 0.5).position.y = hh;
      this.candelabra(g, w / 2 - 0.15, 0.0, false, 0.5).position.y = hh;
    } else {
      g.add(mesh(new THREE.BoxGeometry(w, 0.4, d), std('#6d5a4a'), 0, 0.2, 0));
    }
    g.userData.art = o.art;
    return g;
  }
}


// ---- walls (only the title hero camera sees them; the play camera looks straight past them) ------------------------------------------
function damask(N = 512, bg = '#4a1b33', fg = '#7a3552') {
  const c = cvs(N), g = c.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, N, N);
  const T = N / 4;
  for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) {
    const cx = x * T + (y % 2 ? T / 2 : 0), cy = y * T;
    g.fillStyle = fg; g.beginPath(); g.ellipse(cx, cy, T * 0.2, T * 0.34, 0, 0, TAU); g.fill();
    g.fillStyle = bg; g.beginPath(); g.ellipse(cx, cy, T * 0.09, T * 0.2, 0, 0, TAU); g.fill();
    g.strokeStyle = fg; g.lineWidth = 3; g.beginPath(); g.arc(cx, cy + T * 0.34, T * 0.12, 0, Math.PI); g.stroke();
    g.beginPath(); g.arc(cx, cy - T * 0.34, T * 0.12, Math.PI, TAU); g.stroke();
  }
  return c;
}
function paintingMap(seed, N = 128) {
  const c = cvs(N, Math.round(N * 1.25)), g = c.getContext('2d'), r = rng(seed);
  const lg = g.createLinearGradient(0, 0, 0, c.height); lg.addColorStop(0, '#6b5a3a'); lg.addColorStop(1, '#2c2418');
  g.fillStyle = lg; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = '#cdb590'; g.beginPath(); g.ellipse(c.width / 2, c.height * 0.4, c.width * 0.15, c.height * 0.14, 0, 0, TAU); g.fill();
  g.fillStyle = `rgb(${60 + r() * 60},${30 + r() * 40},${40 + r() * 40})`; g.beginPath(); g.moveTo(c.width * 0.2, c.height); g.quadraticCurveTo(c.width * 0.5, c.height * 0.5, c.width * 0.8, c.height); g.fill();
  return c;
}
function addWalls(group, kit, venue, R) {
  const walls = new THREE.Group(); walls.name = 'walls'; walls.visible = false;
  const H = 3.3;
  const paper = new THREE.MeshStandardMaterial({ map: tex(damask(512), { rep: [3.4, 1.2], aniso: 8 }), roughness: 0.85, metalness: 0 });
  const back = new THREE.Mesh(new THREE.PlaneGeometry(R * 2 + 0.2, H), paper); back.position.set(0, H / 2, -R); back.receiveShadow = true; walls.add(back);
  for (const sx of [-1, 1]) {
    const side = new THREE.Mesh(new THREE.PlaneGeometry(R * 2, H), paper); side.rotation.y = -sx * Math.PI / 2; side.position.set(sx * R, H / 2, 0); side.receiveShadow = true; walls.add(side);
    // wainscot panel and chair rail on the side walls
    walls.add(mesh(new THREE.BoxGeometry(0.06, 0.95, R * 2), kit.mat.dark, sx * (R - 0.03), 0.475, 0));
    walls.add(mesh(new THREE.BoxGeometry(0.1, 0.05, R * 2), kit.mat.gold, sx * (R - 0.05), 0.97, 0, false));
  }
  walls.add(mesh(new THREE.BoxGeometry(R * 2, 0.95, 0.06), kit.mat.dark, 0, 0.475, -R + 0.03));
  walls.add(mesh(new THREE.BoxGeometry(R * 2, 0.05, 0.1), kit.mat.gold, 0, 0.97, -R + 0.05, false));
  walls.add(mesh(new THREE.BoxGeometry(R * 2 + 0.2, 0.18, 0.14), kit.mat.cream, 0, H - 0.09, -R + 0.05));      // cornice
  // tall windows with the night sky and moonlight
  const sky = (() => { const c = cvs(64, 128), g = c.getContext('2d'), lg = g.createLinearGradient(0, 0, 0, 128); lg.addColorStop(0, '#0b1230'); lg.addColorStop(1, '#2c4a86'); g.fillStyle = lg; g.fillRect(0, 0, 64, 128); g.fillStyle = '#fff'; for (let i = 0; i < 14; i++) g.fillRect((i * 37) % 64, (i * 53) % 90, 1.5, 1.5); return tex(c); })();
  const win = (x, z, ry) => {
    const w = new THREE.Group(); w.position.set(x, 1.95, z); w.rotation.y = ry;
    w.add(new THREE.Mesh(new THREE.PlaneGeometry(0.95, 1.9), new THREE.MeshBasicMaterial({ map: sky })));
    w.add(mesh(new THREE.BoxGeometry(1.1, 0.07, 0.08), kit.mat.cream, 0, 0.99, 0.02, false)); w.add(mesh(new THREE.BoxGeometry(1.1, 0.07, 0.08), kit.mat.cream, 0, -0.99, 0.02, false));
    for (const sx of [-1, 1]) w.add(mesh(new THREE.BoxGeometry(0.07, 2.0, 0.08), kit.mat.cream, sx * 0.52, 0, 0.02, false));
    w.add(mesh(new THREE.BoxGeometry(0.03, 1.9, 0.04), kit.mat.cream, 0, 0, 0.02, false)); w.add(mesh(new THREE.BoxGeometry(0.95, 0.03, 0.04), kit.mat.cream, 0, 0.2, 0.02, false));
    for (const sx of [-1, 1]) { const cu = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 2.1, 10, 1), velvet('#6a1530')); cu.material.side = THREE.DoubleSide; cu.position.set(sx * 0.62, 0.0, 0.07); const p = cu.geometry.attributes.position; for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 40 + p.getY(i) * 2) * 0.03); cu.geometry.computeVertexNormals(); w.add(cu); }
    walls.add(w);
  };
  win(-1.7, -R + 0.03, 0); win(1.7, -R + 0.03, 0);
  win(-R + 0.03, -0.8, Math.PI / 2); win(R - 0.03, -0.8, -Math.PI / 2);
  // portraits
  [[-0.0, -R + 0.04, 0, 1], [-R + 0.04, 1.4, Math.PI / 2, 2], [R - 0.04, 1.4, -Math.PI / 2, 3]].forEach(([x, z, ry, sd]) => {
    const g = new THREE.Group(); g.position.set(x, 2.1, z); g.rotation.y = ry;
    g.add(mesh(new THREE.BoxGeometry(0.62, 0.78, 0.05), kit.mat.gold, 0, 0, 0, false));
    g.add(new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.66), new THREE.MeshStandardMaterial({ map: tex(paintingMap(sd * 17)), roughness: 0.7 }))); g.children[1].position.z = 0.03;
    walls.add(g);
  });
  // wall sconces with candles
  [[-2.7, -R + 0.1], [2.7, -R + 0.1], [0, -R + 0.1]].forEach(([x, z], i) => {
    const g = new THREE.Group(); g.position.set(x, 1.7, z);
    g.add(mesh(new THREE.BoxGeometry(0.1, 0.14, 0.04), kit.mat.brass, 0, 0, -0.04, false));
    g.add(mesh(new THREE.CylinderGeometry(0.035, 0.025, 0.04, 12), kit.mat.brass, 0, 0, 0.0, false).rotateX(Math.PI / 2));
    kit.candle(g, 0, 0.0, 0.0, 0.11, false);
    if (i === 2) { g.visible = false; }
    walls.add(g);
  });
  group.add(walls);
  return walls;
}

// ---- a whole room ----------------------------------------------------------------------------------------------------------------------
export function buildRoom(venue, { quality = 'medium' } = {}) {
  const kit = new RoomKit();
  const group = new THREE.Group(); group.name = `room-${venue.id}`;
  const R = 500 / UPM;
  // floor
  const fm = floorMaps(venue.floor);
  const glossy = venue.floor === 'parquet' || venue.floor === 'tiles' || venue.floor === 'marble';
  const floorMat = phys('#ffffff', {
    map: tex(fm.map, { aniso: 8 }), bumpMap: tex(fm.bump, { srgb: false, aniso: 4 }), bumpScale: venue.floor === 'gravel' ? 2.2 : 1.1,
    roughness: venue.floor === 'gravel' ? 1 : venue.floor === 'marble' ? 0.2 : 0.42, metalness: 0, clearcoat: glossy && quality !== 'low' ? 0.5 : 0, clearcoatRoughness: 0.25,
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(R * 2, R * 2), floorMat);
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; group.add(floor);
  if (venue.floor === 'parquet') {
    const rug = new THREE.Mesh(new THREE.BoxGeometry(M(480), 0.012, M(480)), [std('#7a1f3b'), std('#7a1f3b'), std('#ffffff', { map: tex(rugMap(512), { aniso: 8 }), roughness: 0.95, transparent: true }), std('#7a1f3b'), std('#7a1f3b'), std('#7a1f3b')]);
    rug.position.y = 0.006; rug.receiveShadow = true; group.add(rug);
  }
  // skirting and the gilt moulding round the edge
  const E = 0.16, wallM = B.material('darkWood');
  for (const [x, z, w, d] of [[0, -R + E / 2, R * 2, E], [0, R - E / 2, R * 2, E], [-R + E / 2, 0, E, R * 2], [R - E / 2, 0, E, R * 2]]) {
    group.add(mesh(B.roundedBox(w, 0.16, d, 0.025), wallM, x, 0.08, z));
    group.add(mesh(new THREE.BoxGeometry(w > d ? w : 0.014, 0.012, w > d ? 0.014 : d), kit.mat.gold, x + (w > d ? 0 : Math.sign(x) * -E * 0.25), 0.165, z + (w > d ? Math.sign(z) * -E * 0.25 : 0), false));
  }
  // props
  for (const o of venue.obstacles) group.add(kit.build(o));
  // corner candelabra
  const lightsWanted = quality === 'low' ? 0 : quality === 'medium' ? 3 : 4;
  const corners = venue.floor === 'gravel' ? [] : [[-1, -1], [1, -1], [-1, 1], [1, 1]];
  corners.forEach(([sx, sz], i) => kit.candelabra(group, sx * (R - 0.38), sz * (R - 0.38), i < lightsWanted, venue.floor === 'marble' ? 1.0 : 0.85));
  if (venue.floor === 'gravel') {
    // garden lanterns on short posts instead
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sz], i) => {
      const L = new THREE.Group(); L.position.set(sx * (R - 0.4), 0, sz * (R - 0.4));
      L.add(mesh(B.lathe([[0, 0], [0.08, 0], [0.05, 0.06], [0.03, 0.2], [0.025, 0.7], [0.05, 0.74]], 12), kit.mat.brass));
      L.add(mesh(new THREE.BoxGeometry(0.16, 0.2, 0.16), phys('#ffe6b4', { roughness: 0.2, transparent: true, opacity: 0.45, emissive: '#ffb860', emissiveIntensity: 0.9 }), 0, 0.85, 0, false));
      kit.flame(L, 0, 0.8, 0, 0.12, i < lightsWanted);
      L.add(mesh(new THREE.CylinderGeometry(0, 0.13, 0.1, 4), kit.mat.brass, 0, 1.0, 0, false).rotateY(Math.PI / 4));
      group.add(L);
    });
  }
  // warm light pools (cheap decals; they are the whole candle look on the low tier)
  const poolM = new THREE.MeshBasicMaterial({ map: poolTex(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 4.6), poolM); p.rotation.x = -Math.PI / 2; p.position.set(sx * (R - 0.38), 0.014, sz * (R - 0.38)); p.renderOrder = 2; group.add(p);
  }
  // dust motes drifting through the candle light
  let motes = null;
  if (quality !== 'low') {
    const n = 38, pos = new Float32Array(n * 3), r = rng(5);
    for (let i = 0; i < n; i++) pos.set([(r() - 0.5) * R * 2, 0.3 + r() * 1.6, (r() - 0.5) * R * 2], i * 3);
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    motes = new THREE.Points(geo, new THREE.PointsMaterial({ color: '#ffe2a8', size: 0.028, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }));
    motes.userData.base = pos.slice();
    group.add(motes);
  }
  const walls = venue.id === 'salon' ? addWalls(group, kit, venue, R) : null;
  const api = {
    group, kit, walls, floor: venue.floor,
    update(t) {
      for (const f of kit.flames) {
        const fl = 0.88 + 0.08 * Math.sin(t * 13 + f.phase) + 0.05 * Math.sin(t * 29 + f.phase * 2.3) + 0.03 * Math.sin(t * 7.3 + f.phase * 4);
        f.sprite.scale.set(f.size * (0.92 + (fl - 0.88) * 1.4), f.size * 1.5 * fl * 1.15, 1);
        f.sprite.material.opacity = 0.75 + 0.25 * fl;
        if (f.light) f.light.intensity = f.base * fl;
      }
      for (const a of kit.anim) a(t);
      if (motes) {
        const p = motes.geometry.attributes.position, b = motes.userData.base;
        for (let i = 0; i < p.count; i++) p.setXYZ(i, b[i * 3] + Math.sin(t * 0.21 + i) * 0.18, b[i * 3 + 1] + Math.sin(t * 0.33 + i * 1.7) * 0.1, b[i * 3 + 2] + Math.cos(t * 0.17 + i * 0.6) * 0.18);
        p.needsUpdate = true;
      }
    },
    dispose() { group.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); },
  };
  return api;
}

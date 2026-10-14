// The medieval piazza the show is performed in: herringbone brick with a stone medallion, a brick palazzo with an arcade and a tower,
// a crenellated parapet, hanging banners (cloth), bunting, torches with flickering flames and a stepped crowd platform.
// Everything is procedural (canvas textures, primitives): no image files. Pure presentation.
import { THREE } from '../vendor3d/index.js';
import { createCloth, flagTexture } from './cloth.js';
import { DESIGNS, paintDesign } from '../src/art.js';

const TAU = Math.PI * 2;
const rng = (seed) => { let s = seed >>> 0 || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
const cv = (w, h) => { const c = globalThis.document.createElement('canvas'); c.width = w; c.height = h; return c; };
const tex = (c, { repeat, srgb = true, aniso = 4 } = {}) => {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  t.anisotropy = aniso;
  return t;
};
const speckle = (g, w, h, r, n, a0 = 0.04, a1 = 0.1, light = false) => {
  for (let i = 0; i < n; i++) {
    g.fillStyle = light ? `rgba(255,240,210,${a0 + r() * (a1 - a0)})` : `rgba(30,18,8,${a0 + r() * (a1 - a0)})`;
    g.fillRect(r() * w, r() * h, 1 + r() * 3, 1 + r() * 2.2);
  }
};

// ---- textures ------------------------------------------------------------------------------------------------------------------------------
function brickFloor() {
  const S = 1024, c = cv(S, S), g = c.getContext('2d'), r = rng(11);
  g.fillStyle = '#7c4a32'; g.fillRect(0, 0, S, S);
  // herringbone: bricks 24 x 8 cells (the tile spans 4 m: brick about 0.2 x 0.07 m)
  const bw = 52, bh = 17;
  const cols = ['#a4573a', '#b3643f', '#9a4e35', '#bb7048', '#8c4a34', '#a85f3c'];
  for (let y = -bh; y < S + bh; y += bh) for (let x = -bw; x < S + bw; x += bw) {
    const k = (Math.round(y / bh) + Math.round(x / bw)) % 2;
    const px = x + (Math.round(y / bh) % 2 ? bw / 2 : 0);
    const col = cols[(r() * cols.length) | 0];
    g.fillStyle = col;
    g.save(); g.translate(px + bw / 2, y + bh / 2); g.rotate(k ? Math.PI / 4 : -Math.PI / 4);
    g.fillRect(-bw / 2 + 1, -bh / 2 + 1, bw - 2, bh - 2);
    g.fillStyle = `rgba(255,220,170,${0.05 + r() * 0.08})`; g.fillRect(-bw / 2 + 2, -bh / 2 + 2, bw - 4, 3);
    g.restore();
  }
  // travertine bands every metre
  g.fillStyle = 'rgba(224,206,170,0.95)';
  for (let i = 0; i < 4; i++) { g.fillRect(0, i * 256 - 4, S, 8); g.fillRect(i * 256 - 4, 0, 8, S); }
  g.fillStyle = 'rgba(90,60,40,0.4)';
  for (let i = 0; i < 4; i++) { g.fillRect(0, i * 256 + 4, S, 2); g.fillRect(i * 256 + 4, 0, 2, S); }
  speckle(g, S, S, r, 2600, 0.05, 0.16);
  speckle(g, S, S, r, 900, 0.03, 0.09, true);
  return c;
}
function medallionTex() {
  const S = 1024, c = cv(S, S), g = c.getContext('2d'), r = rng(5);
  g.clearRect(0, 0, S, S);
  const cx = S / 2, R = S / 2 - 4;
  const ring = (r0, r1, fill, line) => { g.beginPath(); g.arc(cx, cx, r1, 0, TAU); g.arc(cx, cx, r0, 0, TAU, true); g.fillStyle = fill; g.fill(); if (line) { g.strokeStyle = line; g.lineWidth = 3; g.beginPath(); g.arc(cx, cx, r1, 0, TAU); g.stroke(); g.beginPath(); g.arc(cx, cx, r0, 0, TAU); g.stroke(); } };
  // outer travertine ring with a dark banding
  ring(R * 0.9, R, '#d9c9a2', 'rgba(70,50,30,0.7)');
  ring(R * 0.935, R * 0.965, '#8a3a2a', null);
  // radial segments (nine, like a fan of marble) between the rings
  g.save(); g.translate(cx, cx);
  for (let i = 0; i < 9; i++) {
    g.rotate(TAU / 9);
    g.fillStyle = 'rgba(224,206,170,0.9)'; g.fillRect(-4, R * 0.18, 8, R * 0.72);
    g.fillStyle = 'rgba(70,50,30,0.55)'; g.fillRect(4, R * 0.18, 2, R * 0.72);
  }
  g.restore();
  ring(R * 0.17, R * 0.2, '#d9c9a2', 'rgba(70,50,30,0.7)');
  // a six-pointed rose at the centre in stone and brick
  g.save(); g.translate(cx, cx);
  for (let i = 0; i < 12; i++) { g.rotate(TAU / 12); g.fillStyle = i % 2 ? '#b8683f' : '#e2d2ac'; g.beginPath(); g.moveTo(0, 0); g.lineTo(R * 0.045, R * 0.16); g.lineTo(0, R * 0.19); g.lineTo(-R * 0.045, R * 0.16); g.closePath(); g.fill(); }
  g.restore();
  // soft transparency toward the edge so the rim is not a hard disc on the brick
  g.globalCompositeOperation = 'destination-in';
  const gr = g.createRadialGradient(cx, cx, R * 0.82, cx, cx, R);
  gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.9, 'rgba(0,0,0,0.95)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, S, S);
  speckle(g, S, S, r, 0, 0, 0);
  return c;
}

// a palazzo front: floors x bays, ground arcade, biforate windows with shutters, stone string courses
function facadeTex({ seed = 1, wall = '#b5573a', trim = '#e6d3a8', floors = 3, bays = 3, W = 1024, H = 1536, shutter = '#3f5a3c', lit = 0.35 } = {}) {
  const c = cv(W, H), g = c.getContext('2d'), r = rng(seed);
  const bw = W / bays;
  const gh = H * 0.34, fh = (H - gh) / (floors - 1);
  // plaster / brick
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, shade(wall, 1.06)); gr.addColorStop(1, shade(wall, 0.86));
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  // brick courses
  g.strokeStyle = 'rgba(30,12,4,0.16)'; g.lineWidth = 1;
  for (let y = 0; y < H; y += 9) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
  for (let y = 0; y < H; y += 9) for (let x = (y / 9) % 2 ? 0 : 14; x < W; x += 28) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 9); g.stroke(); }
  speckle(g, W, H, r, 5200, 0.04, 0.14);
  speckle(g, W, H, r, 1600, 0.04, 0.1, true);
  // wear: darker streaks under the ledges are added per floor below
  const arch = (x, y, w, h, fill, line) => { g.beginPath(); g.moveTo(x, y + h); g.lineTo(x, y + w / 2); g.arc(x + w / 2, y + w / 2, w / 2, Math.PI, 0); g.lineTo(x + w, y + h); g.closePath(); if (fill) { g.fillStyle = fill; g.fill(); } if (line) { g.strokeStyle = line; g.stroke(); } };
  // upper floors
  for (let f = 0; f < floors - 1; f++) {
    const y0 = f * fh, wy = y0 + fh * 0.2, wh = fh * 0.58;
    for (let b = 0; b < bays; b++) {
      const cx = b * bw + bw / 2, ww = bw * 0.46, x = cx - ww / 2;
      // stone frame
      g.lineWidth = 7; arch(x - 4, wy - 4, ww + 8, wh + 8, trim, 'rgba(60,40,20,0.5)');
      const litOn = r() < lit;
      const fillG = g.createLinearGradient(0, wy, 0, wy + wh); fillG.addColorStop(0, litOn ? '#ffd27a' : '#23272f'); fillG.addColorStop(1, litOn ? '#c47a2a' : '#0e1016');
      arch(x, wy, ww, wh, fillG, null);
      // two lights with a slim column and arches, mullion shadow
      g.fillStyle = trim; g.fillRect(cx - 4, wy + ww * 0.22, 8, wh - ww * 0.22);
      g.strokeStyle = trim; g.lineWidth = 5; g.beginPath(); g.arc(cx - ww / 4, wy + ww * 0.34, ww * 0.2, Math.PI, 0); g.arc(cx + ww / 4, wy + ww * 0.34, ww * 0.2, Math.PI, 0); g.stroke();
      // shutters, one or both open
      if (r() < 0.6) { g.fillStyle = shutter; g.fillRect(x - ww * 0.3, wy + ww * 0.1, ww * 0.26, wh * 0.9); g.fillRect(x + ww + ww * 0.04, wy + ww * 0.1, ww * 0.26, wh * 0.9);
        g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 2; for (let k = 1; k < 9; k++) { const yy = wy + ww * 0.1 + wh * 0.9 * k / 9; g.beginPath(); g.moveTo(x - ww * 0.3, yy); g.lineTo(x - ww * 0.04, yy); g.moveTo(x + ww * 1.04, yy); g.lineTo(x + ww * 1.3, yy); g.stroke(); } }
      // sill with flower box
      g.fillStyle = trim; g.fillRect(x - 10, wy + wh + 4, ww + 20, 10);
      if (r() < 0.45) { g.fillStyle = '#5a3a20'; g.fillRect(x - 4, wy + wh - 10, ww + 8, 14); for (let k = 0; k < 9; k++) { g.fillStyle = ['#c0262f', '#e6a0b0', '#f2c14e', '#e8e0d0'][(r() * 4) | 0]; g.beginPath(); g.arc(x + (k + 0.5) * (ww + 8) / 9, wy + wh - 12 - r() * 8, 4 + r() * 3, 0, TAU); g.fill(); g.fillStyle = '#3f6a2d'; g.fillRect(x + (k + 0.5) * (ww + 8) / 9 - 2, wy + wh - 10, 4, 6); } }
      // dark drip under the sill
      const dr = g.createLinearGradient(0, wy + wh + 14, 0, wy + wh + 80); dr.addColorStop(0, 'rgba(20,8,0,0.28)'); dr.addColorStop(1, 'rgba(20,8,0,0)');
      g.fillStyle = dr; g.fillRect(x - 6, wy + wh + 14, ww + 12, 66);
    }
    // string course between floors
    g.fillStyle = trim; g.fillRect(0, y0 + fh - 14, W, 14);
    g.fillStyle = 'rgba(40,24,8,0.4)'; g.fillRect(0, y0 + fh, W, 5);
  }
  // ground arcade
  const gy = H - gh;
  const aw = bw * 0.78, ah = gh * 0.82;
  for (let b = 0; b < bays; b++) {
    const cx = b * bw + bw / 2, x = cx - aw / 2, y = H - ah;
    g.lineWidth = 12; arch(x - 8, y - 8, aw + 16, ah + 8, trim, 'rgba(60,40,20,0.55)');
    const ig = g.createLinearGradient(0, y, 0, H); ig.addColorStop(0, '#120a05'); ig.addColorStop(0.6, '#3a1d0e'); ig.addColorStop(1, '#8a5a30');
    arch(x, y, aw, ah, ig, null);
    // far end of the arcade glows warm (a lamp beyond)
    const lg = g.createRadialGradient(cx, y + ah * 0.55, 4, cx, y + ah * 0.55, aw * 0.34);
    lg.addColorStop(0, 'rgba(255,196,110,0.55)'); lg.addColorStop(1, 'rgba(255,196,110,0)');
    g.fillStyle = lg; g.fillRect(x, y, aw, ah);
    // keystone and column bases
    g.fillStyle = trim; g.fillRect(cx - 9, y - 12, 18, 22);
    g.fillRect(x - 16, H - 28, 22, 28); g.fillRect(x + aw - 6, H - 28, 22, 28);
  }
  g.fillStyle = trim; g.fillRect(0, gy - 14, W, 16);
  const dr = g.createLinearGradient(0, gy, 0, gy + 90); dr.addColorStop(0, 'rgba(20,8,0,0.4)'); dr.addColorStop(1, 'rgba(20,8,0,0)');
  g.fillStyle = dr; g.fillRect(0, gy + 2, W, 90);
  // grime near the ground
  const gm = g.createLinearGradient(0, H - 70, 0, H); gm.addColorStop(0, 'rgba(30,16,6,0)'); gm.addColorStop(1, 'rgba(30,16,6,0.4)');
  g.fillStyle = gm; g.fillRect(0, H - 70, W, 70);
  return c;
}
function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16), c = (s) => Math.max(0, Math.min(255, Math.round(((n >> s) & 255) * k)));
  return `rgb(${c(16)},${c(8)},${c(0)})`;
}
function towerTex() {
  const W = 256, H = 1024, c = cv(W, H), g = c.getContext('2d'), r = rng(9);
  const gr = g.createLinearGradient(0, 0, W, 0); gr.addColorStop(0, '#c7704a'); gr.addColorStop(0.5, '#d68558'); gr.addColorStop(1, '#a95a3a');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  g.strokeStyle = 'rgba(40,16,6,0.28)'; g.lineWidth = 1.5;
  for (let y = 0; y < H; y += 11) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); for (let x = (y / 11) % 2 ? 0 : 16; x < W; x += 32) { g.beginPath(); g.moveTo(x, y); g.lineTo(x, y + 11); g.stroke(); } }
  speckle(g, W, H, r, 3000, 0.05, 0.18);
  // slit windows, getting longer toward the top
  for (let i = 0; i < 6; i++) { const y = 80 + i * 150; g.fillStyle = '#1b0e08'; g.beginPath(); g.moveTo(W / 2 - 9, y + 54); g.lineTo(W / 2 - 9, y + 8); g.arc(W / 2, y + 8, 9, Math.PI, 0); g.lineTo(W / 2 + 9, y + 54); g.fill(); g.fillStyle = '#e6d3a8'; g.fillRect(W / 2 - 14, y + 54, 28, 6); }
  // an upper string course with small corbels
  g.fillStyle = '#e6d3a8'; g.fillRect(0, 36, W, 12);
  return c;
}
function skyTex() {
  const c = cv(8, 512), g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, 512);
  gr.addColorStop(0, '#2c4f93'); gr.addColorStop(0.35, '#5f8fcb'); gr.addColorStop(0.62, '#a9c6dd'); gr.addColorStop(0.85, '#f2d3a3'); gr.addColorStop(1, '#f6b97a');
  g.fillStyle = gr; g.fillRect(0, 0, 8, 512);
  return c;
}
function cloudTex() {
  const c = cv(256, 128), g = c.getContext('2d'), r = rng(3);
  for (let i = 0; i < 26; i++) {
    const x = 40 + r() * 176, y = 50 + r() * 28 - Math.abs(x - 128) * 0.1, rad = 14 + r() * 24;
    const gr = g.createRadialGradient(x, y, 1, x, y, rad); gr.addColorStop(0, 'rgba(255,248,236,0.55)'); gr.addColorStop(1, 'rgba(255,248,236,0)');
    g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  return c;
}
function flameTex() {
  const c = cv(64, 128), g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 84, 2, 32, 76, 52);
  gr.addColorStop(0, 'rgba(255,250,210,1)'); gr.addColorStop(0.25, 'rgba(255,200,90,0.95)'); gr.addColorStop(0.6, 'rgba(255,120,30,0.5)'); gr.addColorStop(1, 'rgba(255,60,0,0)');
  g.fillStyle = gr; g.beginPath(); g.moveTo(32, 2); g.bezierCurveTo(60, 50, 62, 90, 32, 126); g.bezierCurveTo(2, 90, 4, 50, 32, 2); g.fill();
  g.globalCompositeOperation = 'source-atop'; g.fillStyle = gr; g.fillRect(0, 0, 64, 128);
  return c;
}
function glowTex() {
  const c = cv(128, 128), g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 1, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,200,120,0.85)'); gr.addColorStop(0.35, 'rgba(255,150,60,0.28)'); gr.addColorStop(1, 'rgba(255,120,30,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  return c;
}
function drapeTex() {
  const W = 512, H = 256, c = cv(W, H), g = c.getContext('2d'), r = rng(21);
  const cols = [['#a8262e', '#7a1520'], ['#e9dcc0', '#c9b58e'], ['#244f9a', '#183670'], ['#e9dcc0', '#c9b58e']];
  const sw = W / 8;
  for (let i = 0; i < 8; i++) {
    const [a, b] = cols[i % 4];
    const gr = g.createLinearGradient(i * sw, 0, (i + 1) * sw, 0); gr.addColorStop(0, b); gr.addColorStop(0.5, a); gr.addColorStop(1, b);
    g.fillStyle = gr; g.fillRect(i * sw, 0, sw + 1, H);
  }
  // swags: scalloped upper edge in shadow, a gold fringe at the bottom
  g.fillStyle = 'rgba(20,6,0,0.35)';
  for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(i * W / 4, 0); g.quadraticCurveTo(i * W / 4 + W / 8, 70, (i + 1) * W / 4, 0); g.closePath(); g.fill(); }
  g.fillStyle = '#e3b24a'; g.fillRect(0, H - 22, W, 8);
  for (let x = 4; x < W; x += 9) { g.fillRect(x, H - 14, 3, 14); }
  speckle(g, W, H, r, 900, 0.03, 0.1);
  return c;
}
function woodTex(base = '#6a4326', seed = 2) {
  const c = cv(256, 256), g = c.getContext('2d'), r = rng(seed);
  g.fillStyle = base; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 70; i++) { g.strokeStyle = `rgba(${r() > 0.5 ? '255,220,170' : '20,10,4'},${0.04 + r() * 0.12})`; g.lineWidth = 1 + r() * 2; const y = r() * 256; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(80, y + r() * 8 - 4, 170, y + r() * 8 - 4, 256, y + r() * 6 - 3); g.stroke(); }
  g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 2; for (let x = 0; x <= 256; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 256); g.stroke(); }
  return c;
}

// ---- the piazza -----------------------------------------------------------------------------------------------------------------------------
export const BUNTING = ['#c0262f', '#f2c14e', '#2557a7', '#f8f1e0', '#2f8a5b', '#5b2a86'];

/**
 * buildPiazza({ quality }) -> { group, update(t, dt, o), banners, torchLights, stepsTop, dispose }
 * World: x right, y up, +z toward the camera. The performers stand at z = 0 (x within +-1.6 m). The back palazzo is at z = -12.
 */
export function buildPiazza({ quality = 'medium' } = {}) {
  const group = new THREE.Group(); group.name = 'piazza';
  const low = quality === 'low';
  const MAT = (o) => new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0, ...o });
  const disposables = [];
  const keep = (x) => { disposables.push(x); return x; };

  // sky dome and clouds
  const sky = new THREE.Mesh(new THREE.SphereGeometry(90, 24, 16), keep(new THREE.MeshBasicMaterial({ map: keep(tex(skyTex())), side: THREE.BackSide, fog: false, depthWrite: false })));
  sky.rotation.y = 0; sky.position.set(0, -6, -20); sky.renderOrder = -10;
  // the texture runs top (0) to bottom; map vertically over the dome: SphereGeometry u/v already go pole to pole
  group.add(sky);
  const clouds = [];
  for (let i = 0; i < 5; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(26 + i * 4, 9), keep(new THREE.MeshBasicMaterial({ map: keep(tex(cloudTex())), transparent: true, depthWrite: false, fog: false, opacity: 0.75 })));
    m.position.set(-30 + i * 17, 26 + (i % 3) * 5, -60 - i * 4); m.userData.sp = 0.12 + i * 0.03;
    group.add(m); clouds.push(m);
  }

  // floor
  const floorT = tex(brickFloor(), { repeat: [24, 24], aniso: low ? 2 : 8 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(96, 96), keep(MAT({ map: floorT, roughness: 0.82 })));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; floor.position.set(0, 0, -20);
  group.add(floor);
  const floorTex = floorT;
  const med = new THREE.Mesh(new THREE.CircleGeometry(4.3, 64), keep(MAT({ map: tex(medallionTex()), transparent: true, roughness: 0.75, depthWrite: false })));
  med.rotation.x = -Math.PI / 2; med.position.set(0, 0.004, -0.3); med.receiveShadow = true;
  group.add(med);

  // facades: back palazzo and two wings
  const wallA = tex(facadeTex({ seed: 4, wall: '#b95a3c', trim: '#e8d6ac', floors: 3, bays: 4, shutter: '#3f5a3c', lit: 0.4 }), { aniso: low ? 2 : 8, repeat: [6, 1] });
  const wallB = tex(facadeTex({ seed: 8, wall: '#d4a060', trim: '#efe3c0', floors: 3, bays: 4, shutter: '#6a2f26', lit: 0.3 }), { aniso: low ? 2 : 8, repeat: [5, 1] });
  const back = new THREE.Mesh(new THREE.BoxGeometry(48, 11, 1.2), [MAT({ color: 0xc08a60 }), MAT({ color: 0xc08a60 }), MAT({ color: 0x9a6a48 }), MAT({ color: 0x9a6a48 }), keep(MAT({ map: (wallA.repeat.set(6, 1), wallA), roughness: 0.92 })), MAT({ color: 0xb07a52 })]);
  back.position.set(0, 5.5, -12.6); back.receiveShadow = false; group.add(back);
  // parapet with swallow-tail merlons (Ghibelline), a shadowed cornice below
  const merlonMat = keep(MAT({ color: 0xd9b58a, roughness: 0.9 }));
  const cornice = new THREE.Mesh(new THREE.BoxGeometry(48.6, 0.5, 1.7), merlonMat); cornice.position.set(0, 10.9, -12.3); group.add(cornice);
  const merGeo = new THREE.BoxGeometry(0.7, 1.1, 0.5);
  const mers = new THREE.InstancedMesh(merGeo, merlonMat, 56);
  { const m = new THREE.Matrix4(); for (let i = 0; i < 56; i++) { m.makeTranslation(-24 + i * 0.87 + 0.4, 11.7, -12.1); mers.setMatrixAt(i, m); } }
  group.add(mers);
  for (const sx of [-1, 1]) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(1.2, 10, 20), [keep(MAT({ map: (wallB.repeat.set(5, 1), wallB), roughness: 0.92 })), MAT({ color: 0xa97a52 }), MAT({ color: 0xa97a52 }), MAT({ color: 0xa97a52 }), MAT({ color: 0xa97a52 }), MAT({ color: 0xa97a52 })]);
    wing.position.set(sx * 9.4, 5, -3.5); if (sx > 0) wing.rotation.y = Math.PI; group.add(wing);
  }

  // the tower: shaft, corbelled bell chamber with merlons, clock, spire
  const TW = 3.0, TH = 17, tx = -4.6, tz = -12.0;
  const towerMat = keep(MAT({ map: tex(towerTex(), { aniso: 4 }), roughness: 0.9 }));
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(TW, TH, TW), towerMat); shaft.position.set(tx, TH / 2, tz); group.add(shaft);
  const chamber = new THREE.Mesh(new THREE.BoxGeometry(TW * 1.35, 2.6, TW * 1.35), keep(MAT({ color: 0xc9855a }))); chamber.position.set(tx, TH + 1.3, tz); group.add(chamber);
  const corbel = new THREE.Mesh(new THREE.BoxGeometry(TW * 1.5, 0.45, TW * 1.5), merlonMat); corbel.position.set(tx, TH + 0.1, tz); group.add(corbel);
  const archMat = keep(MAT({ color: 0x1a0d07 }));
  for (const [ox, oz, ry] of [[0, TW * 0.68, 0], [TW * 0.68, 0, Math.PI / 2]]) {
    const a = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.12, 20, 1, false, 0, Math.PI), archMat);
    a.rotation.set(Math.PI / 2, 0, ry + Math.PI / 2); a.position.set(tx + ox, TH + 1.5, tz + oz); group.add(a);
    const b = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.0, 0.1), archMat); b.position.set(tx + ox, TH + 1.0, tz + oz); b.rotation.y = ry; group.add(b);
  }
  const clock = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.12, 36), keep(new THREE.MeshStandardMaterial({ color: 0xf1e6c8, roughness: 0.6 })));
  clock.rotation.x = Math.PI / 2; clock.position.set(tx, TH - 3.6, tz + TW / 2 + 0.07); group.add(clock);
  const hand = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.8, 0.05), keep(MAT({ color: 0x2a1a0a }))); hand.position.set(tx + 0.05, TH - 3.3, tz + TW / 2 + 0.16); hand.rotation.z = -0.4; group.add(hand);
  const hand2 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.55, 0.05), keep(MAT({ color: 0x2a1a0a }))); hand2.position.set(tx + 0.25, TH - 3.7, tz + TW / 2 + 0.16); hand2.rotation.z = 1.9; group.add(hand2);
  const mm = new THREE.InstancedMesh(new THREE.BoxGeometry(0.62, 0.9, 0.5), merlonMat, 24);
  { const m = new THREE.Matrix4(); const half = TW * 0.675; let i = 0; for (let s = 0; s < 4; s++) for (let k = 0; k < 6; k++) { const u = -half + (k + 0.5) * (2 * half / 6); const [x, z] = s === 0 ? [u, half] : s === 1 ? [half, u] : s === 2 ? [u, -half] : [-half, u]; m.makeTranslation(tx + x, TH + 3.05, tz + z); mm.setMatrixAt(i++, m); } }
  group.add(mm);
  const spire = new THREE.Mesh(new THREE.CylinderGeometry(0, TW * 0.78, 4.4, 4), keep(MAT({ color: 0x8e2f1d, roughness: 0.7 }))); spire.rotation.y = Math.PI / 4; spire.position.set(tx, TH + 5.1, tz); group.add(spire);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), keep(new THREE.MeshStandardMaterial({ color: 0xf0c050, metalness: 0.8, roughness: 0.3 }))); ball.position.set(tx, TH + 7.5, tz); group.add(ball);

  // the crowd platform: stepped timber arcs behind the performers (the crowd stands on them)
  const woodMat = keep(MAT({ map: tex(woodTex('#7a5030', 3), { repeat: [3, 1] }), roughness: 0.85 }));
  const drapeMat = keep(MAT({ map: tex(drapeTex(), { repeat: [7, 1] }), roughness: 0.85, side: THREE.DoubleSide }));
  const steps = [];
  const R0 = 5.4, GAP = 0.8, STEP = 0.26, ROWS = 3;
  const A0 = Math.PI * 0.5 + 0.12, ALEN = Math.PI * 1.0 - 0.24;
  const ringTop = (ri, ro, h, mat) => {
    const n = 40, pos = [], uvs = [], idx = [];
    for (let i = 0; i <= n; i++) {
      const a = A0 + ALEN * i / n, sn = Math.sin(a), cs = Math.cos(a);
      pos.push(ri * sn, h, SR_CZ + ri * cs, ro * sn, h, SR_CZ + ro * cs);
      uvs.push(i / n * 6, 0, i / n * 6, 1);
      if (i < n) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); g.setIndex(idx); g.computeVertexNormals();
    return new THREE.Mesh(g, mat);
  };
  const SR_CZ = -0.3;
  for (let r = 0; r < ROWS; r++) {
    const ri = R0 + r * GAP, ro = ri + GAP, h = (r + 1) * STEP;
    const riser = new THREE.Mesh(new THREE.CylinderGeometry(ri, ri, h, 48, 1, true, A0, ALEN), drapeMat);
    riser.position.set(0, h / 2, SR_CZ); group.add(riser); steps.push(riser);
    const top = ringTop(ri, ro, h, woodMat); top.receiveShadow = true; group.add(top); steps.push(top);
  }
  // a low timber barrier with posts in front of the first step
  const railMat = keep(MAT({ color: 0x5b3a20 }));
  const posts = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.05, 0.06, 1.0, 8), railMat, 22);
  { const m = new THREE.Matrix4(); for (let i = 0; i < 22; i++) { const a = Math.PI * 0.5 + 0.12 + (i / 21) * (Math.PI * 1.0 - 0.24); m.makeTranslation(Math.sin(a) * (R0 - 0.1), 0.5, -0.3 + Math.cos(a) * (R0 - 0.1)); posts.setMatrixAt(i, m); } }
  group.add(posts);
  const rail = new THREE.Mesh(new THREE.CylinderGeometry(R0 - 0.1, R0 - 0.1, 0.08, 48, 1, true, Math.PI * 0.5 + 0.12, Math.PI * 1.0 - 0.24), railMat);
  rail.position.set(0, 0.95, -0.3); group.add(rail);
  const rail2 = rail.clone(); rail2.position.y = 0.55; group.add(rail2);

  // banners: tall vertical standards hung from rods on the palazzo and the tower, in the generic heraldic designs
  const banners = [];
  const bannerPaint = (designIdx, w, h) => (g, cw, ch) => {
    // design painted upright (hoist across the top), then transposed so the long axis runs down the cloth
    const t = cv(ch, cw), tg = t.getContext('2d');
    paintDesign(tg, DESIGNS[designIdx % 8], ch, cw);
    g.setTransform(0, 1, 1, 0, 0, 0); g.drawImage(t, 0, 0); g.setTransform(1, 0, 0, 1, 0, 0);
    void w; void h;
  };
  const addBanner = (x, y, z, ry, designIdx, len = 2.4, wid = 0.85, seed = 1) => {
    const cl = createCloth({ seed, w: len, h: wid });
    const tx2 = flagTexture(`banner${designIdx}`, bannerPaint(designIdx, len, wid));
    cl.setDesign(tx2);
    cl.mesh.material.alphaTest = 0.4;
    const holder = new THREE.Group(); holder.position.set(x, y, z); holder.rotation.y = ry;
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, wid + 0.3, 8), keep(new THREE.MeshStandardMaterial({ color: 0x4a2f14, roughness: 0.7 })));
    rod.rotation.z = Math.PI / 2; holder.add(rod);
    for (const sx of [-1, 1]) { const f = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), keep(new THREE.MeshStandardMaterial({ color: 0xe3b24a, metalness: 0.8, roughness: 0.3 }))); f.position.x = sx * (wid / 2 + 0.16); holder.add(f); }
    group.add(holder);
    cl.mesh.userData = { holder, len, wid };
    group.add(cl.mesh);
    banners.push({ cl, holder, wid });
    return cl;
  };
  addBanner(-0.9, 10.5, -11.9, 0, 0, 3.4, 1.0, 1); addBanner(1.9, 10.5, -11.9, 0, 3, 3.4, 1.0, 2); addBanner(5.2, 10.5, -11.9, 0, 6, 3.4, 1.0, 3);
  addBanner(-7.4, 10.5, -11.9, 0, 5, 3.4, 1.0, 4); addBanner(-2.4, 6.4, -11.9, 0, 1, 2.4, 0.8, 5); addBanner(3.6, 6.4, -11.9, 0, 7, 2.4, 0.8, 6);
  addBanner(-8.5, 6.2, -6.5, Math.PI / 2, 2, 2.4, 0.8, 7); addBanner(8.5, 6.2, -6.5, -Math.PI / 2, 4, 2.4, 0.8, 8);

  // bunting: two garlands across the square, swaying triangles
  const bunting = [];
  const triGeo = new THREE.BufferGeometry();
  triGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-0.13, 0, 0, 0.13, 0, 0, 0, -0.34, 0]), 3));
  triGeo.computeVertexNormals();
  const garland = (x0, y0, z0, x1, y1, z1, sag, count, seed) => {
    const r = rng(seed);
    const pts = [];
    for (let i = 0; i <= 32; i++) { const u = i / 32; pts.push(new THREE.Vector3(x0 + (x1 - x0) * u, y0 + (y1 - y0) * u - Math.sin(u * Math.PI) * sag, z0 + (z1 - z0) * u)); }
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), keep(new THREE.LineBasicMaterial({ color: 0x3a2814 })));
    group.add(line);
    for (let i = 0; i < count; i++) {
      const u = (i + 0.5) / count, p = new THREE.Vector3(x0 + (x1 - x0) * u, y0 + (y1 - y0) * u - Math.sin(u * Math.PI) * sag, z0 + (z1 - z0) * u);
      const m = new THREE.Mesh(triGeo, keep(new THREE.MeshStandardMaterial({ color: new THREE.Color(BUNTING[(i + ((r() * 2) | 0)) % BUNTING.length]), side: THREE.DoubleSide, roughness: 0.7 })));
      m.position.copy(p); m.rotation.y = 0; group.add(m); bunting.push({ m, ph: r() * TAU, base: m.position.y });
    }
  };
  garland(-9, 8.2, -6.6, 9, 8.2, -6.6, 1.6, 34, 7);
  garland(-9, 5.6, -2.4, 9, 5.6, -2.4, 1.0, 30, 9);
  garland(-7, 7.4, -9.5, 7, 7.4, -9.5, 1.3, 28, 12);

  // torches on iron stands
  const torches = [];
  const flame = tex(flameTex(), { srgb: true }), glow = tex(glowTex(), { srgb: true });
  const iron = keep(new THREE.MeshStandardMaterial({ color: 0x1c1b1a, metalness: 0.7, roughness: 0.5 }));
  const addTorch = (x, z, seed) => {
    const g2 = new THREE.Group(); g2.position.set(x, 0, z);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 1.9, 8), iron); pole.position.y = 0.95; g2.add(pole);
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.26, 0.1, 12), iron); foot.position.y = 0.05; g2.add(foot);
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.08, 0.22, 12, 1, true), iron); cup.position.y = 1.95; cup.material.side = THREE.DoubleSide; g2.add(cup);
    const f = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: flame, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })));
    f.position.y = 2.2; f.scale.set(0.42, 0.7, 1); g2.add(f);
    const gl = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: glow, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })));
    gl.position.y = 2.25; gl.scale.set(2.6, 2.6, 1); g2.add(gl);
    let light = null;
    if (!low) { light = new THREE.PointLight(0xff9a40, 6, 7, 1.6); light.position.set(0, 2.2, 0.3); g2.add(light); }
    group.add(g2);
    torches.push({ f, gl, light, seed, g: g2 });
  };
  addTorch(-2.7, -1.1, 1); addTorch(2.7, -1.1, 2);

  // dust motes drifting in the low sun, and sparks rising from the torches
  const NM = low ? 40 : 110;
  const moteGeo = new THREE.BufferGeometry(), motePos = new Float32Array(NM * 3), moteSeed = [];
  { const r = rng(77); for (let i = 0; i < NM; i++) { motePos[i * 3] = (r() - 0.5) * 9; motePos[i * 3 + 1] = r() * 5; motePos[i * 3 + 2] = -r() * 9 + 2; moteSeed.push([r(), r(), r()]); } }
  moteGeo.setAttribute('position', new THREE.BufferAttribute(motePos, 3));
  const motes = new THREE.Points(moteGeo, keep(new THREE.PointsMaterial({ color: 0xffe3b0, size: 0.045, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })));
  motes.frustumCulled = false; group.add(motes);
  const NS = low ? 0 : 36;
  const sparkGeo = new THREE.BufferGeometry(), sparkPos = new Float32Array(Math.max(1, NS) * 3), sparkSeed = [];
  for (let i = 0; i < NS; i++) sparkSeed.push([i % 2 ? 1 : 0, i / NS * 3.1, 0.6 + (i * 0.37 % 1)]);
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
  const sparks = new THREE.Points(sparkGeo, keep(new THREE.PointsMaterial({ color: 0xffb040, size: 0.05, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })));
  sparks.frustumCulled = false; group.add(sparks);

  const api = {
    group, banners, torches, steps, floorTex, rails: [posts, rail, rail2],
    stepRows: { R0, GAP, STEP, ROWS, cz: -0.3 },
    update(t, dt, o = {}) {
      const calm = o.calm ? 0.4 : 1;
      for (const c of clouds) { c.position.x += c.userData.sp * dt; if (c.position.x > 70) c.position.x = -70; }
      for (const b of bunting) { b.m.rotation.z = Math.sin(t * 1.8 + b.ph) * 0.25 * calm; b.m.rotation.x = Math.sin(t * 1.3 + b.ph * 1.7) * 0.18 * calm; }
      for (const th of torches) {
        const fl = 0.85 + 0.15 * Math.sin(t * 17 + th.seed * 3) + 0.1 * Math.sin(t * 31 + th.seed) + (o.beat ?? 0) * 0.25;
        th.f.scale.set(0.38 + 0.06 * Math.sin(t * 13 + th.seed), 0.62 * fl + 0.1, 1);
        th.f.material.rotation = 0.08 * Math.sin(t * 9 + th.seed);
        th.gl.material.opacity = 0.55 + 0.25 * fl;
        if (th.light) th.light.intensity = 5 * fl + 1.5;
      }
      for (let i = 0; i < NM; i++) {
        const sd = moteSeed[i];
        motePos[i * 3] += (Math.sin(t * 0.3 + sd[0] * 20) * 0.05 + 0.03) * dt;
        motePos[i * 3 + 1] += (0.03 + 0.04 * sd[1]) * dt;
        if (motePos[i * 3 + 1] > 5.2) motePos[i * 3 + 1] = 0;
        if (motePos[i * 3] > 4.8) motePos[i * 3] = -4.8;
      }
      moteGeo.attributes.position.needsUpdate = true;
      for (let i = 0; i < NS; i++) {
        const sd = sparkSeed[i], tt = (t * 0.55 * sd[2] + sd[1]) % 1;
        const tc = torches[sd[0]], gp = tc.g.position;
        sparkPos[i * 3] = gp.x + Math.sin(tt * 9 + i) * 0.12 * tt; sparkPos[i * 3 + 1] = 2.25 + tt * 1.6; sparkPos[i * 3 + 2] = gp.z + Math.cos(tt * 7 + i) * 0.1 * tt;
      }
      if (NS) sparkGeo.attributes.position.needsUpdate = true;
      for (const b of banners) {
        const { cl, holder, wid } = b;
        const axis = new THREE.Vector3(1, 0, 0).applyQuaternion(holder.quaternion);
        const side = new THREE.Vector3(0, -1, 0);
        const base = new THREE.Vector3(wid / 2, 0, 0).applyQuaternion(holder.quaternion).multiplyScalar(-1).add(holder.position);
        cl.side = 1;
        cl.step(dt, { base, axis, side, len: wid, hoistTop: wid }, { wx: 0.5, wz: 1.4, gust: 0.8 * calm, calm: o.calm });
      }
    },
    dispose() { for (const d of disposables) d.dispose?.(); },
  };
  return api;
}
export const _dev = { facadeTex, towerTex, brickFloor, medallionTex };

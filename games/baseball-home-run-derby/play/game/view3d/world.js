// The 3D ballpark. World frame: x right, y up, -z toward the outfield (so the camera behind the plate looks down -z); the sim's z maps to -z here.
// Everything is generated in code (canvas textures + merged geometry): ground with mow stripes, infield dirt, chalk, mound, bases, outfield wall,
// foul poles, stands with a crowd texture, floodlight towers, a scoreboard, and a painted backdrop per ballpark. About 12 draw calls.
import { THREE } from '../vendor3d/index.js';
import { PARKS, fenceDist, FENCE_H, PITCH_Z, MOUND_H, FOUL_DEG, DEG, SECTORS, SECTOR_DEG } from '../src/core.js';

export const V3 = THREE.Vector3;
const BoxG = THREE.BoxGeometry;
const BufferGeometry = Object.getPrototypeOf(BoxG.prototype).constructor;
const Attr = new BoxG().attributes.position.constructor;
const Attr16 = new BoxG().index.constructor;
const Matrix4 = new THREE.Group().matrix.constructor;

/** sim (x, y, z) -> world */
export const toWorld = (x, y, z, out = new V3()) => out.set(x, y, -z);
const polar = (park, a, off = 0) => { const d = fenceDist(park, Math.max(-FOUL_DEG, Math.min(FOUL_DEG, a))) + off; return [Math.sin(a * DEG) * d, Math.cos(a * DEG) * d]; };
function rng(seed) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
const srgb = (hex) => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };

export function mergeGeos(list) {
  const pos = [], nor = [], col = [], idx = [];
  const m = new Matrix4(), e = new THREE.Euler(), q = new THREE.Quaternion();
  for (const it of list) {
    const g = it.geo;
    q.setFromEuler(e.set(...(it.rot || [0, 0, 0])));
    m.compose(new V3(...(it.pos || [0, 0, 0])), q, new V3(...(it.scale || [1, 1, 1])));
    const p = g.attributes.position, n = g.attributes.normal;
    const base = pos.length / 3, v = new V3(), rotOnly = new Matrix4().makeRotationFromQuaternion(q);
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(m); pos.push(v.x, v.y, v.z); v.fromBufferAttribute(n, i).applyMatrix4(rotOnly).normalize(); nor.push(v.x, v.y, v.z); col.push(...(it.color || [1, 1, 1])); }
    for (let i = 0; i < g.index.count; i++) idx.push(g.index.getX(i) + base);
  }
  const out = new BufferGeometry();
  out.setAttribute('position', new Attr(new Float32Array(pos), 3)); out.setAttribute('normal', new Attr(new Float32Array(nor), 3)); out.setAttribute('color', new Attr(new Float32Array(col), 3));
  out.setIndex(new Attr16(new Uint16Array(idx), 1));
  return out;
}

/** A quad strip between two polylines (arrays of [x,y,z] world points of equal length). uv: u along the strip (metres * su), v across (metres * sv). */
function strip(bot, top, su = 1, sv = 1, vlen = null) {
  const n = bot.length, pos = [], uv = [], idx = [];
  let u = 0;
  for (let i = 0; i < n; i++) {
    if (i) u += Math.hypot(bot[i][0] - bot[i - 1][0], bot[i][2] - bot[i - 1][2]);
    const hgt = vlen ?? Math.hypot(top[i][0] - bot[i][0], top[i][1] - bot[i][1], top[i][2] - bot[i][2]);
    pos.push(...bot[i], ...top[i]); uv.push(u * su, 0, u * su, hgt * sv);
    if (i) { const a = (i - 1) * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Attr(new Float32Array(pos), 3)); g.setAttribute('uv', new Attr(new Float32Array(uv), 2));
  g.setIndex(new Attr16(new Uint16Array(idx), 1)); g.computeVertexNormals();
  return g;
}

const mkCanvas = (doc, w, h) => { const c = doc.createElement('canvas'); c.width = w; c.height = h; return c; };
const tex = (c, rep = false, aniso = 4) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = aniso; return t; };

// ---- ground texture -------------------------------------------------------------------------------------------------------------------
const FX0 = -150, FX1 = 150, FZ0 = -40, FZ1 = 180;   // sim metres covered by the field texture
function paintField(doc, parkKey, look) {
  const c = mkCanvas(doc, 2048, 1536), g = c.getContext('2d');
  const X = (x) => (x - FX0) / (FX1 - FX0) * c.width, Z = (z) => (FZ1 - z) / (FZ1 - FZ0) * c.height, S = c.width / (FX1 - FX0);
  g.fillStyle = look.grassB; g.fillRect(0, 0, c.width, c.height);
  // fan of mow stripes
  for (let i = -24; i < 24; i++) {
    const a0 = i * 4 * DEG, a1 = (i + 1) * 4 * DEG;
    g.fillStyle = i % 2 ? look.grassA : look.grassB; g.beginPath(); g.moveTo(X(0), Z(0));
    g.lineTo(X(Math.sin(a0) * 300), Z(Math.cos(a0) * 300)); g.lineTo(X(Math.sin(a1) * 300), Z(Math.cos(a1) * 300)); g.closePath(); g.fill();
  }
  // outside the park: darker
  g.save(); g.beginPath(); g.rect(0, 0, c.width, c.height);
  g.moveTo(X(0), Z(0));
  for (let a = -90; a <= 90; a += 2) { const d = a >= -FOUL_DEG && a <= FOUL_DEG ? fenceDist(parkKey, a) : fenceDist(parkKey, Math.sign(a) * FOUL_DEG) + 4; g.lineTo(X(Math.sin(a * DEG) * d), Z(Math.cos(a * DEG) * d)); }
  g.closePath(); g.clip('evenodd'); g.fillStyle = look.outside; g.fillRect(0, 0, c.width, c.height); g.restore();
  // warning track
  g.strokeStyle = look.dirt; g.lineWidth = 5 * S; g.lineJoin = 'round'; g.beginPath();
  for (let a = -FOUL_DEG; a <= FOUL_DEG; a += 2) { const d = fenceDist(parkKey, a) - 2.5; const x = X(Math.sin(a * DEG) * d), y = Z(Math.cos(a * DEG) * d); if (a === -FOUL_DEG) g.moveTo(x, y); else g.lineTo(x, y); }
  g.stroke();
  // infield dirt: circle about the mound, cut by the grass diamond
  g.fillStyle = look.dirt; g.beginPath(); g.arc(X(0), Z(PITCH_Z + 1.5), 29 * S, 0, 7); g.fill();
  g.beginPath(); g.arc(X(0), Z(1.2), 8.5 * S, 0, 7); g.fill();
  // infield grass
  g.fillStyle = look.infield; g.beginPath(); g.moveTo(X(0), Z(5.2)); g.lineTo(X(17.2), Z(19.4)); g.lineTo(X(0), Z(36.2)); g.lineTo(X(-17.2), Z(19.4)); g.closePath(); g.fill();
  // base paths
  g.strokeStyle = look.dirt; g.lineWidth = 1.8 * S;
  g.beginPath(); g.moveTo(X(0), Z(0)); g.lineTo(X(19.4), Z(19.4)); g.lineTo(X(0), Z(38.8)); g.lineTo(X(-19.4), Z(19.4)); g.closePath(); g.stroke();
  for (const [bx, bz] of [[19.4, 19.4], [0, 38.8], [-19.4, 19.4]]) { g.fillStyle = look.dirt; g.beginPath(); g.arc(X(bx), Z(bz), 3.2 * S, 0, 7); g.fill(); }
  // chalk: foul lines
  g.strokeStyle = '#f4f1e8'; g.lineWidth = 0.15 * S * 1.6;
  for (const s of [-1, 1]) { g.beginPath(); g.moveTo(X(0), Z(0)); g.lineTo(X(s * 130), Z(130)); g.stroke(); }
  // grain
  const img = g.getImageData(0, 0, c.width, c.height), d = img.data, r = rng(5);
  for (let i = 0; i < d.length; i += 4) { const n = (r() - 0.5) * 9; d[i] += n; d[i + 1] += n * 1.1; d[i + 2] += n * 0.6; }
  g.putImageData(img, 0, 0);
  return c;
}

function paintHome(doc, look) {
  const c = mkCanvas(doc, 2048, 2048), g = c.getContext('2d');
  const S = c.width / 10;                          // px per metre; covers x -5..5, z -4..6
  const X = (x) => (x + 5) * S, Z = (z) => (6 - z) * S;
  g.fillStyle = look.dirt; g.fillRect(0, 0, c.width, c.height);
  const r = rng(11);
  for (let k = 0; k < 2600; k++) { g.fillStyle = `rgba(${r() < 0.5 ? '70,45,25' : '230,200,160'},${0.03 + r() * 0.05})`; g.beginPath(); g.ellipse(r() * c.width, r() * c.height, 4 + r() * 22, 2 + r() * 10, r() * 3, 0, 7); g.fill(); }
  // grass fringe toward the pitcher and the plate area soften: radial fade to transparent at the edges (applied with destination-out)
  g.globalCompositeOperation = 'destination-out';
  const gr = g.createRadialGradient(c.width / 2, c.height * 0.4, c.width * 0.28, c.width / 2, c.height * 0.4, c.width * 0.5);
  gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,1)'); g.fillStyle = gr; g.fillRect(0, 0, c.width, c.height);
  g.globalCompositeOperation = 'source-over';
  // batter's boxes, catcher's box
  g.strokeStyle = '#f4f1e8'; g.lineWidth = 0.065 * S; g.lineJoin = 'miter';
  for (const s of [-1, 1]) { const x0 = s * 0.37, x1 = s * 1.59; g.strokeRect(Math.min(X(x0), X(x1)), Z(1.13), Math.abs(X(x1) - X(x0)), Z(-0.70) - Z(1.13)); }
  g.strokeRect(X(-0.46), Z(-0.9), 0.92 * S, 1.2 * S);
  // home plate (point toward the catcher, z = 0)
  g.fillStyle = '#fbfaf5'; g.beginPath(); g.moveTo(X(-0.2159), Z(0.431)); g.lineTo(X(0.2159), Z(0.431)); g.lineTo(X(0.2159), Z(0.2152)); g.lineTo(X(0), Z(0)); g.lineTo(X(-0.2159), Z(0.2152)); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(40,40,40,0.35)'; g.lineWidth = 0.02 * S; g.stroke();
  // foul lines
  g.strokeStyle = '#f4f1e8'; g.lineWidth = 0.12 * S;
  for (const s of [-1, 1]) { g.beginPath(); g.moveTo(X(0), Z(0)); g.lineTo(X(s * 6), Z(6)); g.stroke(); }
  // footprints near the boxes
  for (let k = 0; k < 40; k++) { g.fillStyle = 'rgba(60,40,22,0.18)'; g.save(); g.translate(X((r() < 0.5 ? -1 : 1) * (0.5 + r() * 1.0)), Z(-0.6 + r() * 1.5)); g.rotate((r() - 0.5) * 0.8); g.fillRect(0, 0, 0.1 * S, 0.28 * S); g.restore(); }
  return c;
}

function paintCrowd(doc, excited, look, seed) {
  const c = mkCanvas(doc, 1024, 256), g = c.getContext('2d'), r = rng(seed);
  g.fillStyle = look.seat; g.fillRect(0, 0, 1024, 256);
  const rows = 8, rh = 256 / rows, cols = 52, cw = 1024 / cols;
  const skins = ['#f1c9a6', '#d9a579', '#b57d54', '#8a5a3a', '#5a3a2a'], hairs = ['#141210', '#3b2a1c', '#6b4a2a', '#c9a24a', '#8a8a8a'];
  for (let ro = 0; ro < rows; ro++) {
    for (let k = 0; k < cols; k++) {
      if (r() < 0.07) continue;
      const x = (k + 0.5 + (r() - 0.5) * 0.3) * cw, y = ro * rh;
      const jersey = look.crowd[Math.floor(r() * look.crowd.length)];
      g.fillStyle = jersey; g.beginPath(); g.roundRect(x - cw * 0.42, y + rh * 0.42, cw * 0.84, rh * 0.62, 5); g.fill();
      g.fillStyle = skins[Math.floor(r() * skins.length)]; g.beginPath(); g.arc(x, y + rh * 0.3, cw * 0.2, 0, 7); g.fill();
      g.fillStyle = hairs[Math.floor(r() * hairs.length)]; g.beginPath(); g.arc(x, y + rh * 0.24, cw * 0.2, Math.PI, 0); g.fill();
      if (excited && r() < 0.45) { g.strokeStyle = skins[Math.floor(r() * skins.length)]; g.lineWidth = cw * 0.12; g.lineCap = 'round'; const s = r() < 0.5 ? -1 : 1; g.beginPath(); g.moveTo(x + s * cw * 0.3, y + rh * 0.55); g.lineTo(x + s * cw * 0.42, y - rh * 0.05); g.stroke(); }
    }
    g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(0, (ro + 1) * rh - 3, 1024, 3);
  }
  return c;
}

function paintScoreboardBase(doc) { const c = mkCanvas(doc, 1024, 448); return c; }

const LOOKS = {
  harbor: { grassA: '#58a542', grassB: '#4b9438', outside: '#2d5a2a', dirt: '#b98d5c', infield: '#4f9a3c', seat: '#26304a', crowd: ['#e8453c', '#f2c230', '#2f6fe0', '#f4f1e8', '#3aa56a', '#ff7a3d'], wall: '#1f5a45', stand: 0xffffff, towers: true },
  lantern: { grassA: '#2f7a3a', grassB: '#27682f', outside: '#1a3a22', dirt: '#8f6a48', infield: '#2c7536', seat: '#161b30', crowd: ['#ffcf4a', '#e8453c', '#f4f1e8', '#7a5be0', '#25b8c9', '#ff7a3d'], wall: '#13342f', stand: 0xb0b8d8, towers: true },
  prairie: { grassA: '#5fae46', grassB: '#52a03c', outside: '#3d7a34', dirt: '#c19a66', infield: '#58a840', seat: '#4a5068', crowd: ['#2f6fe0', '#f4f1e8', '#e8453c', '#f2c230', '#3aa56a', '#9bc0ff'], wall: '#27506a', stand: 0xffffff, towers: false },
};

function paintBackdrop(doc, parkKey) {
  const W = 3072, H = 512, c = mkCanvas(doc, W, H), g = c.getContext('2d'), r = rng(parkKey.length * 77);
  const P = PARKS[parkKey], sky = P.sky;
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, sky[0]); gr.addColorStop(0.55, sky[1]); gr.addColorStop(0.9, sky[2]); gr.addColorStop(1, sky[2]); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  const hz = H * 0.88;
  if (parkKey === 'harbor') {
    const sg = g.createRadialGradient(W * 0.62, hz - 10, 4, W * 0.62, hz - 10, 280); sg.addColorStop(0, 'rgba(255,240,190,1)'); sg.addColorStop(0.25, 'rgba(255,200,130,0.7)'); sg.addColorStop(1, 'rgba(255,170,110,0)'); g.fillStyle = sg; g.fillRect(0, 0, W, H);
    g.fillStyle = '#254a6e'; g.fillRect(0, hz, W, H - hz);          // sea
    g.fillStyle = 'rgba(255,214,150,0.45)'; for (let i = 0; i < 70; i++) g.fillRect(W * 0.62 - 120 + r() * 240, hz + r() * (H - hz), 20 + r() * 60, 2);
    g.fillStyle = '#1b2d44'; g.beginPath(); g.moveTo(0, hz); for (let x = 0; x <= W; x += 24) g.lineTo(x, hz - 14 - Math.abs(Math.sin(x * 0.004)) * 30 - r() * 6); g.lineTo(W, hz); g.fill();   // headlands
    for (let i = 0; i < 26; i++) { const x = r() * W, h = 70 + r() * 80; g.strokeStyle = '#0f1c2c'; g.lineWidth = 5; g.beginPath(); g.moveTo(x, hz + 6); g.quadraticCurveTo(x + 8, hz - h * 0.6, x + 4 + r() * 10, hz - h); g.stroke(); g.fillStyle = '#0f1c2c'; for (let k = 0; k < 7; k++) { const a = -0.4 + k * 0.25 + 3.1; g.beginPath(); g.moveTo(x + 6, hz - h); g.quadraticCurveTo(x + 6 + Math.cos(a) * 40, hz - h + Math.sin(a) * 18 - 8, x + 6 + Math.cos(a) * 62, hz - h + Math.sin(a) * 30 + 12); g.quadraticCurveTo(x + 6 + Math.cos(a) * 40, hz - h + Math.sin(a) * 18 + 2, x + 6, hz - h); g.fill(); } }
    g.fillStyle = '#e8e2d6'; g.fillRect(W * 0.25 - 8, hz - 130, 16, 130); g.fillStyle = '#c23b3b'; g.fillRect(W * 0.25 - 8, hz - 100, 16, 20); g.fillStyle = '#ffe9a8'; g.fillRect(W * 0.25 - 12, hz - 146, 24, 16);
  } else if (parkKey === 'lantern') {
    g.fillStyle = '#fff'; for (let i = 0; i < 300; i++) { g.globalAlpha = 0.2 + r() * 0.7; g.fillRect(r() * W, r() * hz * 0.8, 2, 2); } g.globalAlpha = 1;
    g.fillStyle = '#0b1230'; g.beginPath(); g.moveTo(0, hz); for (let x = 0; x <= W; x += 16) g.lineTo(x, hz - 40 - Math.abs(Math.sin(x * 0.003 + 1)) * 70 - Math.abs(Math.sin(x * 0.011)) * 20); g.lineTo(W, hz); g.fill();     // hills
    for (let i = 0; i < 70; i++) { const x = r() * W, w = 24 + r() * 50, h = 60 + r() * 190; g.fillStyle = '#0a0f26'; g.fillRect(x, hz - h, w, h + 6); for (let wy = hz - h + 8; wy < hz - 6; wy += 14) for (let wx = x + 4; wx < x + w - 6; wx += 10) if (r() < 0.45) { g.fillStyle = r() < 0.2 ? '#7fd0ff' : '#ffd98a'; g.fillRect(wx, wy, 4, 6); } }
    g.fillStyle = '#16204a'; g.fillRect(0, hz, W, H - hz);
    for (let i = 0; i < 90; i++) { const x = r() * W, y = hz - 20 - r() * 70; g.fillStyle = r() < 0.5 ? 'rgba(255,90,70,0.9)' : 'rgba(255,214,120,0.9)'; g.beginPath(); g.ellipse(x, y, 5, 7, 0, 0, 7); g.fill(); g.fillStyle = 'rgba(255,200,120,0.25)'; g.beginPath(); g.arc(x, y, 16, 0, 7); g.fill(); }
    g.fillStyle = '#e8e2f0'; g.beginPath(); g.arc(W * 0.7, H * 0.2, 36, 0, 7); g.fill();
  } else {
    g.fillStyle = 'rgba(255,255,255,0.8)'; for (let i = 0; i < 26; i++) { const x = r() * W, y = 40 + r() * 190; g.beginPath(); g.ellipse(x, y, 90 + r() * 120, 14 + r() * 12, 0, 0, 7); g.ellipse(x + 40, y - 12, 60 + r() * 60, 12, 0, 0, 7); g.fill(); }
    g.fillStyle = '#7da86a'; g.beginPath(); g.moveTo(0, hz); for (let x = 0; x <= W; x += 20) g.lineTo(x, hz - 26 - Math.abs(Math.sin(x * 0.0035)) * 50); g.lineTo(W, hz); g.fill();
    g.fillStyle = '#d9c26a'; g.fillRect(0, hz - 4, W, H - hz + 4); for (let i = 0; i < 700; i++) { g.fillStyle = r() < 0.5 ? '#c8aa4e' : '#e6d487'; g.fillRect(r() * W, hz + r() * (H - hz), 3, 2 + r() * 10); }
    for (const sx of [0.18, 0.55, 0.84]) { const x = W * sx; g.fillStyle = '#b5483a'; g.fillRect(x, hz - 90, 90, 90); g.fillStyle = '#8a2f26'; g.beginPath(); g.moveTo(x - 6, hz - 90); g.lineTo(x + 45, hz - 128); g.lineTo(x + 96, hz - 90); g.fill(); g.fillStyle = '#cfd6dc'; g.fillRect(x + 110, hz - 140, 34, 140); g.beginPath(); g.arc(x + 127, hz - 140, 17, Math.PI, 0); g.fill(); }
    for (let i = 0; i < 40; i++) { const x = r() * W, h = 40 + r() * 50; g.fillStyle = '#3f7a3a'; g.beginPath(); g.arc(x, hz - h * 0.5, 16 + r() * 14, 0, 7); g.fill(); g.fillStyle = '#5a4630'; g.fillRect(x - 2, hz - h * 0.5, 4, h * 0.5); }
  }
  return c;
}

function paintSky(doc, parkKey) {
  const c = mkCanvas(doc, 64, 512), g = c.getContext('2d'), sky = PARKS[parkKey].sky;
  const gr = g.createLinearGradient(0, 0, 0, 512); gr.addColorStop(0, sky[0]); gr.addColorStop(0.5, sky[0]); gr.addColorStop(0.8, sky[1]); gr.addColorStop(1, sky[2]); g.fillStyle = gr; g.fillRect(0, 0, 64, 512);
  return c;
}

function blobTexture(doc) {
  const c = mkCanvas(doc, 64, 64), g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 2, 32, 32, 31);
  gr.addColorStop(0, 'rgba(10,16,6,0.6)'); gr.addColorStop(0.55, 'rgba(10,16,6,0.3)'); gr.addColorStop(1, 'rgba(10,16,6,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return tex(c);
}
function glowTexture(doc) {
  const c = mkCanvas(doc, 64, 64), g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,240,200,0.55)'); gr.addColorStop(1, 'rgba(255,230,170,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return tex(c);
}

// ---- the world -------------------------------------------------------------------------------------------------------------------------
export class World {
  constructor(stage, parkKey, doc = globalThis.document) {
    this.stage = stage; this.park = parkKey; this.doc = doc; this.P = PARKS[parkKey]; this.look = LOOKS[parkKey];
    this.group = new THREE.Group(); this.group.name = `park-${parkKey}`;
    stage.scene.add(this.group);
    this.blobTex = blobTexture(doc); this.glowTex = glowTexture(doc);
    this.crowd = 0; this.mats = {}; this.t = 0;
    this._build();
  }

  _mat(opts) { return new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0, ...opts }); }

  _build() {
    const { doc, look, park, group, stage } = this, S = THREE, night = this.P.light === 'night';
    const aniso = Math.min(8, stage.renderer.capabilities.getMaxAnisotropy());
    // ground
    const ft = tex(paintField(doc, park, look), false, aniso);
    const w = FX1 - FX0, d = FZ1 - FZ0;
    const ground = new S.Mesh(new S.PlaneGeometry(w, d), this._mat({ map: ft }));
    ground.rotation.x = -Math.PI / 2; ground.position.set((FX0 + FX1) / 2, 0, -(FZ0 + FZ1) / 2); ground.receiveShadow = true; group.add(ground);
    const far = new S.Mesh(new S.PlaneGeometry(1600, 1600), this._mat({ color: look.outside })); far.rotation.x = -Math.PI / 2; far.position.y = -0.08; group.add(far);
    // home area decal
    const ht = tex(paintHome(doc, look), false, aniso);
    const home = new S.Mesh(new S.PlaneGeometry(10, 10), this._mat({ map: ht, transparent: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    home.rotation.x = -Math.PI / 2; home.position.set(0, 0.012, -1); home.receiveShadow = true; home.renderOrder = 1; group.add(home);
    // mound, rubber, bases
    const dirt = srgb(look.dirt);
    const parts = [
      { geo: new S.CylinderGeometry(2.6, 3.4, MOUND_H, 28), pos: [0, MOUND_H / 2, -PITCH_Z], color: dirt },
      { geo: new S.BoxGeometry(0.61, 0.03, 0.15), pos: [0, MOUND_H + 0.012, -PITCH_Z], color: [0.97, 0.96, 0.92] },
    ];
    for (const [bx, bz] of [[19.4, 19.4], [0, 38.8], [-19.4, 19.4]]) parts.push({ geo: new S.BoxGeometry(0.38, 0.09, 0.38), pos: [bx, 0.05, -bz], rot: [0, bx === 0 ? Math.PI / 4 : Math.PI / 4, 0], color: [0.97, 0.96, 0.92] });
    const bases = new S.Mesh(mergeGeos(parts), this._mat({ vertexColors: true })); bases.receiveShadow = true; bases.castShadow = false; group.add(bases);
    this._wall(); this._stands(); this._towers(); this._scoreboard(); this._backdrop();
    // shadows for the people outside the key-light box and for the ball: soft blobs
    this.blobs = []; for (let i = 0; i < 4; i++) { const m = new S.Mesh(new S.PlaneGeometry(1, 1), new S.MeshBasicMaterial({ map: this.blobTex, transparent: true, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.position.y = 0.03; m.renderOrder = 3; m.visible = false; group.add(m); this.blobs.push(m); }
    // spotlight beam over the lit sector of the stands
    this.spot = new S.Mesh(new S.PlaneGeometry(1, 1), new S.MeshBasicMaterial({ color: 0xfff1a8, transparent: true, opacity: 0.28, blending: S.AdditiveBlending, depthWrite: false, side: S.DoubleSide }));
    this.spot.renderOrder = 4; group.add(this.spot); this.setSpot(2);
  }

  _wall() {
    const { park, look, group, doc } = this, S = THREE;
    const bot = [], top = [], cap = [], capTop = [];
    for (let a = -FOUL_DEG; a <= FOUL_DEG + 0.01; a += 1.5) { const [x, z] = polar(park, a); bot.push([x, 0, -z]); top.push([x, FENCE_H, -z]); cap.push([x, FENCE_H, -z]); const [x2, z2] = polar(park, a, 0.35); capTop.push([x2, FENCE_H + 0.18, -z2]); }
    const c = mkCanvas(doc, 512, 128), g = c.getContext('2d'); g.fillStyle = look.wall; g.fillRect(0, 0, 512, 128);
    g.fillStyle = 'rgba(255,255,255,0.1)'; for (let i = 0; i < 16; i++) g.fillRect(i * 32, 0, 2, 128);
    g.fillStyle = 'rgba(255,255,255,0.16)'; g.fillRect(0, 60, 512, 5);
    const wt = tex(c, true, 8); wt.repeat.set(1, 1);
    const wall = new S.Mesh(strip(bot, top, 1 / 16, 1 / 3), new S.MeshStandardMaterial({ map: wt, roughness: 0.8, side: S.DoubleSide })); wall.receiveShadow = true; group.add(wall);
    const padding = new S.Mesh(strip(cap, capTop, 1, 1), new S.MeshStandardMaterial({ color: 0xf2c230, roughness: 0.6, side: S.DoubleSide })); group.add(padding);
    // distance plates
    const plates = [];
    for (const a of [-40, -22, 0, 22, 40]) {
      const cv = mkCanvas(doc, 128, 64), cg = cv.getContext('2d'); cg.fillStyle = '#f4f1e8'; cg.fillRect(0, 0, 128, 64); cg.fillStyle = '#1b2230'; cg.font = '800 44px system-ui, sans-serif'; cg.textAlign = 'center'; cg.textBaseline = 'middle'; cg.fillText(String(Math.round(fenceDist(park, a))), 64, 36);
      const [x, z] = polar(park, a, -0.05);
      const m = new S.Mesh(new S.PlaneGeometry(4.2, 2.1), new S.MeshBasicMaterial({ map: tex(cv, false, 4) })); m.position.set(x, 1.7, -z); m.rotation.y = Math.PI - a * DEG * -1 + 0; m.lookAt(0, 1.7, 0); plates.push(m); group.add(m);
    }
    // foul poles
    for (const s of [-1, 1]) { const [x, z] = polar(park, s * FOUL_DEG, 0.3); const pole = new S.Mesh(new S.CylinderGeometry(0.12, 0.12, 22, 8), new S.MeshStandardMaterial({ color: 0xf2c230, roughness: 0.5 })); pole.position.set(x, 11, -z); group.add(pole); }
  }

  _stands() {
    const { park, look, group, doc } = this, S = THREE, night = this.P.light === 'night';
    this.crowdTex = [tex(paintCrowd(doc, false, look, 3), true, 4), tex(paintCrowd(doc, true, look, 3), true, 4)];
    this.crowdMat = new S.MeshBasicMaterial({ map: this.crowdTex[0], color: night ? 0xb8b8d0 : 0xffffff, side: S.DoubleSide });
    // polyline along the fence, extended past the poles along the foul lines toward home
    const pts = [];
    for (let a = -FOUL_DEG; a <= FOUL_DEG + 0.01; a += 1.5) pts.push(polar(park, a, 5));
    const lineEnd = (s) => { const [px, pz] = polar(park, s * FOUL_DEG, 5); return [px, pz]; };
    const left = [], right = [];
    for (let k = 1; k <= 6; k++) { const t = k / 6; const [px, pz] = lineEnd(-1); left.unshift([px * (1 - t) - 12 * t - 3, pz * (1 - t) - 24 * t]); const [qx, qz] = lineEnd(1); right.push([qx * (1 - t) + 12 * t + 3, qz * (1 - t) - 24 * t]); }
    const poly = [...left, ...pts, ...right];
    const bot = poly.map(([x, z]) => [x, 3.4, -z]);
    const top = poly.map(([x, z]) => { const n = Math.hypot(x, z) || 1, o = 16; return [x + (x / n) * o, 3.4 + 10.5, -(z + (z / n) * o)]; });
    const mesh = new S.Mesh(strip(bot, top, 1 / 7, 1 / 4.4), this.crowdMat); mesh.name = 'stands'; group.add(mesh);
    this.crowdTex.forEach((t) => t.repeat.set(1, 1));
    // concourse wall and roof lip with lit trim
    const top2 = top.map((p) => [p[0], p[1] + 3.2, p[2]]);
    const back = new S.Mesh(strip(top, top2, 1, 1), new S.MeshStandardMaterial({ color: night ? 0x1b2036 : 0x8d8aa0, roughness: 1, side: S.DoubleSide })); group.add(back);
    this.stands = { poly, bot, top };
  }

  _towers() {
    const { park, look, group } = this, S = THREE, night = this.P.light === 'night';
    if (!look.towers) return;
    const parts = [], lamps = [];
    for (const a of [-64, -38, -14, 14, 38, 64]) {
      const [x, z] = polar(park, a, 32);
      parts.push({ geo: new S.CylinderGeometry(0.5, 0.8, 38, 8), pos: [x, 19, -z], color: [0.35, 0.37, 0.42] });
      const bank = { geo: new S.BoxGeometry(9, 4.5, 0.6), pos: [x, 39.5, -z], color: [0.9, 0.9, 0.85] };
      parts.push(bank); lamps.push([x, 39.5, -z]);
    }
    const t = new S.Mesh(mergeGeos(parts), new S.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, emissive: night ? 0xfff2cc : 0x000000, emissiveIntensity: night ? 0.35 : 0 })); group.add(t);
    this.lamps = lamps;
    if (night) for (const l of lamps) { const sp = new S.Sprite(new S.SpriteMaterial({ map: this.glowTex, blending: S.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0.9 })); sp.position.set(l[0], l[1], l[2]); sp.scale.set(26, 26, 1); group.add(sp); }
  }

  _scoreboard() {
    const { park, group, doc } = this, S = THREE;
    const [x, z] = polar(park, 0, 30);
    this.sbCanvas = paintScoreboardBase(doc); this.sbTex = tex(this.sbCanvas, false, 4);
    const m = new S.Mesh(new S.PlaneGeometry(28, 12.2), new S.MeshBasicMaterial({ map: this.sbTex }));
    m.position.set(x, 24.5, -z); m.lookAt(0, 24.5, 0); group.add(m); this.sbMesh = m;
    const frame = new S.Mesh(new S.BoxGeometry(29.2, 13.4, 0.8), new S.MeshStandardMaterial({ color: 0x20242e, roughness: 0.8 })); frame.position.set(x, 24.5, -z - 0.5); frame.lookAt(0, 24.5, 0); frame.translateZ(-0.6); group.add(frame);
    this.sbKey = '';
    this.setScoreboard(null);
  }

  setScoreboard(r) {
    const key = r ? `${r.score}|${r.hr}|${r.outs}|${r.outsMax}|${Math.round(r.longest)}|${r.label}` : 'idle';
    if (key === this.sbKey) return; this.sbKey = key;
    const c = this.sbCanvas, g = c.getContext('2d'); g.fillStyle = '#05070c'; g.fillRect(0, 0, c.width, c.height);
    g.strokeStyle = '#3a4258'; g.lineWidth = 6; g.strokeRect(6, 6, c.width - 12, c.height - 12);
    g.textAlign = 'center'; g.fillStyle = '#ffb347'; g.font = '800 54px system-ui, sans-serif';
    if (!r) { g.fillText('MOONSHOT', c.width / 2, 170); g.fillStyle = '#7fd0ff'; g.fillText('BASEBALL', c.width / 2, 250); }
    else {
      g.font = '700 38px system-ui, sans-serif'; g.fillStyle = '#7fd0ff'; g.fillText(r.label.toUpperCase(), c.width / 2, 68);
      g.font = '800 150px system-ui, sans-serif'; g.fillStyle = '#ffb347'; g.fillText(String(r.score), c.width * 0.25, 240);
      g.font = '700 36px system-ui, sans-serif'; g.fillStyle = '#ffd98a'; g.fillText('POINTS', c.width * 0.25, 290);
      g.font = '800 150px system-ui, sans-serif'; g.fillStyle = '#ff6b57'; g.fillText(String(r.hr), c.width * 0.75, 240);
      g.font = '700 36px system-ui, sans-serif'; g.fillStyle = '#ffd98a'; g.fillText('HOME RUNS', c.width * 0.75, 290);
      g.font = '700 44px system-ui, sans-serif'; g.fillStyle = '#f4f1e8'; g.fillText(`OUTS ${r.outs}/${r.outsMax}    LONGEST ${Math.round(r.longest)} m`, c.width / 2, 390);
    }
    this.sbTex.needsUpdate = true;
  }

  _backdrop() {
    const { park, group, doc } = this, S = THREE;
    const span = 160 * DEG;
    const bt = tex(paintBackdrop(doc, park), false, 4);
    const back = new S.Mesh(new S.CylinderGeometry(420, 420, 230, 48, 1, true, Math.PI - span / 2, span), new S.MeshBasicMaterial({ map: bt, side: S.BackSide, fog: false }));
    back.position.y = 70; back.rotation.y = 0; group.add(back);
    const dome = new S.Mesh(new S.SphereGeometry(500, 24, 16), new S.MeshBasicMaterial({ map: tex(paintSky(doc, park)), side: S.BackSide, fog: false }));
    dome.scale.y = 0.9; group.add(dome);
    this.back = back; this.dome = dome;
  }

  /** Light the stands section `i` (0..SECTORS-1): a soft additive panel over the crowd. */
  setSpot(i) {
    if (this.spotI === i) return; this.spotI = i;
    const a0 = -FOUL_DEG + i * SECTOR_DEG, a1 = a0 + SECTOR_DEG;
    const p0 = polar(this.park, a0, 5.4), p1 = polar(this.park, a1, 5.4);
    const o = 16, q0 = polar(this.park, a0, 5.4 + o), q1 = polar(this.park, a1, 5.4 + o);
    const geo = new BufferGeometry();
    geo.setAttribute('position', new Attr(new Float32Array([p0[0], 3.6, -p0[1], p1[0], 3.6, -p1[1], q1[0], 13.7, -q1[1], q0[0], 13.7, -q0[1]]), 3));
    geo.setIndex(new Attr16(new Uint16Array([0, 1, 2, 0, 2, 3]), 1));
    this.spot.geometry.dispose(); this.spot.geometry = geo; this.spot.scale.set(1, 1, 1);
  }

  setBlob(i, x, z, r, a = 1) { const m = this.blobs[i]; if (!m) return; m.visible = a > 0.01; m.position.set(x, 0.03, z); m.scale.set(r * 1.7, r * 1.2, 1); m.material.opacity = a; }

  update(t, excite) {
    this.t = t;
    const on = excite > 0.05 && Math.floor(t * 5) % 2 === 0;
    const want = on ? this.crowdTex[1] : this.crowdTex[0];
    if (this.crowdMat.map !== want) { this.crowdMat.map = want; this.crowdMat.needsUpdate = true; }
    this.spot.material.opacity = 0.2 + 0.1 * Math.sin(t * 6);
  }

  dispose() { this.group.removeFromParent(); }
}

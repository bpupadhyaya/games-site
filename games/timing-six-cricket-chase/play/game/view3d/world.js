// The 3D set: ground, pitch, creases, stumps / bin, the lens-matched camera and the screen-space backdrop.
// World frame (metres): the sim's field frame (x = off side for a right-hander, z = down the pitch, y up) is mapped to
// WORLD = (hand * x, y, -z) so the world is right-handed, the bowler is at -Z and the camera (behind the batter) looks down -Z.
// A left-hander is therefore an exact mirror of a right-hander, the same trick the 2D view uses.
import { THREE } from '../vendor3d/index.js';
import { drawBackdrop } from '../src/scene.js';
import { CAM } from '../src/scene.js';
import { THEMES } from '../src/core.js';

export const V3 = THREE.Vector3;
const Matrix4 = new THREE.Group().matrix.constructor;
const BoxG = THREE.BoxGeometry;
const BufferGeometry = Object.getPrototypeOf(BoxG.prototype).constructor;
const Attr = new BoxG().attributes.position.constructor;
const Attr16 = new BoxG().index.constructor;

/** sim -> world */
export const toWorld = (hand, x, y, z, out = new V3()) => out.set(hand * x, y, -z);
/** sim direction (dx, dz) -> world yaw (avatar facing yaw about +Y) */
export const yawOfSim = (hand, dx, dz) => Math.atan2(hand * dx, -dz);

// ---- merged static geometry ---------------------------------------------------------------------------------------------
export function mergeGeos(list) {
  // list: [{ geo, pos:[x,y,z], rot:[rx,ry,rz], scale:[sx,sy,sz], color:[r,g,b] }]
  const pos = [], nor = [], col = [], idx = [];
  const m = new Matrix4(), e = new THREE.Euler(), q = new THREE.Quaternion(), nm = new Matrix4();
  for (const it of list) {
    const g = it.geo;
    q.setFromEuler(e.set(...(it.rot || [0, 0, 0])));
    m.compose(new V3(...(it.pos || [0, 0, 0])), q, new V3(...(it.scale || [1, 1, 1])));
    const p = g.attributes.position, n = g.attributes.normal;
    const base = pos.length / 3;
    const v = new V3();
    const rotOnly = new Matrix4().makeRotationFromQuaternion(q);
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(m); pos.push(v.x, v.y, v.z);
      v.fromBufferAttribute(n, i).applyMatrix4(rotOnly).normalize(); nor.push(v.x, v.y, v.z);
      col.push(...(it.color || [1, 1, 1]));
    }
    for (let i = 0; i < g.index.count; i++) idx.push(g.index.getX(i) + base);
  }
  const out = new BufferGeometry();
  out.setAttribute('position', new Attr(new Float32Array(pos), 3));
  out.setAttribute('normal', new Attr(new Float32Array(nor), 3));
  out.setAttribute('color', new Attr(new Float32Array(col), 3));
  out.setIndex(new Attr16(new Uint16Array(idx), 1));
  return out;
}
const srgb = (hex) => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };

// ---- canvas textures --------------------------------------------------------------------------------------------------------
function rng(seed) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }

function grassTexture(theme, doc) {
  const c = doc.createElement('canvas'); c.width = 512; c.height = 1024;
  const g = c.getContext('2d');
  const pal = theme === 'beach' ? ['#e7cd95', '#dcc088'] : theme === 'backyard' ? ['#5fa044', '#548f3b'] : ['#5aa03e', '#4c9036'];
  // two mow bands per tile (each 3 m tall in the world, the tile is 6 m)
  g.fillStyle = pal[0]; g.fillRect(0, 0, 512, 512); g.fillStyle = pal[1]; g.fillRect(0, 512, 512, 512);
  const img = g.getImageData(0, 0, 512, 1024);
  const r = rng(99), d = img.data;
  const amp = theme === 'beach' ? 9 : 16;
  for (let i = 0; i < d.length; i += 4) { const n = (r() - 0.5) * amp; d[i] += n; d[i + 1] += n * 1.1; d[i + 2] += n * 0.6; }
  g.putImageData(img, 0, 0);
  if (theme !== 'beach') {
    // blades: short darker and lighter strokes
    for (let i = 0; i < 5200; i++) { const x = r() * 512, y = r() * 1024; g.strokeStyle = r() < 0.5 ? 'rgba(30,70,20,0.16)' : 'rgba(190,230,110,0.13)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 3, y - 3 - r() * 4); g.stroke(); }
  } else {
    for (let i = 0; i < 2400; i++) { const x = r() * 512, y = r() * 1024; g.fillStyle = r() < 0.5 ? 'rgba(150,110,60,0.18)' : 'rgba(255,245,215,0.22)'; g.fillRect(x, y, 2, 1.4); }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function pitchTexture(theme, L, doc) {
  const c = doc.createElement('canvas'); c.width = 512; c.height = 2048;
  const g = c.getContext('2d');
  const pal = theme === 'backyard' ? ['#a89f94', '#8a8176'] : theme === 'beach' ? ['#a9895a', '#8d6f44'] : ['#cdb987', '#b49c68'];
  const grad = g.createLinearGradient(0, 0, 0, 2048); grad.addColorStop(0, pal[0]); grad.addColorStop(0.5, pal[1]); grad.addColorStop(1, pal[0]);
  g.fillStyle = grad; g.fillRect(0, 0, 512, 2048);
  const r = rng(7);
  const img = g.getImageData(0, 0, 512, 2048), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const n = (r() - 0.5) * 12; d[i] += n; d[i + 1] += n; d[i + 2] += n * 0.8; }
  g.putImageData(img, 0, 0);
  // wear: darker scuffs at both ends and the good-length area, light worn streaks
  for (let k = 0; k < 140; k++) {
    const yy = r() < 0.5 ? r() * 360 : 2048 - r() * 360, x = 120 + r() * 270;
    g.fillStyle = `rgba(80,55,25,${0.015 + r() * 0.03})`; g.beginPath(); g.ellipse(x, yy, 8 + r() * 20, 4 + r() * 9, r() * 3, 0, 7); g.fill();
  }
  for (let k = 0; k < 60; k++) { const x = 40 + r() * 430, yy = r() * 2048; g.fillStyle = `rgba(250,235,190,${0.02 + r() * 0.03})`; g.beginPath(); g.ellipse(x, yy, 6 + r() * 12, 30 + r() * 110, 0.05 * (r() - 0.5), 0, 7); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function blobTexture(doc) {
  const c = doc.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 2, 32, 32, 31);
  gr.addColorStop(0, 'rgba(15,22,6,0.55)'); gr.addColorStop(0.55, 'rgba(15,22,6,0.28)'); gr.addColorStop(1, 'rgba(15,22,6,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// ---- the world --------------------------------------------------------------------------------------------------------------------
export class World {
  constructor(stage, theme, doc = globalThis.document) {
    this.stage = stage; this.theme = theme; this.doc = doc;
    const th = THEMES[theme]; this.th = th; this.L = th.pitchLen;
    this.group = new THREE.Group(); this.group.name = 'world';
    stage.scene.add(this.group);
    this.blobTex = blobTexture(doc);
    this._build();
  }

  _build() {
    const { th, L, theme, doc } = this;
    const S = THREE;
    // ground: a large plane with a tiled mow texture (tile = 6 m)
    const gt = grassTexture(theme, doc);
    gt.repeat.set(150, 150);
    gt.anisotropy = Math.min(8, this.stage.renderer.capabilities.getMaxAnisotropy());
    const ground = new S.Mesh(new S.PlaneGeometry(900, 900), new S.MeshStandardMaterial({ map: gt, roughness: 1, metalness: 0 }));
    ground.rotation.x = -Math.PI / 2; ground.position.set(0, 0, -L / 2); ground.receiveShadow = true;
    // Plane UVs run along x/y of the plane; after rotation the tile's v axis runs along world -Z: bands are across the pitch like the 2D view.
    this.group.add(ground);
    this.ground = ground;
    // pitch strip
    const pw = theme === 'backyard' ? 2.6 : 3.05;
    const z0 = -2.4, z1 = L + 1.4;
    const pt = pitchTexture(theme, L, doc); pt.anisotropy = 8;
    const pitch = new S.Mesh(new S.PlaneGeometry(pw, z1 - z0), new S.MeshStandardMaterial({ map: pt, roughness: 1, metalness: 0 }));
    pitch.rotation.x = -Math.PI / 2; pitch.position.set(0, 0.004, -(z0 + z1) / 2); pitch.receiveShadow = true;
    this.group.add(pitch);
    // creases (thin white boxes)
    const lines = [];
    const add = (xa, za, xb, zb) => {
      const cx = (xa + xb) / 2, cz = (za + zb) / 2, len = Math.hypot(xb - xa, zb - za), ang = Math.atan2(xb - xa, zb - za);
      lines.push({ geo: new S.BoxGeometry(0.05, 0.004, len), pos: [cx, 0.008, -cz], rot: [0, -ang, 0], color: srgb('#f4f1e8') });
    };
    add(-pw / 2 - 0.2, 1.22, pw / 2 + 0.2, 1.22); add(-1.32, 0, 1.32, 0); add(-1.32, 0, -1.32, 1.52); add(1.32, 0, 1.32, 1.52);
    add(-pw / 2 - 0.2, L - 1.22, pw / 2 + 0.2, L - 1.22); add(-1.32, L, 1.32, L); add(-1.32, L, -1.32, L - 1.52); add(1.32, L, 1.32, L - 1.52);
    const cl = new S.Mesh(mergeGeos(lines), new S.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
    cl.receiveShadow = true; this.group.add(cl);
    // wickets
    this.wk = [this._wicket(0), this._wicket(L)];
    this.wk[0].root.position.z = 0; this.wk[1].root.position.z = -L;
    for (const w of this.wk) this.group.add(w.root);
    this.sunDir = new V3(0.35, 0.5, -0.8);
    // blob shadows for everybody who has no real shadow: one dynamic mesh of N quads (a single draw call)
    const N = 16; this.blobN = N;
    const pos = new Float32Array(N * 12), uv = new Float32Array(N * 8), idx = new Uint16Array(N * 6), nor = new Float32Array(N * 12);
    for (let i = 0; i < N; i++) { uv.set([0, 0, 1, 0, 1, 1, 0, 1], i * 8); idx.set([i * 4, i * 4 + 2, i * 4 + 1, i * 4, i * 4 + 3, i * 4 + 2], i * 6); for (let k = 0; k < 4; k++) nor[i * 12 + k * 3 + 1] = 1; }
    const bg = new BufferGeometry();
    bg.setAttribute('position', new Attr(pos, 3)); bg.setAttribute('normal', new Attr(nor, 3)); bg.setAttribute('uv', new Attr(uv, 2)); bg.setIndex(new Attr16(idx, 1));
    this.blobMesh = new THREE.Mesh(bg, new THREE.MeshStandardMaterial({ map: this.blobTex, transparent: true, depthWrite: false, roughness: 1 }));
    this.blobMesh.frustumCulled = false; this.blobMesh.renderOrder = 2; this.blobCount = 0;
    this.group.add(this.blobMesh);
  }

  /** Place blob shadows: list of [x, z, radius] in WORLD coordinates (long towards the sun side). */
  setBlobs(list) {
    const p = this.blobMesh.geometry.attributes.position.array;
    const n = Math.min(list.length, this.blobN);
    for (let i = 0; i < this.blobN; i++) {
      const b = i < n ? list[i] : [0, 0, 0];
      const [x, z, r] = b, y = 0.012, sx = 0.35 * r, sz = 0.25 * r;
      p.set([x - r * 0.9 + sx, y, z - r * 0.6 + sz, x + r * 0.9 + sx, y, z - r * 0.6 + sz, x + r * 0.9 + sx, y, z + r * 0.6 + sz, x - r * 0.9 + sx, y, z + r * 0.6 + sz], i * 12);
    }
    this.blobMesh.geometry.attributes.position.needsUpdate = true;
  }

  _wicket(zSim) {
    const S = THREE, th = this.th, bin = th.wicketBin || this.theme === 'backyard';
    const root = new S.Group();
    if (bin) {
      // a wheelie bin: tapered body, darker lid, handle bar
      const parts = [
        { geo: new S.CylinderGeometry(0.29, 0.25, 0.86, 16), pos: [0, 0.43, 0], color: srgb('#2a9a5a') },
        { geo: new S.CylinderGeometry(0.31, 0.31, 0.06, 16), pos: [0, 0.88, 0], color: srgb('#176a40') },
        { geo: new S.BoxGeometry(0.34, 0.03, 0.04), pos: [0, 0.94, 0.16], color: srgb('#176a40') },
        { geo: new S.BoxGeometry(0.2, 0.04, 0.02), pos: [0, 0.62, 0.285], color: srgb('#1b1b1b') },
        { geo: new S.CylinderGeometry(0.05, 0.05, 0.03, 10), pos: [0.2, 0.05, 0.1], rot: [0, 0, Math.PI / 2], color: srgb('#111111') },
        { geo: new S.CylinderGeometry(0.05, 0.05, 0.03, 10), pos: [-0.2, 0.05, 0.1], rot: [0, 0, Math.PI / 2], color: srgb('#111111') },
      ];
      const m = new S.Mesh(mergeGeos(parts), new S.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, transparent: zSim === 0, opacity: zSim === 0 ? 0.42 : 1 }));
      m.castShadow = zSim !== 0; m.receiveShadow = true; root.add(m);   // the near bin is see-through so it never hides the batter
      return { root, bin: true, parts: [m], bails: [], base: [m] };
    }
    const sp = 0.0953, h = 0.711;
    const stumps = [];
    const geoS = (x) => ({ geo: new S.CylinderGeometry(0.0175, 0.0175, h, 8), pos: [x, h / 2, 0], color: srgb('#ecdcb4') });
    const geoB = (x) => ({ geo: new S.CylinderGeometry(0.0095, 0.0095, sp * 1.08, 6), rot: [0, 0, Math.PI / 2], pos: [x, h + 0.012, 0], color: srgb('#f3e6c2') });
    const matS = new S.MeshStandardMaterial({ vertexColors: true, roughness: 0.55 });
    const whole = new S.Mesh(mergeGeos([geoS(-sp), geoS(0), geoS(sp), geoB(-sp / 2), geoB(sp / 2)]), matS);
    whole.castShadow = true; root.add(whole);
    const loose = new S.Group(); loose.visible = false; root.add(loose);
    for (let i = -1; i <= 1; i++) { const m = new S.Mesh(mergeGeos([{ ...geoS(0), pos: [0, h / 2, 0] }]), matS); m.position.set(i * sp, 0, 0); loose.add(m); stumps.push(m); }
    const bails = [];
    for (let i = 0; i < 2; i++) { const m = new S.Mesh(mergeGeos([{ ...geoB(0), pos: [0, 0, 0] }]), matS); m.position.set((i - 0.5) * sp, h + 0.012, 0); loose.add(m); bails.push(m); }
    return { root, bin: false, stumps, bails, whole, loose };

  }

  /** broken in [0,1]: stumps/bails fly. The sim's stumps animation drives it. dir = +1 / -1 = which way things fly (world z). */
  setBroken(i, t, seed = 1) {
    const w = this.wk[i];
    if (w.bin) { w.root.rotation.z = -t * 1.0; w.root.position.x = t * 0.18; w.root.position.y = 0; return; }
    w.whole.visible = t <= 0; w.loose.visible = t > 0;
    const r = rng(11 + seed);
    w.stumps.forEach((m, k) => {
      const kk = (k - 1) * 0.35 + 0.15;
      const dir = i === 0 ? 1 : -1; // flies away from the bowler for the striker's end (towards +world z = the camera side)
      m.position.x = (k - 1) * 0.0953 + t * kk * 0.5; m.position.y = t * 0.1 * (1 - Math.abs(k - 1) * 0.4) - 0.5 * 9.8 * 0 ; m.position.z = dir * t * (0.5 + 0.25 * k);
      m.rotation.set(dir * t * (0.9 + 0.5 * k), 0, -t * ((k - 1) * 0.9 + 0.5) * 1.3);
    });
    w.bails.forEach((m, k) => {
      const dir = i === 0 ? 1 : -1;
      m.position.set((k - 0.5) * 0.0953 + (k ? 1 : -1) * t * 0.35, 0.723 + Math.sin(Math.min(1, t) * Math.PI) * 0.35 - (t > 0.9 ? (t - 0.9) * 2 : 0), dir * t * 0.9);
      m.rotation.set(t * 6 * (k ? 1 : -1), t * 4, t * 3);
    });
  }

  dispose() { this.group.removeFromParent(); }
}

// ---- projection matched to the 2D camera ---------------------------------------------------------------------------------------
/** The 2D delivery camera (scene.js CAM, set live by layout.js for the current screen shape) mapped through the kit's viewport: focal length and principal point in CSS pixels. */
export function fitProjection(camera, cssW, cssH, view = { w: CAM.w, h: CAM.h }, o = {}) {
  const s = Math.min(cssW / view.w, cssH / view.h);
  const ox = (cssW - view.w * s) / 2, oy = (cssH - view.h * s) / 2;
  const zoom = o.zoom ?? 1, pivot = o.pivot ?? [CAM.cx, CAM.hy + 305];
  let ppx = CAM.cx + (o.sx ?? 0), ppy = CAM.hy + (o.sy ?? 0);
  // zoom about the pivot (virtual units)
  ppx = pivot[0] + zoom * (ppx - pivot[0]); ppy = pivot[1] + zoom * (ppy - pivot[1]);
  const F = CAM.f * s * zoom;
  const px0 = ox + ppx * s, py0 = oy + ppy * s;
  const near = 0.15, far = 420;
  const e = camera.projectionMatrix.elements;
  e[0] = 2 * F / cssW; e[4] = 0; e[8] = 1 - 2 * px0 / cssW; e[12] = 0;
  e[1] = 0; e[5] = 2 * F / cssH; e[9] = 2 * py0 / cssH - 1; e[13] = 0;
  e[2] = 0; e[6] = 0; e[10] = -(far + near) / (far - near); e[14] = -2 * far * near / (far - near);
  e[3] = 0; e[7] = 0; e[11] = -1; e[15] = 0;
  camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
  return { s, ox, oy, F, px0, py0 };
}

/** Screen position (virtual 720x1280 units) of a world point under the fitted camera (for 2D overlays that follow 3D things). */
export function worldToVirtual(camera, p, fit, view = { w: 720, h: 1280 }, out = {}) {
  const v = new V3().copy(p).applyMatrix4(camera.matrixWorldInverse);
  const k = fit.F / Math.max(0.05, -v.z);
  const px = fit.px0 + v.x * k, py = fit.py0 - v.y * k;
  out.x = (px - fit.ox) / fit.s; out.y = (py - fit.oy) / fit.s; out.k = k / fit.s;
  return out;
}

/** The static backdrop (sky, stands, house, palms) painted with the 2D art into a screen-space canvas texture. */
export function makeBackdrop(doc, theme, cssW, cssH, dpr, view = { w: CAM.w, h: CAM.h }) {
  const c = doc.createElement('canvas');
  c.width = Math.max(2, Math.round(cssW * dpr)); c.height = Math.max(2, Math.round(cssH * dpr));
  const g = c.getContext('2d');
  const s = Math.min(cssW / view.w, cssH / view.h) * dpr;
  const ox = (c.width - view.w * s) / 2, oy = (c.height - view.h * s) / 2;
  const hzn = CAM.hy;
  // above the virtual rect: extend the sky's top colour; below the horizon: the haze colour the ground fades into
  g.fillStyle = '#2b4a82'; g.fillRect(0, 0, c.width, oy + (hzn + 8) * s);
  g.fillStyle = '#e8c398'; g.fillRect(0, oy + (hzn + 8) * s - 1, c.width, c.height);
  g.save(); g.setTransform(s, 0, 0, s, ox, oy);
  g.beginPath(); g.rect(0, 0, view.w, hzn + 8); g.clip();
  drawBackdrop(g, theme, hzn, view.w);
  g.restore();
  // sky continues above the rect (top row replicated)
  if (oy > 1) { g.drawImage(c, 0, oy, c.width, 1, 0, 0, c.width, oy); }
  // left/right bars (when the screen is wider than the virtual rect) replicate the edge columns
  if (ox > 1) { const h2 = oy + (hzn + 8) * s; g.drawImage(c, ox, 0, 1, h2, 0, 0, ox, h2); g.drawImage(c, c.width - ox - 1, 0, 1, h2, c.width - ox, 0, ox, h2); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

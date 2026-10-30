// The 3D world for Shogi: a bright, sunlit tatami room. A thick kaya-wood board (pale gold, fine grain, ink grid, star points)
// sits on a vermilion lacquer tray on woven-rush tatami mats with dark cloth borders; shoji-window light falls across the floor and
// a few cherry petals have drifted down. The koma are real wedge-shaped pieces with thickness (the point is lower than the back,
// the sides lean in), cut from boxwood; the character on the top face is the same artwork the flat game uses (pieces.js), so the
// two layers never disagree. Everything is procedural (no bitmaps). Units: board playing area is 72 wide, y up, row 0 of the
// flat game is the far row (-z).
import * as THREE from '../vendor3d/three.js';

export const BOARD_W = 72;                 // the playing area, any size of board
export const PLINTH_T = 2.6, SLAB_T = 9, TOP = PLINTH_T + SLAB_T;      // y of the board top
export const MARGIN = 3.6;                 // kaya border outside the grid
export const SLAB_W = BOARD_W + 2 * MARGIN;
export const PLINTH_W = SLAB_W + 7;

const rnd = (s) => () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const tex = (c, rep = null, aniso = 8) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); } return t; };
export const radialTex = (rgb, a = 1) => {
  const c = canvas(128, 128), x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(0.5, `rgba(${rgb},${a * 0.45})`); g.addColorStop(1, `rgba(${rgb},0)`); x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
};

// ---- the kaya board ---------------------------------------------------------------------------------------------------
const RANKS = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
function boardTexture(n, flip, lang, size) {
  const c = canvas(size, size), x = c.getContext('2d'), k = size / SLAB_W, m = MARGIN * k, cell = (BOARD_W * k) / n, r = rnd(91);
  const g = x.createLinearGradient(0, 0, size, size); g.addColorStop(0, '#d9a24f'); g.addColorStop(0.5, '#d19a46'); g.addColorStop(1, '#c58c3c');
  x.fillStyle = g; x.fillRect(0, 0, size, size);
  // grain: long soft ribbons with the odd darker growth ring
  for (let i = 0; i < 260; i++) {
    const y0 = r() * size, amp = (r() - 0.5) * 26, dark = r() < 0.3;
    x.strokeStyle = dark ? `rgba(150,100,38,${0.05 + r() * 0.1})` : `rgba(255,244,210,${0.05 + r() * 0.1})`; x.lineWidth = 0.6 + r() * (dark ? 2.6 : 1.8);
    x.beginPath(); x.moveTo(-10, y0); x.bezierCurveTo(size * 0.3, y0 + amp, size * 0.65, y0 - amp * 0.8, size + 10, y0 + amp * 0.3); x.stroke();
  }
  // the playing area is a touch lighter and clean
  x.fillStyle = 'rgba(255,226,160,0.10)'; x.fillRect(m, m, n * cell, n * cell);
  x.strokeStyle = '#2a1a08'; x.lineWidth = Math.max(2, size / 520); x.lineCap = 'square';
  for (let i = 0; i <= n; i++) {
    x.lineWidth = (i === 0 || i === n) ? Math.max(3, size / 340) : Math.max(2, size / 560);
    x.beginPath(); x.moveTo(m + i * cell, m); x.lineTo(m + i * cell, m + n * cell); x.stroke();
    x.beginPath(); x.moveTo(m, m + i * cell); x.lineTo(m + n * cell, m + i * cell); x.stroke();
  }
  if (n === 9) for (const a of [3, 6]) for (const b of [3, 6]) { x.fillStyle = '#2a1a08'; x.beginPath(); x.arc(m + a * cell, m + b * cell, size / 150, 0, 7); x.fill(); }
  // coordinates on the border: file numbers along the top, ranks down the right (kanji numerals in Japanese mode)
  x.fillStyle = 'rgba(46,24,4,0.9)'; x.textAlign = 'center'; x.textBaseline = 'middle';
  const fs = Math.min(m * 0.66, cell * 0.36);
  for (let i = 0; i < n; i++) {
    const cx = m + (i + 0.5) * cell, cy = m + (i + 0.5) * cell, col = flip ? i + 1 : n - i, rk = flip ? n - 1 - i : i;
    x.font = `700 ${fs}px "Cormorant Garamond", Georgia, serif`; x.fillText(String(col), cx, m * 0.5);
    x.font = lang === 'en' ? `700 ${fs}px "Cormorant Garamond", Georgia, serif` : `700 ${fs}px "Noto Serif JP", serif`;
    x.fillText(lang === 'en' ? String(rk + 1) : RANKS[rk], m + n * cell + m * 0.5, cy);
  }
  return tex(c);
}
export function buildBoard(n, flip, lang, texSize) {
  const gr = new THREE.Group(), cleanup = [];
  const lacquer = new THREE.MeshStandardMaterial({ color: 0xb5301f, roughness: 0.28, metalness: 0.05 });
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(PLINTH_W, PLINTH_T, PLINTH_W), lacquer); plinth.position.y = PLINTH_T / 2; plinth.receiveShadow = true; plinth.castShadow = true; gr.add(plinth);
  const brass = new THREE.MeshStandardMaterial({ color: 0xd9a845, roughness: 0.35, metalness: 0.7 });
  const trim = new THREE.Mesh(new THREE.BoxGeometry(PLINTH_W + 0.4, 0.5, PLINTH_W + 0.4), brass); trim.position.y = PLINTH_T - 0.2; gr.add(trim);
  const sideMat = new THREE.MeshStandardMaterial({ color: 0xb98138, roughness: 0.6 });
  const slab = new THREE.Mesh(new THREE.BoxGeometry(SLAB_W, SLAB_T, SLAB_W), sideMat); slab.position.y = PLINTH_T + SLAB_T / 2; slab.castShadow = true; slab.receiveShadow = true; gr.add(slab);
  const bt = boardTexture(n, flip, lang, texSize); cleanup.push(bt);
  const top = new THREE.Mesh(new THREE.PlaneGeometry(SLAB_W, SLAB_W).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: bt, roughness: 0.55 }));
  top.position.y = TOP + 0.02; top.receiveShadow = true; gr.add(top);
  gr.userData.dispose = () => { cleanup.forEach((t) => t.dispose()); gr.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) { [].concat(o.material).forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); }); } }); };
  return gr;
}

// ---- the tatami room ------------------------------------------------------------------------------------------------------
function tatamiTexture() {
  const S = 2048, c = canvas(S, S), x = c.getContext('2d'), r = rnd(7);
  // two mats side by side, each 1:2; weave runs along the long side
  const mw = S / 2;
  for (let m = 0; m < 2; m++) {
    const x0 = m * mw, g = x.createLinearGradient(x0, 0, x0 + mw, 0); g.addColorStop(0, '#b9b66f'); g.addColorStop(0.5, '#c5c27c'); g.addColorStop(1, '#b3b06a');
    x.fillStyle = g; x.fillRect(x0, 0, mw, S);
    for (let i = 0; i < 420; i++) {
      const px = x0 + r() * mw, lw = 1 + r() * 3; x.strokeStyle = r() < 0.5 ? `rgba(120,118,52,${0.08 + r() * 0.10})` : `rgba(240,236,170,${0.06 + r() * 0.08})`; x.lineWidth = lw * 0.7;
      x.beginPath(); x.moveTo(px, 0); x.lineTo(px + (r() - 0.5) * 4, S); x.stroke();
    }
    // the heri (cloth borders along both long edges)
    x.fillStyle = '#26301f'; x.fillRect(x0, 0, 20, S); x.fillRect(x0 + mw - 20, 0, 20, S);
    x.fillStyle = 'rgba(255,255,255,0.12)'; x.fillRect(x0 + 20, 0, 3, S);
  }
  x.fillStyle = '#26301f'; x.fillRect(0, 0, S, 14); x.fillRect(0, S - 14, S, 14);
  return tex(c, [1600 / 600, 1600 / 600], 8);
}
function windowLightTexture() {
  const S = 512, c = canvas(S, S), x = c.getContext('2d');
  x.fillStyle = '#000'; x.fillRect(0, 0, S, S);
  x.fillStyle = '#fff';
  const cols = 4, rows = 5, pw = S / cols, ph = S / rows;
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) x.fillRect(i * pw + 7, j * ph + 7, pw - 14, ph - 14);
  x.filter = 'blur(5px)'; x.drawImage(c, 0, 0); x.filter = 'none';
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export function buildRoom(scene) {
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: tatamiTexture(), roughness: 0.92 }));
  floor.receiveShadow = true; scene.add(floor);
  // shoji window light: a skewed parallelogram of soft bright panes across the floor behind and beside the board
  const wl = new THREE.Mesh(new THREE.PlaneGeometry(250, 300).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: windowLightTexture(), transparent: true, opacity: 0.2, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  wl.position.set(-30, 0.15, -120); wl.rotation.y = 0.5; wl.renderOrder = 1; scene.add(wl);
  // a few cherry petals on the mats
  const r = rnd(33), g = new THREE.CircleGeometry(1, 7).rotateX(-Math.PI / 2), pm = new THREE.MeshStandardMaterial({ color: 0xf4b7c4, roughness: 0.8, side: THREE.DoubleSide });
  const im = new THREE.InstancedMesh(g, pm, 34), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), e = new THREE.Euler();
  let k = 0;
  while (k < 34) {
    const px = (r() - 0.5) * 340, pz = (r() - 0.5) * 380;
    if (Math.abs(px) < PLINTH_W * 0.62 && Math.abs(pz) < PLINTH_W * 0.62) continue;
    e.set((r() - 0.5) * 0.3, r() * 6.28, (r() - 0.5) * 0.3); q.setFromEuler(e); const sc = 1.0 + r() * 0.9; s.set(sc * 1.3, 1, sc * 0.8); p.set(px, 0.2 + r() * 0.1, pz);
    im.setMatrixAt(k++, m4.compose(p, q, s));
  }
  im.receiveShadow = true; scene.add(im);
}
export function buildLights(scene) {
  scene.add(new THREE.HemisphereLight(0xfff4e0, 0xb7a77a, 0.6));
  const sun = new THREE.DirectionalLight(0xfff0d0, 2.1);
  sun.position.set(-45, 190, 90); sun.target.position.set(0, 0, 0); scene.add(sun, sun.target);
  const sc = sun.shadow.camera; sc.left = sc.bottom = -75; sc.right = sc.top = 75; sc.near = 20; sc.far = 400; sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.25;
  return { sun };
}

// ---- the koma ---------------------------------------------------------------------------------------------------------------
// Pentagon in master sprite pixels (pieces.js MASTER 120 x 134), centred: tip at the far end (-z), shoulders, flat back.
const geomCache = new Map();
export function pieceGeometry(f, kw) {
  const key = `${f}|${kw}`; let g = geomCache.get(key); if (g) return g;
  const w = 120 * f, h = 134 * f, pts = [[0, -h / 2], [w * 0.41, -h * 0.2], [w * 0.5, h / 2], [-w * 0.5, h / 2], [-w * 0.41, -h * 0.2]];
  const bot = pts.map(([x, z]) => [x * kw, z * kw]), topS = 0.86, th = 84 * kw;     // thickness 84 master px
  const topP = pts.map(([x, z]) => [x * kw * topS, z * kw * topS]);
  const hb = [0.72, 0.86, 1, 1, 0.86].map((v) => v * th);       // lower at the point, full at the back
  const pos = [], uv = [], idx = [];
  const push = (x, y, z, u = 0, v = 0) => { pos.push(x, y, z); uv.push(u, v); return pos.length / 3 - 1; };
  // sides
  const n = 5, side = [];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n, a = [bot[i][0], 0, bot[i][1]], b = [bot[j][0], 0, bot[j][1]], c = [topP[j][0], hb[j], topP[j][1]], d = [topP[i][0], hb[i], topP[i][1]];
    const i0 = push(...a), i1 = push(...b), i2 = push(...c), i3 = push(...d); side.push(i0, i1, i2, i0, i2, i3);
  }
  // top face: fan from the centre, UV = the sprite's wedge position (sprite is 152 x 166, wedge centred at (76, 81))
  const SW = 152, SH = 166, cx = 76, cy = 81, ctr = [0, 0, 0]; topP.forEach((p, i) => { ctr[0] += p[0] / n; ctr[1] += hb[i] / n; ctr[2] += p[1] / n; });
  const U = (px, pz) => [(cx + px / kw) / SW, 1 - (cy + pz / kw) / SH];
  const ci = push(ctr[0], ctr[1], ctr[2], ...U(ctr[0] / topS, ctr[2] / topS)), topIdx = [];
  const ti = topP.map((p, i) => push(p[0], hb[i], p[1], ...U(pts[i][0] * kw, pts[i][1] * kw)));
  for (let i = 0; i < n; i++) topIdx.push(ci, ti[(i + 1) % n], ti[i]);
  const bi = push(0, 0, 0), botIdx = [], bb = bot.map((p) => push(p[0], 0, p[1]));
  for (let i = 0; i < n; i++) botIdx.push(bi, bb[i], bb[(i + 1) % n]);
  idx.push(...side, ...topIdx, ...botIdx);
  g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  g.addGroup(0, side.length, 0); g.addGroup(side.length, topIdx.length, 1); g.addGroup(side.length + topIdx.length, botIdx.length, 0);
  g.computeVertexNormals();
  geomCache.set(key, g); return g;
}
export const sideMaterial = () => new THREE.MeshStandardMaterial({ color: 0xe2bc76, roughness: 0.5, metalness: 0.0 });
export function topMaterial(canvasEl) {
  const t = new THREE.CanvasTexture(canvasEl); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return new THREE.MeshStandardMaterial({ map: t, roughness: 0.42, metalness: 0.0, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
}

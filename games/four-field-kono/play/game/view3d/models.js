// Four-Field Kono 3D models: the painted hanji board in a lacquered frame, the river stones (Jade ring, Ember diamond) and a Joseon
// hanok room (maru floor, indigo mat, hanji window screens, silk lanterns, lattice light, dust). Pure scene construction: no sim access.
// Units: 1 = one cell of the board (about 3.5 cm of the real board). The board slab sits on y 0..THICK, stones stand on TOP.
import * as THREE from '../vendor3d/three.js';
import * as B from '../vendor3d/board3d.js';
import { PAPERS } from '../src/art.js';

export const FRAME = 0.95, THICK = 0.2, TOP = THICK + 0.006;
export const outerOf = (n) => n + 2 * FRAME;
const TAU = Math.PI * 2;
const cv = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const lcg = (seed) => { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };
export const canvasTex = (c, { srgb = true, repeat, aniso = 8 } = {}) => {
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
};
export const blobCanvas = (rgb = '0,0,0', a = 0.6, size = 128) => {
  const c = cv(size), x = c.getContext('2d'), g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(0.55, `rgba(${rgb},${a * 0.4})`); g.addColorStop(1, `rgba(${rgb},0)`);
  x.fillStyle = g; x.fillRect(0, 0, size, size); return c;
};
export const ringCanvas = (rgb = '255,255,255', size = 128, inner = 0.7) => {
  const c = cv(size), x = c.getContext('2d'), g = x.createRadialGradient(size / 2, size / 2, size * 0.5 * inner * 0.75, size / 2, size / 2, size / 2);
  g.addColorStop(0, `rgba(${rgb},0)`); g.addColorStop(inner, `rgba(${rgb},0.95)`); g.addColorStop(Math.min(0.97, inner + 0.16), `rgba(${rgb},0.35)`); g.addColorStop(1, `rgba(${rgb},0)`);
  x.fillStyle = g; x.fillRect(0, 0, size, size); return c;
};

// ------------------------------------------------------------------------------------------------ the board
// One canvas for the whole top: lacquered frame, brass keyline, hanji paper (fibres, dyed home bands), brush lines, ink dots, coordinates.
// A second canvas packs roughness (G) and clearcoat (R): the frame is glossy lacquer, the paper is matte with a faint sheen.
function paintTop(N, pal, flip, P, bandRGB) {
  const OUT = outerOf(N), PL = OUT - 0.1, W = Math.round(PL * P);
  const c = cv(W), x = c.getContext('2d'), m = cv(W), mx = m.getContext('2d');
  const rnd = lcg(11 + N * 17 + pal.ink.length);
  const U = P / 100;                                     // canvas px per board unit (100 per cell)
  x.save(); x.translate(-0.05 * P, -0.05 * P); x.scale(U, U);
  const Wd = OUT * 100, FR = (OUT - N) * 50, gx = FR, gy = FR, G = N * 100, PM = 50;
  const rr = (ctx, a, b, w, h, r) => { ctx.beginPath(); ctx.roundRect(a, b, w, h, r); };
  const tg = x.createLinearGradient(0, 0, Wd, Wd); tg.addColorStop(0, pal.frame[0]); tg.addColorStop(0.5, pal.frame[1]); tg.addColorStop(1, pal.frame[2]);
  x.fillStyle = tg; x.fillRect(-10, -10, Wd + 20, Wd + 20);
  for (let k = 0; k < 40; k++) { const y = rnd() * Wd; x.strokeStyle = `rgba(255,220,180,${0.02 + rnd() * 0.05})`; x.lineWidth = 1 + rnd() * 3; x.beginPath(); x.moveTo(0, y); x.bezierCurveTo(Wd * 0.3, y + (rnd() - 0.5) * 30, Wd * 0.7, y + (rnd() - 0.5) * 30, Wd, y + (rnd() - 0.5) * 20); x.stroke(); }
  const px0 = gx - PM, py0 = gy - PM, pw = G + 2 * PM;
  x.strokeStyle = 'rgba(240,200,120,0.9)'; x.lineWidth = 3.5; rr(x, px0 - 7, py0 - 7, pw + 14, pw + 14, 10); x.stroke();
  const pg = x.createLinearGradient(px0, py0, px0 + pw, py0 + pw); pg.addColorStop(0, pal.paper[0]); pg.addColorStop(0.55, pal.paper[1]); pg.addColorStop(1, pal.paper[2]);
  x.fillStyle = pg; rr(x, px0, py0, pw, pw, 6); x.fill();
  x.save(); rr(x, px0, py0, pw, pw, 6); x.clip();
  for (let k = 0; k < 900; k++) {
    const fx = px0 + rnd() * pw, fy = py0 + rnd() * pw, a = rnd() * TAU, l = 6 + rnd() * 30, dark = rnd() < 0.55;
    x.strokeStyle = dark ? `rgba(${pal.fibre[0]},${pal.fibre[1]},${pal.fibre[2]},${0.05 + rnd() * 0.1})` : `rgba(255,255,245,${0.1 + rnd() * 0.14})`; x.lineWidth = 0.7 + rnd() * 1.4;
    x.beginPath(); x.moveTo(fx, fy); x.quadraticCurveTo(fx + Math.cos(a) * l * 0.5 + (rnd() - 0.5) * 6, fy + Math.sin(a) * l * 0.5 + (rnd() - 0.5) * 6, fx + Math.cos(a) * l, fy + Math.sin(a) * l); x.stroke();
  }
  // dyed home bands: Jade's side and Ember's side, washed into the paper
  for (const [rgb, top] of [[bandRGB[0], flip ? false : true], [bandRGB[1], flip ? true : false]]) {
    const y0 = top ? py0 : py0 + pw, y1 = top ? py0 + 130 : py0 + pw - 130, bg = x.createLinearGradient(0, y0, 0, y1);
    bg.addColorStop(0, `rgba(${rgb[0]},${rgb[1]},${rgb[2]},${pal.band * 1.5})`); bg.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = bg; x.fillRect(px0, top ? py0 : py0 + pw - 130, pw, 130);
  }
  const is = x.createLinearGradient(0, py0, 0, py0 + 40); is.addColorStop(0, 'rgba(0,0,0,0.3)'); is.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = is; x.fillRect(px0, py0, pw, 40);
  const il = x.createLinearGradient(px0, 0, px0 + 40, 0); il.addColorStop(0, 'rgba(0,0,0,0.24)'); il.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = il; x.fillRect(px0, py0, 40, pw);
  x.restore();
  // brush-drawn lines (a touch of unevenness per stroke, heavier on the outer square)
  x.strokeStyle = pal.ink; x.lineCap = 'round';
  for (let i = 0; i <= N; i++) for (const horiz of [true, false]) {
    const a = (rnd() - 0.5) * 2.6, w0 = i === 0 || i === N ? 7 : 4.8;
    x.lineWidth = w0; x.globalAlpha = i === 0 || i === N ? 0.96 : 0.88; x.beginPath();
    if (horiz) { x.moveTo(gx, gy + i * 100); x.quadraticCurveTo(gx + G / 2, gy + i * 100 + a, gx + G, gy + i * 100); }
    else { x.moveTo(gx + i * 100, gy); x.quadraticCurveTo(gx + i * 100 + a, gy + G / 2, gx + i * 100, gy + G); }
    x.stroke();
  }
  x.globalAlpha = 1; x.fillStyle = pal.ink;
  for (let r = 0; r <= N; r++) for (let q = 0; q <= N; q++) { x.beginPath(); x.arc(gx + q * 100, gy + r * 100, 9, 0, TAU); x.fill(); }
  x.fillStyle = 'rgba(255,232,196,0.78)'; x.font = '700 24px system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  for (let i = 0; i <= N; i++) { x.fillText('abcdefg'[flip ? N - i : i], gx + i * 100, Wd - (FR - PM) / 2 - 2); x.fillText(String(flip ? i + 1 : N + 1 - i), (FR - PM) / 2 + 1, gy + i * 100); }
  x.restore();
  // roughness (G) / clearcoat (R): frame gloss, paper matte
  mx.fillStyle = 'rgb(255,70,0)'; mx.fillRect(0, 0, W, W);
  mx.save(); mx.translate(-0.05 * P, -0.05 * P); mx.scale(U, U);
  mx.fillStyle = 'rgb(46,225,0)'; rr(mx, px0, py0, pw, pw, 6); mx.fill(); mx.restore();
  return { map: c, rough: m };
}

const BAND = { 1: [143, 215, 187], 2: [232, 102, 58] };
export function buildBoard(N, paperKey, flip, quality = 1) {
  const OUT = outerOf(N), PL = OUT - 0.1, pal = PAPERS[paperKey] || PAPERS.hanji;
  const g = new THREE.Group();
  const P = Math.round(Math.min(2048, 190 * OUT * (quality > 0.6 ? 1 : 0.6)) / 8) * 8 / OUT;
  const t = paintTop(N, pal, flip, P, [BAND[1], BAND[2]]);
  const body = new THREE.Mesh(B.slab(OUT, OUT, THICK, 0.1, 0.05), B.material('darkWood', { color: pal.frame[1], color2: pal.frame[0], repeat: [3, 1], seed: 7 }));
  body.castShadow = true; body.receiveShadow = true; g.add(body);
  const map = canvasTex(t.map), rm = canvasTex(t.rough, { srgb: false });
  const topMat = new THREE.MeshPhysicalMaterial({ map, roughnessMap: rm, clearcoatMap: rm, roughness: 1, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.14 });
  const geo = new THREE.PlaneGeometry(PL, PL); geo.rotateX(-Math.PI / 2);
  const top = new THREE.Mesh(geo, topMat); top.position.y = THICK + 0.003; top.receiveShadow = true; g.add(top);
  g.userData = { N, OUT, dispose() { map.dispose(); rm.dispose(); topMat.dispose(); geo.dispose(); body.geometry.dispose(); body.material.dispose(); } };
  return g;
}

// ------------------------------------------------------------------------------------------------ the stones
const STONE_H = 0.27, STONE_R = 0.4;
let stoneGeo = null;
const stoneProfile = () => [[0, 0], [0.30, 0], [0.37, 0.02], [0.405, 0.06], [0.405, 0.1], [0.37, 0.15], [0.29, 0.2], [0.17, 0.235], [0.07, 0.25], [0, 0.254]];
const stoneMats = {};
function stoneMat(side) {
  if (stoneMats[side]) return stoneMats[side];
  const m = side === 1
    ? B.material('stone', { color: '#7fd3b0', color2: '#2f8f70', physical: true, roughness: 0.34, size: 256, seed: 21 })
    : B.material('stone', { color: '#d9561c', color2: '#7a1d08', physical: true, roughness: 0.34, size: 256, seed: 22 });
  m.clearcoat = 0.7; m.clearcoatRoughness = 0.12; m.envMapIntensity = 0.7; if (m.sheen !== undefined) { m.sheen = 0.4; m.sheenColor = new THREE.Color(side === 1 ? '#d9fff0' : '#ffd3b0'); }
  stoneMats[side] = m; return m;
}
export function makeStone(side) {
  if (!stoneGeo) stoneGeo = B.lathe(stoneProfile(), 40);
  const g = new THREE.Group(), body = new THREE.Mesh(stoneGeo, stoneMat(side));
  body.castShadow = true; body.receiveShadow = true; g.add(body);
  const groove = new THREE.MeshStandardMaterial({ color: side === 1 ? '#2a6f58' : '#4d1204', roughness: 0.55, metalness: 0 });
  if (side === 1) {
    const tor = new THREE.Mesh(new THREE.TorusGeometry(0.155, 0.017, 8, 40), groove); tor.rotation.x = Math.PI / 2; tor.position.y = 0.252; tor.scale.set(1, 1, 0.8); g.add(tor);
  } else {
    for (let k = 0; k < 4; k++) {
      const a = (k + 0.5) * (TAU / 4), r = 0.115, e = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.016, 0.03), groove);
      e.position.set(Math.cos(a) * r, 0.252, Math.sin(a) * r); e.rotation.y = -a - Math.PI / 2; g.add(e);
    }
  }
  g.userData.body = body;
  return g;
}
export const STONE = { H: STONE_H, R: STONE_R };

// ------------------------------------------------------------------------------------------------ the room
function plankCanvas() {
  const S = 1024, c = cv(S), x = c.getContext('2d'), rnd = lcg(5), n = 4, h = S / n;
  for (let i = 0; i < n; i++) {
    const tone = 0.85 + rnd() * 0.3, w = B.woodCanvas(512, `rgb(${Math.round(150 * tone)},${Math.round(98 * tone)},${Math.round(50 * tone)})`, `rgb(${Math.round(190 * tone)},${Math.round(130 * tone)},${Math.round(72 * tone)})`, 3 + i * 7, { lines: 70, knots: 1 }).map;
    x.drawImage(w, 0, i * h, S, h);
    x.fillStyle = 'rgba(30,14,4,0.65)'; x.fillRect(0, i * h, S, 3);                    // the seam between two boards
    const cut = rnd() * S; x.fillStyle = 'rgba(30,14,4,0.55)'; x.fillRect(cut, i * h, 3, h);   // an end joint
  }
  return c;
}
function latticeCanvas() {          // a munsal door lattice: the light that falls through a paper window onto the floor
  const S = 512, c = cv(S), x = c.getContext('2d');
  x.fillStyle = '#000'; x.fillRect(0, 0, S, S);
  x.fillStyle = '#fff';
  const cell = S / 8, bar = 5;
  for (let i = 0; i <= 8; i++) { x.fillRect(i * cell - bar / 2, 0, bar, S); x.fillRect(0, i * cell - bar / 2, S, bar); }
  x.strokeStyle = '#fff'; x.lineWidth = 5;
  for (let i = 0; i < 0; i++) for (let j = 0; j < 0; j++) { if ((i + j) % 2) continue; x.beginPath(); x.moveTo(i * cell + cell * 0.2, j * cell + cell * 0.5); x.lineTo(i * cell + cell * 0.5, j * cell + cell * 0.2); x.lineTo(i * cell + cell * 0.8, j * cell + cell * 0.5); x.lineTo(i * cell + cell * 0.5, j * cell + cell * 0.8); x.closePath(); x.stroke(); }
  return c;
}
function windowCanvas(w = 256, h = 384) {   // paper in a lattice frame, lit from behind
  const c = cv(w, h), x = c.getContext('2d'), rnd = lcg(31);
  const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#fff2cf'); g.addColorStop(1, '#f0c98a'); x.fillStyle = g; x.fillRect(0, 0, w, h);
  for (let k = 0; k < 120; k++) { x.strokeStyle = `rgba(120,80,30,${0.04 + rnd() * 0.06})`; x.lineWidth = 1; x.beginPath(); const fx = rnd() * w, fy = rnd() * h, a = rnd() * TAU; x.moveTo(fx, fy); x.lineTo(fx + Math.cos(a) * 14, fy + Math.sin(a) * 14); x.stroke(); }
  x.strokeStyle = '#3a2210'; x.lineWidth = 7;
  for (let i = 0; i <= 4; i++) { x.beginPath(); x.moveTo(i * w / 4, 0); x.lineTo(i * w / 4, h); x.stroke(); }
  for (let j = 0; j <= 6; j++) { x.beginPath(); x.moveTo(0, j * h / 6); x.lineTo(w, j * h / 6); x.stroke(); }
  x.lineWidth = 12; x.strokeRect(2, 2, w - 4, h - 4);
  return c;
}

export function buildRoom({ quality = 1 } = {}) {
  const g = new THREE.Group(), anim = [];
  // maru floor (wide planks), an indigo mat under the board
  const plank = canvasTex(plankCanvas(), { repeat: [4, 4] });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), new THREE.MeshPhysicalMaterial({ map: plank, roughness: 0.55, clearcoat: 0.5, clearcoatRoughness: 0.3, color: '#9c8068' }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -0.06; floor.receiveShadow = true; g.add(floor);
  const mat = new THREE.Mesh(B.slab(30, 22, 0.06, 0.25, 0.03), B.material('cloth', { color: '#141d3a', color2: '#22325f', repeat: [30, 22], size: 256 }));
  mat.position.set(0, -0.06, 3); mat.receiveShadow = true; g.add(mat);
  const matEdge = new THREE.Mesh(B.slab(30.5, 22.5, 0.05, 0.28, 0.02), new THREE.MeshStandardMaterial({ color: '#b8923e', roughness: 0.45, metalness: 0.7 }));
  matEdge.position.set(0, -0.062, 3); g.add(matEdge);
  g.userData.mat = mat; g.userData.matEdge = matEdge;
  const bs = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: canvasTex(blobCanvas('0,0,0', 0.9, 128)), transparent: true, opacity: 0.7, depthWrite: false }));
  bs.rotation.x = -Math.PI / 2; bs.position.set(0.12, 0.004, 0.2); bs.renderOrder = 0; g.add(bs); g.userData.bs = bs;

  // back wall: dark timber with three lit hanji windows
  const wall = new THREE.Group(); wall.position.set(0, 0, -7.5);
  const timber = B.material('darkWood', { color: '#3a2415', color2: '#58361e', repeat: [4, 1], seed: 12 });
  const back = new THREE.Mesh(new THREE.BoxGeometry(34, 6.5, 0.4), timber); back.position.set(0, 3.1, -0.3); back.receiveShadow = true; wall.add(back);
  const winTex = canvasTex(windowCanvas());
  const glowMat = new THREE.MeshBasicMaterial({ map: winTex, color: '#e9b36e', toneMapped: false, fog: false });
  const win = [];
  for (const x of [-9.6, -4.8, 0, 4.8, 9.6]) {
    const frame = new THREE.Mesh(new THREE.BoxGeometry(4.2, 4.4, 0.3), timber); frame.position.set(x, 2.8, -0.02); wall.add(frame);
    const p = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 3.95), glowMat); p.position.set(x, 2.8, 0.14); wall.add(p); win.push(p);
  }
  g.add(wall);
  const beam = new THREE.Mesh(B.roundedBox(34, 0.5, 0.7, 0.08), timber); beam.position.set(0, 5.6, -6.7); g.add(beam);

  // silk lanterns (cheongsachorong): a barrel of silk with gold ribs, a tassel, and a glow
  const lanterns = [];
  const silks = [['#d6402a', '#ffb070'], ['#2a58c8', '#9bc4ff'], ['#d6402a', '#ffb070'], ['#2a58c8', '#9bc4ff']];
  silks.push(silks[0], silks[1]);
  const lanternAt = (px, py, pz, k) => {
    const gr = new THREE.Group(); gr.position.set(px, py, pz);
    const prof = [[0, -0.5], [0.16, -0.5], [0.3, -0.42], [0.44, -0.2], [0.5, 0], [0.44, 0.2], [0.3, 0.42], [0.16, 0.5], [0, 0.5]];
    const silk = new THREE.MeshStandardMaterial({ color: silks[k][0], emissive: silks[k][1], emissiveIntensity: 1.5, roughness: 0.6 });
    const body = new THREE.Mesh(B.lathe(prof.map(([r, y]) => [r * 1.0, y + 0.5]), 28), silk); body.position.y = -0.5; gr.add(body);
    const gold = B.material('brass', { envIntensity: 1.5 });
    for (const y of [0.5, -0.5]) { const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.08, 20), gold); cap.position.y = y; gr.add(cap); }
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 2.2, 6), new THREE.MeshBasicMaterial({ color: '#3a2415' })); cord.position.y = 1.6; gr.add(cord);
    const tas = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.075, 0.6, 10), new THREE.MeshStandardMaterial({ color: silks[k][0], roughness: 0.7 })); tas.position.y = -0.85; gr.add(tas);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTex(blobCanvas('255,190,120', 0.95, 128)), color: silks[k][1], transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    glow.scale.setScalar(2.6); gr.add(glow);
    g.add(gr); lanterns.push({ gr, glow, ph: k * 1.7 });
  };
  lanternAt(-1.7, 3.1, -4.2, 0); lanternAt(1.9, 2.8, -4.6, 1); lanternAt(-5.6, 3.2, -4.8, 3); lanternAt(5.8, 3.0, -4.9, 2); lanternAt(-9.2, 3.3, -5.4, 0); lanternAt(9.4, 3.1, -5.2, 1);

  // lattice light on the floor and on the paper
  const latTex = canvasTex(latticeCanvas(), { srgb: false, repeat: [1, 1] }); latTex.wrapS = latTex.wrapT = THREE.RepeatWrapping;
  const latMat = new THREE.MeshBasicMaterial({ map: latTex, color: '#ffcf8a', transparent: true, opacity: 0.035, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  const latGeo = new THREE.PlaneGeometry(40, 40, 1, 1); latGeo.rotateX(-Math.PI / 2);
  const lat = new THREE.Mesh(latGeo, latMat); lat.position.set(0, 0.012 - 0.06 + 0.06, -4); lat.renderOrder = 0; lat.rotation.y = 0.25; latTex.repeat.set(5, 5); g.add(lat);

  // warm pools of lantern light on the mat
  const poolTex = canvasTex(blobCanvas('255,196,120', 0.9, 128));
  for (const [px, pz, sz] of [[-4.2, -1.2, 9], [4.4, -1.6, 9], [0, 3.6, 7]]) {
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(sz, sz), new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
    pl.rotation.x = -Math.PI / 2; pl.position.set(px, 0.006, pz); g.add(pl);
  }
  // dust drifting in the light
  const N = quality > 0.6 ? 70 : 36, pos = new Float32Array(N * 3), seed = lcg(77);
  for (let i = 0; i < N; i++) { pos[i * 3] = (seed() - 0.5) * 18; pos[i * 3 + 1] = 0.3 + seed() * 5; pos[i * 3 + 2] = (seed() - 0.5) * 14; }
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const dust = new THREE.Points(pg, new THREE.PointsMaterial({ map: canvasTex(blobCanvas('255,226,170', 1, 64)), size: 0.1, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true, fog: false }));
  dust.frustumCulled = false; g.add(dust);

  // two lidded stone bowls beside the mat
  const bowlMat = B.material('darkWood', { color: '#2a1a10', color2: '#4a2c18', repeat: [2, 2] });
  const bowl = (x, z, side) => {
    const b = new THREE.Group();
    b.add(B.piece([[0, 0], [0.5, 0], [0.62, 0.12], [0.74, 0.34], [0.78, 0.5], [0.7, 0.5], [0.62, 0.3], [0.5, 0.2], [0, 0.2]].map(([r, y]) => [r * 0.9, y]), bowlMat));
    const heap = new THREE.Group();
    for (let k = 0; k < 9; k++) { const s = makeStone(side), a = k * 2.4; s.position.set(Math.cos(a) * 0.3 * (k % 3) * 0.7, 0.18 + (k / 9) * 0.22, Math.sin(a) * 0.3 * (k % 3) * 0.7); s.rotation.set(0.4 * Math.sin(a * 3), a, 0.35 * Math.cos(a * 2)); s.scale.setScalar(0.62); heap.add(s); }
    b.add(heap); b.position.set(x, 0, z); return b;
  };
  const bowls = [bowl(-3.9, 4.4, 1), bowl(4.0, 4.1, 2)]; bowls.forEach((b) => g.add(b));

  return {
    group: g, lanterns, win, lat, dust, bowls, setLayout(boardN) { const o = outerOf(boardN); bs.scale.set(o * 1.3, o * 1.3, 1); },
    update(t, calm, dt) {
      const sway = calm ? 0 : 1;
      for (const L of lanterns) { L.gr.rotation.z = Math.sin(t * 0.8 + L.ph) * 0.05 * sway; L.gr.rotation.x = Math.cos(t * 0.6 + L.ph * 1.3) * 0.03 * sway; L.glow.material.opacity = 0.72 + (calm ? 0 : 0.14 * Math.sin(t * 7.3 + L.ph * 3) * Math.sin(t * 2.9 + L.ph)); }
      const fl = calm ? 0 : 0.03 * Math.sin(t * 9.1) * Math.sin(t * 3.3 + 1);
      latMat.opacity = 0.04 + fl * 0.4; lat.position.x = calm ? 0 : Math.sin(t * 0.07) * 0.6;
      if (!calm) {
        const a = pg.attributes.position;
        for (let i = 0; i < N; i++) { a.array[i * 3 + 1] += dt * (0.05 + (i % 5) * 0.015); a.array[i * 3] += Math.sin(t * 0.3 + i) * dt * 0.08; if (a.array[i * 3 + 1] > 5.6) a.array[i * 3 + 1] = 0.3; }
        a.needsUpdate = true;
      }
      return fl;
    },
  };
}

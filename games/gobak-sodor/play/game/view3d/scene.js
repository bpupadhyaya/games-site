// The village set of Gobak Sodor (game-owned, presentation only). One function builds the whole lit world around the court so the
// presenter and the icon render share it: packed-earth court with chalk lines, a low earth bund, a bamboo fence with bunting, a woven
// home mat, banana trees, frangipani, timber houses with clay-tile roofs, and the cheering children. World units are metres, the
// ground is y = 0, the court is centred on the origin (x across, z up and down the screen: the far end is negative z).
import { CW, CX, CELL, GX, PAD, courtDims, cellY } from '../src/layout.js';
import { W } from '../src/engine.js';

export const S = 0.0142;                       // metres per canonical court unit: one cell (92 units) is about 1.3 m
const TAU = Math.PI * 2;
const lcg = (seed) => { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };
const clampN = (v, a, b) => (v < a ? a : v > b ? b : v);

// ---------------------------------------------------------------------------------------------------------------- textures
function canvasOf(doc, w, h) { const c = doc.createElement('canvas'); c.width = Math.max(2, Math.round(w)); c.height = Math.max(2, Math.round(h)); return c; }

/** The court ground in canonical court units (720 wide, ch tall): swept earth, lane washes, chalk lines. Ragged, feathered edge. */
export function paintCourtGround(g, ln, pitch, k) {
  const D = courtDims(ln, pitch), H = D.ch, rows = D.rows, r = lcg(31 + ln);
  const cy_ = (row) => cellY(row, ln, pitch);
  const x0 = GX - 22, x1 = GX + W * CELL + 22, y0 = PAD - 24, y1 = H - PAD + 24;
  g.save(); g.scale(k, k);
  // packed earth with big soft mottling (sun-baked patches, damp patches)
  g.beginPath(); g.roundRect(x0, y0, x1 - x0, y1 - y0, 30); g.clip();
  const base = g.createLinearGradient(0, y0, 0, y1); base.addColorStop(0, '#cf9d52'); base.addColorStop(0.5, '#c98f45'); base.addColorStop(1, '#bd813a');
  g.fillStyle = base; g.fillRect(x0, y0, x1 - x0, y1 - y0);
  for (let i = 0; i < 70; i++) {
    const x = x0 + r() * (x1 - x0), y = y0 + r() * (y1 - y0), rad = 40 + r() * 110, warm = r() > 0.5;
    const rg = g.createRadialGradient(x, y, 0, x, y, rad);
    rg.addColorStop(0, warm ? `rgba(255,214,140,${0.06 + r() * 0.08})` : `rgba(110,60,16,${0.08 + r() * 0.1})`); rg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = rg; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  // lane washes: home lane (cool blue-green), far lane (jade); every other lane a faint raked band so rows read at a glance
  for (let row = 0; row < rows; row++) {
    const y = cy_(row) - pitch / 2;
    if (row === 0) g.fillStyle = 'rgba(40,130,160,0.42)';
    else if (row === rows - 1) g.fillStyle = 'rgba(40,160,90,0.46)';
    else if (row % 2 === 0) g.fillStyle = 'rgba(255,236,180,0.10)';
    else g.fillStyle = 'rgba(90,44,6,0.12)';
    g.fillRect(x0, y, x1 - x0, pitch);
  }
  // rake marks, grit, pebbles, footprints
  for (let i = 0; i < 46; i++) { g.strokeStyle = `rgba(110,70,30,${0.05 + r() * 0.07})`; g.lineWidth = 1 + r() * 2; const y = y0 + r() * (y1 - y0), x = x0 + r() * (x1 - x0 - 220); g.beginPath(); g.moveTo(x, y); g.bezierCurveTo(x + 70, y - 5 + r() * 10, x + 150, y - 4 + r() * 9, x + 210, y - 6 + r() * 12); g.stroke(); }
  for (let i = 0; i < 1500; i++) { const dark = r() > 0.55; g.fillStyle = dark ? `rgba(100,62,24,${0.05 + r() * 0.1})` : `rgba(255,248,225,${0.07 + r() * 0.12})`; g.beginPath(); g.ellipse(x0 + r() * (x1 - x0), y0 + r() * (y1 - y0), 0.8 + r() * 2.2, 0.6 + r() * 1.5, r() * 3, 0, TAU); g.fill(); }
  for (let i = 0; i < 26; i++) { const x = x0 + 20 + r() * (x1 - x0 - 40), y = y0 + 20 + r() * (y1 - y0 - 40), a = -1.57 + (r() - 0.5) * 1.2; g.save(); g.translate(x, y); g.rotate(a); g.fillStyle = 'rgba(96,58,22,0.13)'; for (const dx of [-5, 5]) { g.beginPath(); g.ellipse(dx, r() * 4, 3.2, 7, 0, 0, TAU); g.fill(); } g.restore(); }
  // chalk: rough, dusty, never a ruler line (jittered segments, a wide soft halo, bright core, powder specks)
  const chalkLine = (ax, ay, bx, by, wd, a) => {
    const len = Math.hypot(bx - ax, by - ay), n = Math.max(2, Math.round(len / 9)), ux = (bx - ax) / len, uy = (by - ay) / len;
    g.lineCap = 'round';
    for (const [lw, al, jit] of [[wd * 1.7, a * 0.16, 1.4], [wd * 1.15, a * 0.5, 1.0], [wd * 0.8, a, 0.6]]) {
      g.strokeStyle = `rgba(255,253,244,${al})`; g.lineWidth = lw; g.beginPath();
      for (let i = 0; i <= n; i++) { const t = i / n, j = (r() - 0.5) * jit; const px = ax + (bx - ax) * t - uy * j, py = ay + (by - ay) * t + ux * j; if (i) g.lineTo(px, py); else g.moveTo(px, py); }
      g.stroke();
    }
    for (let i = 0; i < len / 3; i++) { const t = r(), o = (r() - 0.5) * wd * 3.2; g.fillStyle = `rgba(255,252,240,${0.2 + r() * 0.45})`; g.beginPath(); g.arc(ax + (bx - ax) * t - uy * o, ay + (by - ay) * t + ux * o, 0.5 + r() * 1.3, 0, TAU); g.fill(); }
  };
  const xl = GX - 2, xr = GX + W * CELL + 2, top = cy_(rows - 1) - pitch / 2, bot = cy_(0) + pitch / 2;
  chalkLine(xl, top, xr, top, 7, 0.95); chalkLine(xl, bot, xr, bot, 7, 0.95); chalkLine(xl, top, xl, bot, 7, 0.95); chalkLine(xr, top, xr, bot, 7, 0.95);
  for (let q = 0; q < ln; q++) chalkLine(xl, cy_(2 * q + 1), xr, cy_(2 * q + 1), 7.5, 1);
  g.fillStyle = 'rgba(255,252,240,0.7)'; const cx = CX;
  for (let y = top + 14; y < bot - 10; y += 18) { g.beginPath(); g.arc(cx + (r() - 0.5) * 2, y, 2.2 + r() * 0.9, 0, TAU); g.fill(); }
  // tiny cell marks (scuffs) so the grid reads without a ruler
  g.fillStyle = 'rgba(110,70,28,0.2)';
  for (let row = 0; row < rows; row += 2) for (let c = 0; c < W; c++) { g.beginPath(); g.arc(GX + c * CELL + CELL / 2, cy_(row), 2.6, 0, TAU); g.fill(); }
  // soft shade at the left and right edges (a bund casts a little shadow)
  const sh = g.createLinearGradient(x0, 0, x0 + 46, 0); sh.addColorStop(0, 'rgba(70,36,0,0.30)'); sh.addColorStop(1, 'rgba(70,36,0,0)'); g.fillStyle = sh; g.fillRect(x0, y0, 46, y1 - y0);
  const sh2 = g.createLinearGradient(x1, 0, x1 - 46, 0); sh2.addColorStop(0, 'rgba(70,36,0,0.30)'); sh2.addColorStop(1, 'rgba(70,36,0,0)'); g.fillStyle = sh2; g.fillRect(x1 - 46, y0, 46, y1 - y0);
  g.restore();
}

function grassTexture(doc, size = 512) {
  const c = canvasOf(doc, size, size), g = c.getContext('2d'), r = lcg(77);
  g.fillStyle = '#5c8a38'; g.fillRect(0, 0, size, size);
  for (let i = 0; i < 90; i++) { const x = r() * size, y = r() * size, rad = 30 + r() * 90, warm = r() > 0.6; for (const dx of [-size, 0, size]) for (const dy of [-size, 0, size]) { const rg = g.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, rad); rg.addColorStop(0, warm ? `rgba(168,170,78,${0.14 + r() * 0.12})` : `rgba(28,70,24,${0.12 + r() * 0.12})`); rg.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = rg; g.fillRect(x + dx - rad, y + dy - rad, rad * 2, rad * 2); } }
  for (let i = 0; i < 5200; i++) { const x = r() * size, y = r() * size, l = 3 + r() * 7, a = -1.57 + (r() - 0.5) * 0.9; g.strokeStyle = r() > 0.5 ? `rgba(120,170,64,${0.25 + r() * 0.3})` : `rgba(30,72,26,${0.25 + r() * 0.3})`; g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
  return c;
}
function earthPath(doc) {
  const c = canvasOf(doc, 256, 256), g = c.getContext('2d'), r = lcg(5);
  g.fillStyle = '#b08a52'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i++) { g.fillStyle = r() > 0.5 ? `rgba(255,236,190,${0.1 + r() * 0.15})` : `rgba(90,56,22,${0.1 + r() * 0.15})`; g.beginPath(); g.arc(r() * 256, r() * 256, 0.6 + r() * 2.2, 0, TAU); g.fill(); }
  return c;
}
function woodTexture(doc, a = '#8b5a2e', b = '#6e4420', planks = 6) {
  const c = canvasOf(doc, 256, 256), g = c.getContext('2d'), r = lcg(a.length * 7 + planks);
  g.fillStyle = a; g.fillRect(0, 0, 256, 256);
  for (let p = 0; p < planks; p++) { const x = p * 256 / planks; g.fillStyle = p % 2 ? b : a; g.fillRect(x, 0, 256 / planks - 2, 256); g.fillStyle = 'rgba(30,14,4,0.55)'; g.fillRect(x + 256 / planks - 2, 0, 2, 256); for (let i = 0; i < 14; i++) { g.strokeStyle = `rgba(40,20,6,${0.08 + r() * 0.14})`; g.lineWidth = 0.7; const xx = x + r() * (256 / planks - 4); g.beginPath(); g.moveTo(xx, 0); g.bezierCurveTo(xx + 3, 80, xx - 3, 170, xx + 1, 256); g.stroke(); } }
  return c;
}
function plasterTexture(doc) {
  const c = canvasOf(doc, 256, 256), g = c.getContext('2d'), r = lcg(41);
  g.fillStyle = '#efe5cc'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(${r() > 0.5 ? '120,96,60' : '255,255,245'},${0.04 + r() * 0.09})`; g.beginPath(); g.arc(r() * 256, r() * 256, 2 + r() * 14, 0, TAU); g.fill(); }
  g.fillStyle = 'rgba(90,60,30,0.28)'; g.fillRect(0, 220, 256, 36);
  return c;
}
function tileTexture(doc) {
  const c = canvasOf(doc, 256, 256), g = c.getContext('2d'), r = lcg(19);
  g.fillStyle = '#b4532f'; g.fillRect(0, 0, 256, 256);
  for (let row = 0; row < 16; row++) for (let col = 0; col < 16; col++) { g.fillStyle = `rgba(${r() > 0.5 ? '255,160,110' : '70,20,8'},${0.08 + r() * 0.18})`; g.fillRect(col * 16 + 1, row * 16 + 1, 14, 14); }
  g.strokeStyle = 'rgba(40,10,2,0.5)'; g.lineWidth = 1.5; for (let i = 0; i <= 16; i++) { g.beginPath(); g.moveTo(i * 16, 0); g.lineTo(i * 16, 256); g.stroke(); g.beginPath(); g.moveTo(0, i * 16); g.lineTo(256, i * 16); g.stroke(); }
  return c;
}
function matTexture(doc) {
  const c = canvasOf(doc, 512, 128), g = c.getContext('2d');
  g.fillStyle = '#7a4a26'; g.fillRect(0, 0, 512, 128);
  for (let i = 0; i < 64; i++) { g.fillStyle = i % 2 ? '#a36d3b' : '#8a5a2e'; g.fillRect(i * 8, 0, 6, 128); }
  for (let j = 0; j < 10; j++) { g.fillStyle = 'rgba(30,14,4,0.28)'; g.fillRect(0, j * 13 + 4, 512, 3); }
  g.strokeStyle = 'rgba(255,224,150,0.7)'; g.lineWidth = 6; g.strokeRect(3, 3, 506, 122);
  return c;
}
function leafTexture(doc) {
  const c = canvasOf(doc, 128, 256), g = c.getContext('2d'), r = lcg(3);
  const gr = g.createLinearGradient(0, 0, 128, 0); gr.addColorStop(0, '#3f8a2a'); gr.addColorStop(0.5, '#6cb83c'); gr.addColorStop(1, '#3a7d26'); g.fillStyle = gr; g.fillRect(0, 0, 128, 256);
  g.strokeStyle = 'rgba(40,86,20,0.55)'; g.lineWidth = 1; for (let i = 0; i < 40; i++) { const y = i * 6.4; g.beginPath(); g.moveTo(64, y); g.lineTo(2 + r() * 8, y + 14); g.moveTo(64, y); g.lineTo(126 - r() * 8, y + 14); g.stroke(); }
  g.strokeStyle = 'rgba(214,236,150,0.9)'; g.lineWidth = 3; g.beginPath(); g.moveTo(64, 0); g.lineTo(64, 256); g.stroke();
  return c;
}
function puffTexture(doc) {
  const c = canvasOf(doc, 64, 64), g = c.getContext('2d'), rg = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  rg.addColorStop(0, 'rgba(255,255,255,0.95)'); rg.addColorStop(0.45, 'rgba(255,255,255,0.45)'); rg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = rg; g.fillRect(0, 0, 64, 64);
  return c;
}

// ---------------------------------------------------------------------------------------------------------------- the set
/**
 * buildSet({ THREE, B, doc, quality, root }) -> set
 *   set.layout(ln, pitch)   place everything that depends on the court size (rows, stretched rows)
 *   set.update(dt, camera)  wind, bunting, puffs (call with the sim dt, so pause freezes the village)
 *   set.puff(kind, x, z, strength)   'dust' | 'chalk' | 'confetti' (the presenter calls it from foot events)
 *   set.crowdPoints(ln, pitch, many)  where the children stand
 */
export function buildSet({ THREE, B, doc = globalThis.document, quality = 'medium', root }) {
  const set = { group: new THREE.Group(), meshes: [], windy: [], flags: null, ln: -1, pitch: -1, ch: 0 };
  root.add(set.group);
  const tex = (canvas, o = {}) => { const t = new THREE.CanvasTexture(canvas); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = o.aniso ?? 4; if (o.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(o.repeat[0], o.repeat[1]); } return t; };
  const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0, ...o });
  const lit = (m, cast = true, recv = true) => { m.castShadow = cast; m.receiveShadow = recv; return m; };
  const add = (m, parent = set.group) => { parent.add(m); return m; };

  // ---- ground around the court (world tiled) --------------------------------------------------------------------------------------------
  const grassT = tex(grassTexture(doc, 512), { repeat: [10, 10], aniso: 8 });
  const ground = lit(new THREE.Mesh(new THREE.PlaneGeometry(120, 120), std({ map: grassT, roughness: 1 })), false, true);
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.04; add(ground);
  // a worn earth path round the court (a ring of packed earth under the bund)
  const pathT = tex(earthPath(doc), { repeat: [6, 6] });
  const pathM = lit(new THREE.Mesh(new THREE.PlaneGeometry(1, 1), std({ map: pathT, roughness: 1 })), false, true);
  pathM.rotation.x = -Math.PI / 2; pathM.position.y = -0.02; add(pathM);

  // ---- the court plane (repainted per court size) ---------------------------------------------------------------------------------------
  const courtMat = std({ map: null, roughness: 1, transparent: true, alphaTest: 0.01 });
  const court = lit(new THREE.Mesh(new THREE.PlaneGeometry(1, 1), courtMat), false, true);
  court.rotation.x = -Math.PI / 2; court.position.y = 0.002; court.renderOrder = -2; add(court);
  let courtKey = '';

  // ---- bund (low earth edge with a bamboo-lashed rail), home mat, fence ----------------------------------------------------------------
  const bundM = std({ map: tex(woodTexture(doc, '#a8763c', '#8e6030', 5)), roughness: 0.85 });
  const bund = new THREE.Group(); add(bund);
  const bars = [];
  for (let i = 0; i < 3; i++) { const m = lit(new THREE.Mesh(B ? B.roundedBox(1, 1, 1, 0.12) : new THREE.BoxGeometry(1, 1, 1), bundM)); bund.add(m); bars.push(m); }
  const matT = tex(matTexture(doc));
  const mat = lit(new THREE.Mesh(B ? B.roundedBox(1, 1, 1, 0.1) : new THREE.BoxGeometry(1, 1, 1), std({ map: matT, roughness: 0.95 })), true, true); add(mat);

  // bamboo posts + rails + bunting along the far end
  const bambooM = std({ color: 0xb4c85a, roughness: 0.55 });
  const nodeM = std({ color: 0x5c7424, roughness: 0.7 });
  const railM = std({ color: 0x1f8a60, roughness: 0.5 });
  const fence = new THREE.Group(); add(fence);
  const postGeo = new THREE.CylinderGeometry(0.05, 0.058, 1.25, 8), nodeGeo = new THREE.CylinderGeometry(0.063, 0.063, 0.045, 8), capGeo = new THREE.SphereGeometry(0.052, 8, 5);
  const MAXPOST = 24, posts = [];
  for (let i = 0; i < MAXPOST; i++) {
    const p = new THREE.Group();
    const s = lit(new THREE.Mesh(postGeo, bambooM)); s.position.y = 0.625; p.add(s);
    for (const y of [0.35, 0.72, 1.05]) { const n = lit(new THREE.Mesh(nodeGeo, nodeM)); n.position.y = y; p.add(n); }
    const cap = lit(new THREE.Mesh(capGeo, bambooM)); cap.position.y = 1.25; p.add(cap);
    fence.add(p); posts.push(p);
  }
  const rail1 = lit(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1, 8), railM)), rail2 = lit(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1, 8), railM));
  for (const rl of [rail1, rail2]) { rl.rotation.z = Math.PI / 2; fence.add(rl); }
  // bunting: a string of triangular flags that flutter (one InstancedMesh-like set of small meshes; vertex colours by flag)
  const flagCols = [0xffd24a, 0xff6a5c, 0x38c9a8, 0x6f7cff, 0xff9ec2];
  const flagGeo = new THREE.BufferGeometry();
  flagGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-0.11, 0, 0, 0.11, 0, 0, 0, -0.22, 0]), 3)); flagGeo.computeVertexNormals();
  const flags = [];
  for (let i = 0; i < 22; i++) { const m = new THREE.Mesh(flagGeo, std({ color: flagCols[i % 5], side: THREE.DoubleSide, roughness: 0.8 })); m.castShadow = true; fence.add(m); flags.push(m); }
  set.flags = flags;

  // ---- plants ---------------------------------------------------------------------------------------------------------------------------
  const leafT = tex(leafTexture(doc));
  const leafGeo = (() => { // a long arched banana leaf: width 0.58, length 2.1 along +z, drooping at the tip, folded up along the rib
    const g = new THREE.PlaneGeometry(0.58, 2.1, 4, 10), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), t = (p.getY(i) + 1.05) / 2.1; p.setXYZ(i, x * (1 - 0.5 * t * t), -t * t * 0.85 + Math.abs(x) * 0.2, t * 2.1); }
    g.computeVertexNormals(); return g;
  })();
  const leafM = std({ map: leafT, side: THREE.DoubleSide, roughness: 0.75 });
  const trunkM = std({ color: 0xa5b36a, roughness: 0.8 });
  const bananaM = std({ color: 0xe6c84a, roughness: 0.6 });
  function bananaTree(seed, h = 3.1) {
    const r = lcg(seed), grp = new THREE.Group();
    const trunk = lit(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, h, 9), trunkM)); trunk.position.y = h / 2; grp.add(trunk);
    const crown = new THREE.Group(); crown.position.y = h - 0.05; grp.add(crown);
    const nL = 9;
    for (let i = 0; i < nL; i++) {
      const a = i / nL * TAU + r() * 0.3, hinge = new THREE.Group(); hinge.rotation.y = a;
      const tilt = new THREE.Group(); tilt.rotation.x = -(0.55 + r() * 0.5); hinge.add(tilt);
      const leaf = lit(new THREE.Mesh(leafGeo, leafM)); leaf.scale.setScalar(0.9 + r() * 0.35); tilt.add(leaf);
      crown.add(hinge); set.windy.push({ obj: tilt, base: tilt.rotation.x, amp: 0.05 + r() * 0.05, ph: r() * 6, sp: 0.8 + r() * 0.8 });
    }
    // hanging bunch with a purple bud
    const bunch = new THREE.Group(); bunch.position.set(0.18, -0.15, 0.1); crown.add(bunch);
    for (let i = 0; i < 6; i++) { const b = lit(new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.16, 3, 6), bananaM)); b.position.set(Math.cos(i * 1.05) * 0.06, -0.14 - (i % 2) * 0.06, Math.sin(i * 1.05) * 0.06); b.rotation.z = 0.15 * (i % 3 - 1); bunch.add(b); }
    const bud = lit(new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), std({ color: 0x6a1f4a }))); bud.scale.set(1, 1.7, 1); bud.position.set(0.04, -0.5, 0.04); bunch.add(bud);
    grp.userData.sway = crown;
    return grp;
  }
  const barkM = std({ color: 0x7a6a58, roughness: 0.95 });
  const fLeafM = std({ color: 0x2f6a2a, roughness: 0.7 });
  const flowerM = std({ color: 0xfff3d0, roughness: 0.55 });
  const flowerEye = std({ color: 0xffc83a, roughness: 0.6 });
  function frangipani(seed) {
    const r = lcg(seed), grp = new THREE.Group();
    const trunk = lit(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.17, 1.5, 7), barkM)); trunk.position.y = 0.75; grp.add(trunk);
    for (let i = 0; i < 4; i++) {
      const br = lit(new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.08, 1.2, 6), barkM)), a = i / 4 * TAU + r() * 0.6;
      br.position.set(Math.cos(a) * 0.35, 1.8, Math.sin(a) * 0.35); br.rotation.z = Math.cos(a) * -0.6; br.rotation.x = Math.sin(a) * 0.6; grp.add(br);
      for (let k = 0; k < 4; k++) {
        const lf = lit(new THREE.Mesh(new THREE.SphereGeometry(0.34, 8, 6), fLeafM)); lf.scale.set(1.3, 0.35, 0.8);
        lf.position.set(Math.cos(a) * (0.75 + r() * 0.35), 2.15 + r() * 0.35, Math.sin(a) * (0.75 + r() * 0.35)); lf.rotation.set(r() * 0.5, r() * 3, r() * 0.5); grp.add(lf);
      }
      for (let k = 0; k < 5; k++) {
        const f = lit(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.07, 0.035, 8), flowerM), true, false), x = Math.cos(a) * (0.7 + r() * 0.5), z = Math.sin(a) * (0.7 + r() * 0.5);
        f.position.set(x, 2.3 + r() * 0.3, z); f.rotation.set(r() * 0.5, 0, r() * 0.5); grp.add(f);
        const e = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 4), flowerEye); e.position.set(x, f.position.y + 0.02, z); grp.add(e);
      }
    }
    return grp;
  }
  const wallM = std({ map: tex(plasterTexture(doc)), roughness: 0.95 });
  const roofM = std({ map: tex(tileTexture(doc), { repeat: [3, 2] }), roughness: 0.8 });
  const timberM = std({ map: tex(woodTexture(doc, '#6a4020', '#523018', 4)), roughness: 0.8 });
  function house(seed, w = 3.8, d = 3.0) {
    const grp = new THREE.Group(), r = lcg(seed);
    const wall = lit(new THREE.Mesh(new THREE.BoxGeometry(w, 1.9, d), wallM)); wall.position.y = 0.95 + 0.35; grp.add(wall);
    const plinth = lit(new THREE.Mesh(new THREE.BoxGeometry(w + 0.16, 0.35, d + 0.16), std({ color: 0x8a8070 }))); plinth.position.y = 0.175; grp.add(plinth);
    // hip roof: a four-sided pyramid frustum with wide eaves
    const roofG = new THREE.CylinderGeometry(0.55, Math.hypot(w, d) * 0.5 + 0.55, 1.15, 4, 1);
    const roof = lit(new THREE.Mesh(roofG, roofM)); roof.rotation.y = Math.PI / 4; roof.position.y = 2.25 + 0.6; roof.scale.set(w / Math.hypot(w, d) * 1.42, 1, d / Math.hypot(w, d) * 1.42); grp.add(roof);
    const door = lit(new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.3, 0.06), timberM)); door.position.set((r() - 0.5) * w * 0.4, 1.0, d / 2 + 0.01); grp.add(door);
    for (const sx of [-1, 1]) { const win = lit(new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.62, 0.06), std({ color: 0x2d2418 }))); win.position.set(sx * w * 0.32, 1.65, d / 2 + 0.01); grp.add(win); }
    for (const sx of [-1, 1]) { const post = lit(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.9, 6), timberM)); post.position.set(sx * (w / 2 + 0.25), 1.2, d / 2 + 0.3); grp.add(post); }
    return grp;
  }

  // plants and houses are placed relative to the court edges by layout()
  const props = [];
  const keepProp = (obj) => { props.push(obj); add(obj); return obj; };
  const bananas = [], frangs = [], houses = [];
  for (let i = 0; i < 8; i++) bananas.push(keepProp(bananaTree(100 + i, 2.7 + (i % 3) * 0.45)));
  for (let i = 0; i < 4; i++) frangs.push(keepProp(frangipani(200 + i)));
  for (let i = 0; i < 3; i++) houses.push(keepProp(house(300 + i, 3.4 + i * 0.5, 2.8 + (i % 2) * 0.5)));

  // ---- puffs: pooled camera-facing quads for dust, chalk and confetti -----------------------------------------------------------------
  const puffT = tex(puffTexture(doc), { aniso: 1 });
  const puffs = [];
  const puffGeo = new THREE.PlaneGeometry(1, 1);
  for (let i = 0; i < 48; i++) {
    const m = new THREE.Mesh(puffGeo, new THREE.MeshBasicMaterial({ map: puffT, transparent: true, depthWrite: false, toneMapped: false, fog: false, opacity: 0 }));
    m.visible = false; m.renderOrder = 5; add(m); puffs.push({ m, t: 0, dur: 1, vx: 0, vy: 0, vz: 0, s0: 0.3, s1: 1, a: 0.6, live: false });
  }
  let puffI = 0;
  set.puff = (kind, x, z, k = 1) => {
    const n = kind === 'confetti' ? 6 : 2;
    for (let j = 0; j < n; j++) {
      const p = puffs[puffI++ % puffs.length], m = p.m;
      const rr = Math.random;
      p.live = true; p.t = 0; m.visible = true;
      if (kind === 'chalk') { m.material.color.set(0xffffff); p.dur = 0.55 + rr() * 0.25; p.s0 = 0.14; p.s1 = 0.5 * k; p.a = 0.55; p.vx = (rr() - 0.5) * 0.7; p.vy = 0.5 + rr() * 0.3; p.vz = (rr() - 0.5) * 0.7; }
      else if (kind === 'confetti') { m.material.color.set(flagCols[(rr() * 5) | 0]); p.dur = 0.9 + rr() * 0.5; p.s0 = 0.1; p.s1 = 0.1; p.a = 1; p.vx = (rr() - 0.5) * 2.4; p.vy = 2.4 + rr() * 1.4; p.vz = (rr() - 0.5) * 2.4; }
      else { m.material.color.set(0xe0c08a); p.dur = 0.6 + rr() * 0.3; p.s0 = 0.16; p.s1 = 0.55 * k; p.a = 0.4 * Math.min(1, k); p.vx = (rr() - 0.5) * 0.9; p.vy = 0.45 + rr() * 0.3; p.vz = (rr() - 0.5) * 0.9; }
      m.position.set(x + (rr() - 0.5) * 0.25, 0.08, z + (rr() - 0.5) * 0.25);
      p.kind = kind;
    }
  };

  // ---- motes: dust and pollen turning in the afternoon sun (a few slow, warm specks) ---------------------------------------------------
  const motes = [];
  for (let i = 0; i < (quality === 'low' ? 0 : 22); i++) {
    const m = new THREE.Mesh(puffGeo, new THREE.MeshBasicMaterial({ map: puffT, color: 0xffe6a0, transparent: true, depthWrite: false, toneMapped: false, fog: false, opacity: 0.55, blending: THREE.AdditiveBlending }));
    m.renderOrder = 6; add(m); motes.push({ m, ph: i * 1.7, sp: 0.15 + (i % 5) * 0.05, x: ((i * 37) % 17 - 8.5) * 0.9, z: ((i * 53) % 23 - 11.5) * 0.9, y: 0.5 + (i % 7) * 0.45 });
  }

  // ---- court layout -----------------------------------------------------------------------------------------------------------------------
  set.layout = (ln, pitch) => {
    const key = ln + ':' + pitch;
    if (key === set.key) return set;
    set.key = key; set.ln = ln; set.pitch = pitch;
    const D = courtDims(ln, pitch), ch = D.ch; set.ch = ch;
    // court texture
    const k = quality === 'low' ? 1.0 : 1.4;
    const c = canvasOf(doc, CW * k, ch * k); paintCourtGround(c.getContext('2d'), ln, pitch, k);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    if (courtMat.map) courtMat.map.dispose();
    courtMat.map = t; courtMat.needsUpdate = true;
    court.scale.set(CW * S, ch * S, 1); court.position.set(0, 0.002, 0);
    const xw = W * CELL * S, zFar = (PAD - 18 - ch / 2) * S, zHome = (ch - PAD + 18 - ch / 2) * S, zLen = zHome - zFar;
    const hx = xw / 2 + 0.2;
    // bund: left, right, home end
    const hgt = 0.14;
    bars[0].scale.set(0.2, hgt, zLen + 0.5); bars[0].position.set(-hx - 0.1, hgt / 2, (zFar + zHome) / 2);
    bars[1].scale.set(0.2, hgt, zLen + 0.5); bars[1].position.set(hx + 0.1, hgt / 2, (zFar + zHome) / 2);
    bars[2].scale.set(xw + 0.8, hgt, 0.2); bars[2].position.set(0, hgt / 2, zHome + 0.1);
    // home mat: below the home chalk line
    mat.scale.set(xw + 0.3, 0.05, (PAD - 22) * S * 0.92); mat.position.set(0, 0.025, zHome + 0.12 + (PAD - 22) * S * 0.46);
    // worn path
    const pw = xw + 4.6, pd = zLen + 4.4; pathM.scale.set(pw, pd, 1); pathM.position.set(0, -0.02, (zFar + zHome) / 2); pathT.repeat.set(pw / 2.2, pd / 2.2);
    // fence along the far end: posts every 0.66 m, two rails, bunting hung on a sagging string
    const nPost = Math.min(MAXPOST, Math.round((xw + 0.4) / 0.66) + 1), x0 = -(xw + 0.4) / 2, step = (xw + 0.4) / (nPost - 1), zf = zFar - 0.25;
    posts.forEach((p, i) => { p.visible = i < nPost; p.position.set(x0 + i * step, 0, zf); });
    for (const [rl, y] of [[rail1, 0.55], [rail2, 1.0]]) { rl.scale.set(1, xw + 0.4, 1); rl.position.set(0, y, zf); }
    flags.forEach((f, i) => { const u = (i + 0.5) / flags.length, x = x0 + u * (xw + 0.4), sag = Math.sin(u * Math.PI) * 0.12; f.position.set(x, 1.0 - sag + 0.01, zf + 0.05); f.userData = { ph: i * 0.7, x }; });
    // trees and houses relative to the court
    const wide = xw / 2 + 1.7;
    const place = (arr, spots) => arr.forEach((o, i) => { const s = spots[i % spots.length]; o.position.set(s[0], 0, s[1]); o.rotation.y = s[2] ?? 0; o.scale.setScalar(s[3] ?? 1); o.visible = i < spots.length; });
    place(bananas, [
      [-wide - 0.2, zFar + 1.2, 0.3], [wide + 0.2, zFar + 0.4, 1.3], [-wide + 0.6, zFar - 2.2, 2.0, 1.1], [wide - 0.8, zFar - 2.0, 0.5, 1.05],
      [-wide - 0.6, zHome - 1.5, 0.9], [wide + 0.6, zHome - 3.4, 1.6], [-1.2, zFar - 3.6, 0.2, 1.15], [2.6, zFar - 3.9, 1.4, 1.2],
    ]);
    place(frangs, [[-wide - 1.4, zFar + 3.0, 0.4], [wide + 1.5, zFar + 3.4, 1.8], [-wide - 0.9, zHome - 0.2, 0.0], [wide + 1.0, zHome + 0.5, 2.0]]);
    place(houses, [[-2.7, zFar - 6.2, 0.0], [3.2, zFar - 6.8, -0.12, 1.05], [-wide - 3.6, zFar - 1.0, 0.7, 0.95]]);
    set.bounds = { xw, zFar, zHome, hx };
    return set;
  };

  // ---- the children (crowd3d points): rows behind the far fence and along both sidelines -----------------------------------------------
  set.crowdPoints = (ln, pitch, many = true) => {
    const { zFar, zHome, hx } = set.layout(ln, pitch).bounds, pts = [], r = lcg(11);
    const nA = many ? 11 : 6;
    for (let i = 0; i < nA; i++) pts.push({ x: -hx + 0.3 + (2 * hx - 0.6) * (i + 0.5) / nA + (r() - 0.5) * 0.2, y: 0, z: zFar - 0.8 - (r() * 0.2), yaw: 0 });
    if (many) {
      for (let i = 0; i < 10; i++) pts.push({ x: -hx + 0.55 + (2 * hx - 1.1) * (i + 0.5) / 10 + (r() - 0.5) * 0.3, y: 0, z: zFar - 1.65 - r() * 0.3, yaw: 0 });
      const n = Math.max(3, Math.round((zHome - zFar) / 1.5));
      for (let i = 0; i < n; i++) { const z = zFar + 0.6 + (zHome - zFar - 1.0) * (i + 0.5) / n; pts.push({ x: -hx - 0.75 - r() * 0.2, y: 0, z, yaw: Math.PI / 2 + (r() - 0.5) * 0.2 }); pts.push({ x: hx + 0.75 + r() * 0.2, y: 0, z, yaw: -Math.PI / 2 + (r() - 0.5) * 0.2 }); }
    }
    return pts;
  };

  // ---- animation ----------------------------------------------------------------------------------------------------------------------------
  let time = 0;
  set.update = (dt, camera) => {
    time += dt;
    for (const w of set.windy) w.obj.rotation.x = w.base + Math.sin(time * w.sp + w.ph) * w.amp + Math.sin(time * 0.31 + w.ph * 2) * w.amp * 0.6;
    for (const f of flags) { const ph = f.userData.ph; f.rotation.x = Math.sin(time * 2.4 + ph) * 0.35; f.rotation.y = Math.sin(time * 1.7 + ph * 1.3) * 0.5; }
    for (const o of motes) {
      const k = time * o.sp + o.ph, m = o.m;
      m.position.set(o.x + Math.sin(k * 0.7) * 0.8, o.y + Math.sin(k) * 0.35 + ((time * 0.05 * o.sp * 10) % 3), o.z + Math.cos(k * 0.5) * 0.8);
      const sc = 0.09 + 0.05 * Math.sin(k * 2.1); m.scale.set(sc, sc, 1); m.material.opacity = 0.35 + 0.3 * Math.sin(k * 1.3);
      if (camera) m.quaternion.copy(camera.quaternion);
    }
    for (const p of puffs) {
      if (!p.live) continue;
      p.t += dt;
      const u = p.t / p.dur;
      if (u >= 1) { p.live = false; p.m.visible = false; continue; }
      const m = p.m;
      if (p.kind === 'confetti') { p.vy -= 7 * dt; m.position.x += p.vx * dt; m.position.z += p.vz * dt; m.position.y = Math.max(0.03, m.position.y + p.vy * dt); const s = p.s0; m.scale.set(s, s * 1.8, 1); m.material.opacity = 1 - u * u; }
      else { m.position.x += p.vx * dt; m.position.z += p.vz * dt; m.position.y += p.vy * dt * (1 - u); const s = p.s0 + (p.s1 - p.s0) * Math.sqrt(u); m.scale.set(s, s, 1); m.material.opacity = p.a * (1 - u) * (1 - u * 0.3); }
      if (camera) m.quaternion.copy(camera.quaternion);
    }
  };
  set.dispose = () => { root.remove(set.group); };
  return set;
}

// The 3D world for Oware: a sun-baked clay courtyard in the late afternoon, an indigo-and-ochre woven mat, and a heavy carved board
// (bone-and-brass rimmed pits, two carved trays) with polished seeds. Everything is procedural. Units: ONE WORLD UNIT = ONE PIT PITCH
// (100 canonical units of the flat game), y up, flat-game row 0 (the computer's) is far (-z). The board is 6.6 x 6.66.
import * as THREE from '../vendor3d/three.js';

export const TOP = 0.9, BODY = 0.6, BW = 6.6, BD = 6.66, PIT_R = 0.47, SEED_R = 0.125;
export const bowlY = (r) => -0.36 * Math.max(0, 1 - (r / PIT_R) * (r / PIT_R));      // depth of the dish at distance r from a pit centre
export const TRAY_FLOOR = TOP - 0.27;
export const lcg = (seed) => { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };
const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const tex = (c, rep = null, aniso = 8) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); } return t; };
export const radialTex = (rgb, a = 1) => {
  const c = canvas(128, 128), x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(0.5, `rgba(${rgb},${a * 0.45})`); g.addColorStop(1, `rgba(${rgb},0)`); x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
};

// ---- wood: long straight grain with darker flame streaks and pores ------------------------------------------------------------------
const WOOD = {
  iroko: { a: '#7d3d1b', b: '#5e2a12', hi: [255, 190, 120], dk: [38, 14, 4], pit: 0x3a1608, base: 0x2a1209 },
  ebony: { a: '#3b271a', b: '#241509', hi: [230, 180, 130], dk: [8, 3, 1], pit: 0x150a04, base: 0x120905 },
};
function woodTexture(key, S) {
  const W = WOOD[key] || WOOD.iroko, c = canvas(S, S), x = c.getContext('2d'), r = lcg(key === 'ebony' ? 9 : 17);
  const g = x.createLinearGradient(0, 0, 0, S); g.addColorStop(0, W.a); g.addColorStop(0.5, W.b); g.addColorStop(1, W.a); x.fillStyle = g; x.fillRect(0, 0, S, S);
  for (let i = 0; i < 520; i++) {
    const y0 = r() * S, amp = (r() - 0.5) * 10, dark = r() < 0.5, len = S * (0.4 + r() * 0.8), x0 = r() * S - len * 0.3;
    x.strokeStyle = dark ? `rgba(${W.dk},${0.12 + r() * 0.25})` : `rgba(${W.hi},${0.04 + r() * 0.1})`; x.lineWidth = 0.5 + r() * (dark ? 2.2 : 1.4);
    x.beginPath(); x.moveTo(x0, y0); x.bezierCurveTo(x0 + len * 0.3, y0 + amp, x0 + len * 0.7, y0 - amp, x0 + len, y0 + amp * 0.4); x.stroke();
  }
  for (let i = 0; i < 900; i++) { x.fillStyle = `rgba(${W.dk},${0.12 + r() * 0.2})`; x.fillRect(r() * S, r() * S, 1 + r() * 7, 1); }
  return tex(c, [0.22, 0.22]);
}
// ---- floor: sun-baked clay, cracked and speckled; woven mat: indigo field, ochre and madder borders, cream stepped diamonds ---------------
function clayTexture() {
  const S = 1024, c = canvas(S, S), x = c.getContext('2d'), r = lcg(5);
  x.fillStyle = '#b8906f'; x.fillRect(0, 0, S, S);
  for (let i = 0; i < 5200; i++) { const v = r(); x.fillStyle = v < 0.4 ? 'rgba(255,225,185,0.10)' : v < 0.8 ? 'rgba(110,55,25,0.10)' : 'rgba(70,35,15,0.14)'; x.fillRect(r() * S, r() * S, 1 + r() * 5, 1 + r() * 4); }
  x.strokeStyle = 'rgba(90,45,20,0.28)'; x.lineWidth = 1.6;
  for (let i = 0; i < 26; i++) { let px = r() * S, py = r() * S; x.beginPath(); x.moveTo(px, py); for (let k = 0; k < 7; k++) { px += (r() - 0.5) * 90; py += (r() - 0.5) * 90; x.lineTo(px, py); } x.stroke(); }
  return tex(c, [8, 8], 8);
}
export const MAT = { w: 9.4, d: 9.8, px: 940 };
function matTexture() {
  const W = 940, H = 980, c = canvas(W, H), x = c.getContext('2d'), r = lcg(41);
  x.fillStyle = '#1a2a5e'; x.fillRect(0, 0, W, H);
  const rect = (i, col, w) => { x.strokeStyle = col; x.lineWidth = w; x.strokeRect(i, i, W - 2 * i, H - 2 * i); };
  rect(14, '#c24a2c', 20); rect(40, '#e9b64a', 8); rect(150, '#e9b64a', 6); rect(166, '#c24a2c', 12);
  const diamond = (cx, cy, u) => { x.fillStyle = '#f1dcae'; x.beginPath(); x.moveTo(cx, cy - u); x.lineTo(cx + u, cy); x.lineTo(cx, cy + u); x.lineTo(cx - u, cy); x.closePath(); x.fill(); x.fillStyle = '#c4452a'; const v = u * 0.55; x.beginPath(); x.moveTo(cx, cy - v); x.lineTo(cx + v, cy); x.lineTo(cx, cy + v); x.lineTo(cx - v, cy); x.closePath(); x.fill(); x.fillStyle = '#1a2a5e'; x.beginPath(); x.arc(cx, cy, u * 0.16, 0, 7); x.fill(); };
  for (let k = 0; k < 13; k++) { const px = 90 + k * ((W - 180) / 12); diamond(px, 95, 22); diamond(px, H - 95, 22); }
  for (let k = 0; k < 13; k++) { const py = 90 + k * ((H - 180) / 12); diamond(95, py, 22); diamond(W - 95, py, 22); }
  x.strokeStyle = 'rgba(255,255,255,0.05)'; x.lineWidth = 1; for (let i = 0; i < W; i += 4) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, H); x.stroke(); } for (let i = 0; i < H; i += 4) { x.beginPath(); x.moveTo(0, i); x.lineTo(W, i); x.stroke(); }
  for (let i = 0; i < 2500; i++) { x.fillStyle = r() < 0.5 ? 'rgba(255,240,210,0.07)' : 'rgba(0,0,10,0.12)'; x.fillRect(r() * W, r() * H, 1 + r() * 3, 1 + r() * 3); }
  return tex(c);
}
function dappleTexture() {   // sunlight through palm fronds: curved leaflet fans, blurred
  const S = 512, c = canvas(S, S), x = c.getContext('2d'), r = lcg(77); x.fillStyle = '#000'; x.fillRect(0, 0, S, S); x.strokeStyle = '#fff'; x.lineCap = 'round';
  for (let f = 0; f < 4; f++) {
    const cx = 80 + r() * 350, cy = 80 + r() * 350, a0 = r() * 6.28; x.lineWidth = 3; x.beginPath(); x.moveTo(cx, cy); const ex = cx + Math.cos(a0) * 150, ey = cy + Math.sin(a0) * 150; x.quadraticCurveTo((cx + ex) / 2 + 20, (cy + ey) / 2 - 20, ex, ey); x.stroke();
    for (let k = 1; k < 12; k++) { const t = k / 12, px = cx + (ex - cx) * t, py = cy + (ey - cy) * t, L = 46 * Math.sin(Math.PI * (0.15 + 0.8 * t)); for (const s of [-1, 1]) { x.lineWidth = 5; x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(a0 + s * 1.15) * L, py + Math.sin(a0 + s * 1.15) * L); x.stroke(); } }
  }
  x.filter = 'blur(5px)'; x.drawImage(c, 0, 0); x.filter = 'none';
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
export function buildRoom(scene) {
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(300, 300).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: clayTexture(), color: 0xb4a090, roughness: 0.95 }));
  floor.material.map.repeat.set(38, 38); floor.receiveShadow = true; scene.add(floor);
  const mat = new THREE.Mesh(new THREE.BoxGeometry(MAT.w, 0.07, MAT.d), [new THREE.MeshStandardMaterial({ color: 0x1a2a5e, roughness: 0.9 }), new THREE.MeshStandardMaterial({ color: 0x1a2a5e, roughness: 0.9 }), new THREE.MeshStandardMaterial({ map: matTexture(), roughness: 0.92 }), new THREE.MeshStandardMaterial({ color: 0x1a2a5e }), new THREE.MeshStandardMaterial({ color: 0x1a2a5e, roughness: 0.9 }), new THREE.MeshStandardMaterial({ color: 0x1a2a5e, roughness: 0.9 })]);
  mat.position.y = 0.035; mat.receiveShadow = true; scene.add(mat);
  const dap = new THREE.Mesh(new THREE.PlaneGeometry(40, 40).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: dappleTexture(), transparent: true, opacity: 0.2, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, color: 0xffd9a0 }));
  dap.position.set(-4, 0.09, 2); dap.rotation.y = 0.5; dap.renderOrder = 1; scene.add(dap);
  // a few seeds scattered on the clay beside the mat, so the world feels lived in
  const rn = lcg(12), g = new THREE.SphereGeometry(0.1, 10, 8), im = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({ color: 0x5a2c14, roughness: 0.4 }), 14), m4 = new THREE.Matrix4();
  for (let k = 0; k < 14; k++) { const a = rn() * 6.28, d = 5.6 + rn() * 3; im.setMatrixAt(k, m4.makeTranslation(Math.cos(a) * d * 1.0, 0.09, Math.sin(a) * d * 1.05)); }
  scene.add(im);
}
export function buildLights(scene) {
  scene.add(new THREE.HemisphereLight(0xffe6cc, 0x7a4a2e, 0.55));
  const sun = new THREE.DirectionalLight(0xffd9a0, 2.6);
  sun.position.set(-16, 20, 9); sun.target.position.set(0, 0, 0); scene.add(sun, sun.target);
  const sc = sun.shadow.camera; sc.left = -12; sc.right = 12; sc.top = 12; sc.bottom = -12; sc.near = 4; sc.far = 70; sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
  return { sun };
}

// ---- the board -------------------------------------------------------------------------------------------------------------------------
function rrect(s, cx, cy, w, h, r, hole = false) {
  const x0 = cx - w / 2, x1 = cx + w / 2, y0 = cy - h / 2, y1 = cy + h / 2, p = hole ? new THREE.Path() : s;
  p.moveTo(x0 + r, y0); p.lineTo(x1 - r, y0); p.quadraticCurveTo(x1, y0, x1, y0 + r); p.lineTo(x1, y1 - r); p.quadraticCurveTo(x1, y1, x1 - r, y1); p.lineTo(x0 + r, y1); p.quadraticCurveTo(x0, y1, x0, y1 - r); p.lineTo(x0, y0 + r); p.quadraticCurveTo(x0, y0, x0 + r, y0); return p;
}
export const PIT_XZ = (i) => (i < 6 ? [-2.5 + i, 1] : [-2.5 + (11 - i), -1]);
export const TRAY_Z = [2.55, -2.55];          // player 0 (you) at the front, player 1 at the back
export function buildBoard(woodKey, texSize) {
  const gr = new THREE.Group(), cleanup = [], Wd = WOOD[woodKey] || WOOD.iroko;
  const brass = new THREE.MeshStandardMaterial({ color: 0xe6b64e, roughness: 0.28, metalness: 0.9 });
  const wt = woodTexture(woodKey, texSize); cleanup.push(wt);
  const wood = new THREE.MeshStandardMaterial({ map: wt, roughness: 0.42, metalness: 0 });
  const dish = new THREE.MeshStandardMaterial({ color: Wd.pit, roughness: 0.3, metalness: 0.05, side: THREE.DoubleSide });
  // top slab with twelve round holes and two tray holes (shape y = -world z)
  const sh = rrect(new THREE.Shape(), 0, 0, BW, BD, 0.32);
  for (let i = 0; i < 12; i++) { const [px, pz] = PIT_XZ(i), h = new THREE.Path(); h.absarc(px, -pz, PIT_R, 0, Math.PI * 2, true); sh.holes.push(h); }
  for (const tz of TRAY_Z) sh.holes.push(rrect(null, 0, -tz, 6.0, 0.92, 0.42, true));
  const geom = new THREE.ExtrudeGeometry(sh, { depth: BODY - 0.06, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2, curveSegments: 28 });
  geom.rotateX(-Math.PI / 2);
  const slab = new THREE.Mesh(geom, wood); slab.position.y = TOP - (BODY - 0.06) - 0.03; slab.castShadow = true; slab.receiveShadow = true; gr.add(slab);
  // dark base slab + brass feet: the board stands raised off the mat
  const base = new THREE.Mesh(new THREE.BoxGeometry(BW - 0.5, 0.26, BD - 0.5), new THREE.MeshStandardMaterial({ color: Wd.base, roughness: 0.6 })); base.position.y = TOP - BODY - 0.1; base.castShadow = true; gr.add(base);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const f = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.26, 0.18, 16), brass); f.position.set(sx * (BW / 2 - 0.45), 0.12, sz * (BD / 2 - 0.45)); f.castShadow = true; gr.add(f); }
  // pit dishes (lathe) and brass rim rings
  const prof = []; for (let k = 0; k <= 12; k++) { const r = PIT_R * (1 - k / 12); prof.push(new THREE.Vector2(Math.max(r, 0.001), bowlY(r))); }
  const dishGeo = new THREE.LatheGeometry(prof, 36), ringGeo = new THREE.TorusGeometry(PIT_R + 0.01, 0.022, 8, 48).rotateX(Math.PI / 2);
  for (let i = 0; i < 12; i++) {
    const [px, pz] = PIT_XZ(i), d = new THREE.Mesh(dishGeo, dish); d.position.set(px, TOP, pz); d.receiveShadow = true; gr.add(d);
    const rg = new THREE.Mesh(ringGeo, brass); rg.position.set(px, TOP + 0.012, pz); gr.add(rg);
  }
  // trays: a dark floor and a thin brass outline
  for (const tz of TRAY_Z) {
    const fl = new THREE.Mesh(new THREE.ExtrudeGeometry(rrect(new THREE.Shape(), 0, 0, 6.0, 0.92, 0.42), { depth: 0.02, bevelEnabled: false, curveSegments: 14 }).rotateX(-Math.PI / 2), dish); fl.position.set(0, TRAY_FLOOR - 0.02, tz); fl.receiveShadow = true; gr.add(fl);
    const o = rrect(new THREE.Shape(), 0, 0, 6.08, 1.0, 0.46); o.holes.push(rrect(null, 0, 0, 5.98, 0.9, 0.41, true));
    const ol = new THREE.Mesh(new THREE.ExtrudeGeometry(o, { depth: 0.03, bevelEnabled: false, curveSegments: 14 }).rotateX(-Math.PI / 2), brass); ol.position.set(0, TOP + 0.005, tz); gr.add(ol);
  }
  // corner studs, a carved centre line with brass lozenges
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const st = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.07, 18), brass); st.position.set(sx * (BW / 2 - 0.32), TOP + 0.02, sz * (BD / 2 - 0.32)); gr.add(st); }
  const line = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.012, 0.035), new THREE.MeshStandardMaterial({ color: 0x1a0b04, roughness: 0.6 })); line.position.set(0, TOP + 0.004, 0); gr.add(line);
  for (let k = -2; k <= 2; k++) { const dm = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.02, 0.2), brass); dm.rotation.y = Math.PI / 4; dm.position.set(k * 1.0 + 0.0, TOP + 0.01, 0); gr.add(dm); }
  gr.userData.dispose = () => { cleanup.forEach((t) => t.dispose()); gr.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) [].concat(o.material).forEach((m) => m.dispose()); }); };
  return gr;
}

// ---- seeds: three sets (polished nuts, cowries, glass beads), one instanced mesh per set --------------------------------------------------
const NUT_COL = ['#c9772f', '#a85a22', '#7d3a14', '#e0944a'], GLASS_COL = ['#7fe3d8', '#6fa4ff', '#ffc65a', '#d89bff'];
function nutTexture() {
  const c = canvas(128, 128), x = c.getContext('2d'), r = lcg(3); x.fillStyle = '#fff'; x.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 260; i++) { x.fillStyle = r() < 0.5 ? 'rgba(70,30,10,0.22)' : 'rgba(255,230,190,0.2)'; x.beginPath(); x.ellipse(r() * 128, r() * 128, 1 + r() * 5, 0.6 + r() * 2.2, r() * 3, 0, 7); x.fill(); }
  x.strokeStyle = 'rgba(40,16,4,0.4)'; x.lineWidth = 3; x.beginPath(); x.moveTo(0, 64); x.lineTo(128, 64); x.stroke();
  return tex(c);
}
export function makeSeedKit(set, count) {
  const g = new THREE.SphereGeometry(SEED_R, set === 'glass' ? 20 : 16, set === 'glass' ? 14 : 12);
  let mat, sx = 1, sy = 1, sz = 1, pal = NUT_COL;
  if (set === 'cowries') { mat = new THREE.MeshStandardMaterial({ color: 0xf3e2bd, roughness: 0.22, metalness: 0 }); sx = 1.3; sy = 0.72; sz = 0.92; pal = ['#f6e8c6', '#efdcb2', '#ead3a2', '#f9eed2']; }
  else if (set === 'glass') { mat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.06, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05, transmission: 0.0 }); pal = GLASS_COL; sx = sy = sz = 1.08; }
  else { mat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: nutTexture(), roughness: 0.28, metalness: 0 }); sx = 1.12; sy = 0.86; sz = 0.9; }
  const im = new THREE.InstancedMesh(g, mat, count); im.castShadow = true; im.receiveShadow = true; im.frustumCulled = false;
  const cols = pal.map((h) => new THREE.Color(h)); for (let i = 0; i < count; i++) im.setColorAt(i, cols[i % 4]); if (im.instanceColor) im.instanceColor.needsUpdate = true;
  let slit = null;
  if (set === 'cowries') { slit = new THREE.InstancedMesh(new THREE.SphereGeometry(SEED_R, 10, 6), new THREE.MeshStandardMaterial({ color: 0x4a2a12, roughness: 0.6 }), count); slit.frustumCulled = false; }
  return { im, slit, sx, sy, sz, dispose() { g.dispose(); mat.dispose(); im.dispose(); if (slit) { slit.geometry.dispose(); slit.material.dispose(); slit.dispose(); } if (mat.map) mat.map.dispose(); } };
}

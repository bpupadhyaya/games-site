// The 3D world for Tafl: a frozen fjord shore at dusk, a rough stone dais under a heavy carved soapstone board (runic frieze, bronze inlay,
// bronze-ringed corner squares, a gilded throne), pointed iron helms against domed ivory cairns, and a bronze-and-gold king. Everything is
// procedural. Units: ONE WORLD UNIT = ONE BOARD CELL, y up, board row 0 (top of the flat game) is far (-z), column 0 is left (-x).
// Deliberately NOT the Deluxe twin's look (maple board in a warm timber hall, black rune discs, cream pawns).
import * as THREE from '../vendor3d/three.js';

export const FRW = 0.66;                       // width of the carved frame, in cells
export const TOP = 0.62, DAIS = 0.2;           // top of the slab; height of the dais under it
export const lcg = (seed) => { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };
const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const tex = (c, rep = null, aniso = 8, srgb = true) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); } return t; };
export const radialTex = (rgb, a = 1) => {
  const c = canvas(128, 128), x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(0.5, `rgba(${rgb},${a * 0.45})`); g.addColorStop(1, `rgba(${rgb},0)`); x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
};

// ---- stone: blue-grey soapstone with grain, flecks and veins -------------------------------------------------------------------------------
function stoneFill(x, S, r, base, spread = 1) {
  const g = x.createLinearGradient(0, 0, S, S); g.addColorStop(0, base[0]); g.addColorStop(0.5, base[1]); g.addColorStop(1, base[2]); x.fillStyle = g; x.fillRect(0, 0, S, S);
  for (let i = 0; i < S * 2.2 * spread; i++) { const v = r(); x.fillStyle = v < 0.45 ? `rgba(215,230,245,${0.04 + r() * 0.07})` : v < 0.9 ? `rgba(8,14,24,${0.06 + r() * 0.12})` : `rgba(240,245,255,${0.1 + r() * 0.12})`; x.fillRect(r() * S, r() * S, 1 + r() * 3.2, 1 + r() * 2.4); }
  x.lineCap = 'round';
  for (let i = 0; i < 16; i++) { let px = r() * S, py = r() * S; x.strokeStyle = r() < 0.5 ? 'rgba(230,240,255,0.10)' : 'rgba(5,10,18,0.16)'; x.lineWidth = 0.7 + r() * 1.6; x.beginPath(); x.moveTo(px, py); for (let k = 0; k < 6; k++) { px += (r() - 0.35) * S * 0.12; py += (r() - 0.5) * S * 0.12; x.lineTo(px, py); } x.stroke(); }
}
// a rune-ish glyph: a stave with branches, drawn in the current stroke style
function rune(x, cx, cy, h, k) {
  const w = h * 0.34; x.beginPath(); x.moveTo(cx, cy - h / 2); x.lineTo(cx, cy + h / 2);
  switch (k % 8) {
    case 0: x.moveTo(cx, cy - h / 2); x.lineTo(cx + w, cy - h * 0.2); x.lineTo(cx, cy + h * 0.05); break;
    case 1: x.moveTo(cx, cy - h / 2); x.lineTo(cx + w, cy - h * 0.25); x.moveTo(cx, cy - h * 0.1); x.lineTo(cx + w, cy + h * 0.15); break;
    case 2: x.moveTo(cx - w, cy - h * 0.3); x.lineTo(cx, cy); x.lineTo(cx + w, cy - h * 0.3); break;
    case 3: x.moveTo(cx - w, cy + h * 0.3); x.lineTo(cx, cy - h * 0.1); x.lineTo(cx + w, cy + h * 0.3); break;
    case 4: x.moveTo(cx, cy - h / 2); x.lineTo(cx + w, cy); x.lineTo(cx, cy + h / 2); break;
    case 5: x.moveTo(cx - w, cy - h / 2); x.lineTo(cx + w, cy + h / 2); x.moveTo(cx + w, cy - h / 2); x.lineTo(cx - w, cy + h / 2); break;
    case 6: x.moveTo(cx - w, cy - h * 0.15); x.lineTo(cx + w, cy + h * 0.15); x.moveTo(cx - w, cy + h * 0.15); x.lineTo(cx + w, cy - h * 0.15); break;
    default: x.moveTo(cx - w, cy - h * 0.1); x.lineTo(cx, cy - h * 0.5); x.lineTo(cx + w, cy - h * 0.1); break;
  }
  x.stroke();
}
// the slab top: frame (runes + coordinates), carved grid, inlaid corner squares and throne. Returns { map, bump }
function boardTextures(n, P) {
  const T = n + 2 * FRW, S = Math.round(T * P), f = FRW * P, r = lcg(11 + n);
  const c = canvas(S, S), x = c.getContext('2d'), b = canvas(S, S), y = b.getContext('2d');
  // frame stone is darker, the field a little lighter
  stoneFill(x, S, r, ['#3a4556', '#2f3948', '#262f3c']);
  y.fillStyle = '#808080'; y.fillRect(0, 0, S, S);
  for (let i = 0; i < S * 2; i++) { const v = 100 + r() * 60; y.fillStyle = `rgb(${v},${v},${v})`; y.fillRect(r() * S, r() * S, 1 + r() * 3, 1 + r() * 3); }
  // field
  x.save(); x.beginPath(); x.rect(f, f, n * P, n * P); x.clip(); x.translate(f, f); stoneFill(x, n * P, lcg(5 + n), ['#76859a', '#68778c', '#5a687b'], 1.2); x.restore();
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { if ((i + j) % 2) { x.fillStyle = 'rgba(10,18,32,0.07)'; x.fillRect(f + i * P, f + j * P, P, P); } }
  // carved grooves: dark channel with a pale lip
  for (let i = 0; i <= n; i++) {
    const p = f + i * P;
    for (const [ctx2, col, lw, off] of [[x, 'rgba(8,12,20,0.88)', Math.max(2, P * 0.045), 0], [x, 'rgba(225,238,255,0.22)', Math.max(1, P * 0.02), Math.max(1.6, P * 0.04)], [y, '#101010', Math.max(2.4, P * 0.06), 0]]) {
      ctx2.strokeStyle = col; ctx2.lineWidth = lw; ctx2.beginPath(); ctx2.moveTo(p + off, f); ctx2.lineTo(p + off, f + n * P); ctx2.moveTo(f, p + off); ctx2.lineTo(f + n * P, p + off); ctx2.stroke();
    }
  }
  // corner squares (the king's goal): madder-red tint, bronze ring, crossed diagonals
  const cell = (i, j) => [f + (i + 0.5) * P, f + (j + 0.5) * P];
  const corners = [[0, 0], [n - 1, 0], [0, n - 1], [n - 1, n - 1]];
  for (const [i, j] of corners) {
    const [cx, cy] = cell(i, j), h = P / 2 - 2;
    x.fillStyle = 'rgba(120,28,26,0.62)'; x.fillRect(cx - h, cy - h, 2 * h, 2 * h);
    x.strokeStyle = '#d9a64b'; x.lineWidth = Math.max(2, P * 0.06); x.beginPath(); x.arc(cx, cy, P * 0.36, 0, 7); x.stroke();
    x.strokeStyle = 'rgba(255,225,150,0.85)'; x.lineWidth = Math.max(1.5, P * 0.04); x.beginPath(); x.moveTo(cx - h * 0.62, cy - h * 0.62); x.lineTo(cx + h * 0.62, cy + h * 0.62); x.moveTo(cx + h * 0.62, cy - h * 0.62); x.lineTo(cx - h * 0.62, cy + h * 0.62); x.stroke();
    x.fillStyle = '#e9bd5c'; x.beginPath(); x.arc(cx, cy, P * 0.09, 0, 7); x.fill();
    y.fillStyle = '#c8c8c8'; y.fillRect(cx - h, cy - h, 2 * h, 2 * h);
  }
  // throne: gilded star ring
  { const m = (n - 1) / 2, [cx, cy] = cell(m, m), h = P / 2 - 2;
    x.fillStyle = 'rgba(150,110,30,0.40)'; x.fillRect(cx - h, cy - h, 2 * h, 2 * h);
    x.strokeStyle = '#f0c968'; x.lineWidth = Math.max(2, P * 0.06); x.beginPath(); x.arc(cx, cy, P * 0.38, 0, 7); x.stroke();
    x.beginPath(); for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4, rr = k % 2 ? P * 0.16 : P * 0.33; x[k ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } x.closePath(); x.stroke();
    y.fillStyle = '#c0c0c0'; y.fillRect(cx - h, cy - h, 2 * h, 2 * h); }
  // frame: gilded rules, runic frieze outside, coordinates inside
  x.strokeStyle = '#d9a64b'; x.lineWidth = Math.max(2, P * 0.05); x.strokeRect(f - P * 0.06, f - P * 0.06, n * P + P * 0.12, n * P + P * 0.12);
  x.lineWidth = Math.max(1.4, P * 0.03); x.strokeStyle = 'rgba(217,166,75,0.75)'; x.strokeRect(P * 0.1, P * 0.1, S - P * 0.2, S - P * 0.2);
  x.strokeStyle = 'rgba(226,205,150,0.9)'; x.lineWidth = Math.max(1.5, P * 0.035); x.lineCap = 'round';
  const rh = P * 0.2, ry = P * 0.1 + (f - P * 0.1) * 0.0 + rh * 1.15;
  for (let k = 0; k < n * 2 + 2; k++) {
    const p = f * 0.4 + (k + 0.5) * ((S - f * 0.8) / (n * 2 + 2)), kk = k * 3 + n;
    rune(x, p, ry, rh, kk); rune(x, p, S - ry, rh, kk + 1);
    if (k > 0 && k < n * 2 + 1) { rune(x, ry, p, rh, kk + 2); rune(x, S - ry, p, rh, kk + 3); }
  }
  x.fillStyle = '#f3e2b0'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = `700 ${Math.round(P * 0.3)}px "Cinzel", "Cormorant Garamond", Georgia, serif`;
  const LET = 'ABCDEFGHIJK';
  for (let i = 0; i < n; i++) { x.fillText(LET[i], f + (i + 0.5) * P, f - P * 0.25); x.fillText(LET[i], f + (i + 0.5) * P, f + n * P + P * 0.28); }
  for (let j = 0; j < n; j++) { x.fillText(String(n - j), f - P * 0.27, f + (j + 0.5) * P); x.fillText(String(n - j), f + n * P + P * 0.27, f + (j + 0.5) * P); }
  // bump: the frame stands a hair proud; the field is flat
  y.strokeStyle = '#f0f0f0'; y.lineWidth = Math.max(2, P * 0.05); y.strokeRect(f - P * 0.06, f - P * 0.06, n * P + P * 0.12, n * P + P * 0.12);
  const map = tex(c, null, 8), bump = tex(b, null, 4, false); return { map, bump };
}
function sideTexture() { const S = 256, c = canvas(S, S), x = c.getContext('2d'); stoneFill(x, S, lcg(3), ['#2c3646', '#263040', '#202836']); x.strokeStyle = 'rgba(217,166,75,0.7)'; x.lineWidth = 3; x.strokeRect(6, S * 0.4, S - 12, S * 0.2); return tex(c); }
function daisTexture() { const S = 256, c = canvas(S, S), x = c.getContext('2d'), r = lcg(9); stoneFill(x, S, r, ['#4a4f58', '#3f444d', '#363b44'], 1.4); x.strokeStyle = 'rgba(0,0,0,0.5)'; x.lineWidth = 2; for (let k = 1; k < 4; k++) { x.beginPath(); x.moveTo(k * S / 4, 0); x.lineTo(k * S / 4, S); x.stroke(); } return tex(c, [3, 1]); }
function snowTexture() {
  const S = 1024, c = canvas(S, S), x = c.getContext('2d'), r = lcg(21);
  const g = x.createLinearGradient(0, 0, S, S); g.addColorStop(0, '#c6d6ee'); g.addColorStop(0.5, '#dbe6f7'); g.addColorStop(1, '#bccde8'); x.fillStyle = g; x.fillRect(0, 0, S, S);
  for (let i = 0; i < 90; i++) { const px = r() * S, py = r() * S, rr = 30 + r() * 120, gg = x.createRadialGradient(px, py, 0, px, py, rr); gg.addColorStop(0, r() < 0.5 ? 'rgba(255,255,255,0.28)' : 'rgba(120,150,200,0.18)'); gg.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gg; x.fillRect(px - rr, py - rr, rr * 2, rr * 2); }
  for (let i = 0; i < 3500; i++) { x.fillStyle = r() < 0.7 ? 'rgba(255,255,255,0.55)' : 'rgba(90,120,175,0.22)'; x.fillRect(r() * S, r() * S, 1 + r() * 2, 1 + r() * 2); }
  return tex(c, [26, 26], 8);
}

export function buildRoom(scene) {
  const snow = snowTexture(), ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: snow, color: 0xb9c8e2, roughness: 0.9 }));
  ground.receiveShadow = true; scene.add(ground);
  // snow banks and a few standing stones beyond the dais so the shore feels real
  const r = lcg(5), bank = new THREE.SphereGeometry(1, 14, 8), bm = new THREE.MeshStandardMaterial({ color: 0xeaf1fb, roughness: 0.95 }), im = new THREE.InstancedMesh(bank, bm, 26), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s3 = new THREE.Vector3(), p3 = new THREE.Vector3();
  for (let k = 0; k < 26; k++) { const a = r() * 6.283, d = 11 + r() * 16, sc = 1.2 + r() * 3; im.setMatrixAt(k, m4.compose(p3.set(Math.cos(a) * d, -0.2, Math.sin(a) * d), q, s3.set(sc * 1.6, sc * 0.32, sc))); }
  im.receiveShadow = true; scene.add(im);
  const stoneM = new THREE.MeshStandardMaterial({ color: 0x3b4350, roughness: 0.85 });
  for (const [x, z, h, ry] of [[-9, -8, 2.6, 0.3], [-11.5, -5, 1.8, -0.2], [10, -9, 3.1, 0.1], [12.4, -6.5, 2.0, -0.4]]) { const st = new THREE.Mesh(new THREE.BoxGeometry(0.9, h, 0.55), stoneM); st.position.set(x, h / 2, z); st.rotation.set(0.03, ry, 0.05); st.castShadow = true; scene.add(st); }
  // drifting snow: points that fall slowly and wrap (updated by the presenter)
  const N = 150, pos = new Float32Array(N * 3); for (let k = 0; k < N; k++) { pos[k * 3] = (r() - 0.5) * 30; pos[k * 3 + 1] = r() * 12; pos[k * 3 + 2] = (r() - 0.5) * 30; }
  const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const flakes = new THREE.Points(pg, new THREE.PointsMaterial({ color: 0xffffff, size: 0.09, transparent: true, opacity: 0.8, depthWrite: false, fog: false, map: radialTex('255,255,255', 1), alphaTest: 0.02 }));
  flakes.frustumCulled = false; scene.add(flakes);
  return { flakes };
}
export function buildLights(scene) {
  scene.add(new THREE.HemisphereLight(0xb5cdf5, 0x4b5a78, 0.95));
  const sun = new THREE.DirectionalLight(0xffc98a, 3.0);            // the low dusk sun: warm, from the left and a little behind the camera
  sun.position.set(-13, 15, 10); sun.target.position.set(0, 0, 0); scene.add(sun, sun.target);
  const sc = sun.shadow.camera; sc.left = -10; sc.right = 10; sc.top = 10; sc.bottom = -10; sc.near = 3; sc.far = 60; sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
  const rim = new THREE.DirectionalLight(0x8fb4ff, 0.9); rim.position.set(12, 9, -12); scene.add(rim);   // cold fill from the far right
  return { sun };
}

// ---- the board -------------------------------------------------------------------------------------------------------------------------
export function buildBoard(n, texSize) {
  const gr = new THREE.Group(), T = n + 2 * FRW, P = Math.max(40, Math.min(110, Math.floor(texSize / T)));
  const { map, bump } = boardTextures(n, P), st = sideTexture(), dt = daisTexture();
  const bronze = new THREE.MeshStandardMaterial({ color: 0xd9a64b, roughness: 0.3, metalness: 0.92 });
  const stone = new THREE.MeshStandardMaterial({ map: st, roughness: 0.55 });
  const topM = new THREE.MeshStandardMaterial({ map, bumpMap: bump, bumpScale: 1.5, roughness: 0.42, metalness: 0.02 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(T, TOP - DAIS, T), [stone, stone, topM, stone, stone, stone]);
  body.position.y = DAIS + (TOP - DAIS) / 2; body.castShadow = true; body.receiveShadow = true; gr.add(body);
  const dm = new THREE.MeshStandardMaterial({ map: dt, roughness: 0.8 });
  const dais = new THREE.Mesh(new THREE.BoxGeometry(T + 0.36, DAIS, T + 0.36), dm); dais.position.y = DAIS / 2; dais.castShadow = true; dais.receiveShadow = true; gr.add(dais);
  // a bronze lip around the field and a bronze edge line on the slab top, corner bosses
  const HW = n / 2, lipH = 0.05;
  for (const [w, d, x, z] of [[n + 0.14, 0.07, 0, -HW - 0.035], [n + 0.14, 0.07, 0, HW + 0.035], [0.07, n, -HW - 0.035, 0], [0.07, n, HW + 0.035, 0]]) { const l = new THREE.Mesh(new THREE.BoxGeometry(w, lipH, d), bronze); l.position.set(x, TOP + lipH / 2, z); l.castShadow = true; gr.add(l); }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const boss = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.1, 20), bronze); boss.position.set(sx * (T / 2 - 0.24), TOP + 0.05, sz * (T / 2 - 0.24)); boss.castShadow = true; gr.add(boss);
    const gem = new THREE.Mesh(new THREE.SphereGeometry(0.09, 14, 10), new THREE.MeshStandardMaterial({ color: 0x1d4f9e, roughness: 0.12, metalness: 0.1, emissive: 0x0a2a66, emissiveIntensity: 0.5 })); gem.position.set(boss.position.x, TOP + 0.12, boss.position.z); gr.add(gem);
  }
  gr.userData.dispose = () => { [map, bump, st, dt].forEach((t) => t.dispose()); gr.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) [].concat(o.material).forEach((m) => m.dispose()); }); };
  return gr;
}

// ---- pieces ---------------------------------------------------------------------------------------------------------------------------
function lathe(profile, seg, color) {                   // profile: [r, y, colorKey]; colorKey picks a band colour
  const pts = profile.map(([r, y]) => new THREE.Vector2(r, y)), g = new THREE.LatheGeometry(pts, seg);
  const n = g.attributes.position.count, col = new Float32Array(n * 3), tmp = new THREE.Color();
  for (let i = 0; i < n; i++) { const yy = g.attributes.position.getY(i); tmp.set(color(yy)); col[i * 3] = tmp.r; col[i * 3 + 1] = tmp.g; col[i * 3 + 2] = tmp.b; }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals(); return g;
}
const arc = (cx, cy, r, a0, a1, k, rx = r, ry = r) => Array.from({ length: k + 1 }, (_, i) => { const a = a0 + (a1 - a0) * i / k; return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]; });
export function makePieceKits() {
  const shared = (o) => new THREE.MeshPhysicalMaterial({ vertexColors: true, ...o });
  // attacker: a pointed iron helm, bronze band
  const helm = lathe([[0.001, 0], [0.4, 0], [0.43, 0.04], [0.42, 0.09], [0.36, 0.14], [0.35, 0.18], [0.33, 0.2], [0.3, 0.25], [0.285, 0.34], [0.25, 0.44], [0.19, 0.55], [0.12, 0.65], [0.05, 0.73], [0.001, 0.78]], 40, (y) => (y < 0.07 ? '#3a4658' : y > 0.1 && y < 0.2 ? '#d49a42' : y < 0.1 ? '#4a566a' : '#232c3b'));
  const helmM = shared({ roughness: 0.28, metalness: 0.62, clearcoat: 0.5, clearcoatRoughness: 0.25 });
  // defender: a domed ivory cairn on a flange, carved rings
  const dome = lathe([[0.001, 0], [0.4, 0], [0.43, 0.04], [0.41, 0.09], [0.35, 0.13], [0.34, 0.16], ...arc(0, 0.16, 0.34, 0, Math.PI / 2, 12, 0.34, 0.34).slice(1).map(([x, y]) => [Math.max(0.001, x), y])], 40, (y) => (y < 0.12 ? '#cdb98a' : y < 0.17 ? '#e0cfa0' : y > 0.36 ? '#fff6dc' : '#f4e8c8'));
  const domeM = shared({ roughness: 0.34, metalness: 0.02, clearcoat: 0.35, clearcoatRoughness: 0.3 });
  // king: a tall gilded body with a crown of points and a blue stone
  const kg = lathe([[0.001, 0], [0.45, 0], [0.47, 0.05], [0.44, 0.1], [0.37, 0.16], [0.3, 0.26], [0.27, 0.4], [0.3, 0.52], [0.36, 0.6], [0.34, 0.66], [0.26, 0.7], [0.001, 0.7]], 40, (y) => (y < 0.12 ? '#b5842f' : y > 0.55 ? '#ffe08a' : '#eab852'));
  const kingM = shared({ roughness: 0.22, metalness: 0.9, clearcoat: 0.4 });
  const spike = new THREE.CylinderGeometry(0, 0.075, 0.26, 10), stone = new THREE.SphereGeometry(0.11, 14, 10);
  const spikeM = new THREE.MeshStandardMaterial({ color: 0xffd877, roughness: 0.22, metalness: 0.92 }), gemM = new THREE.MeshStandardMaterial({ color: 0x4aa8ff, roughness: 0.08, metalness: 0.1, emissive: 0x1a5fb4, emissiveIntensity: 0.9 });
  const mk = (geo, mat) => { const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.receiveShadow = true; return m; };
  const make = {
    A: () => mk(helm, helmM), D: () => mk(dome, domeM),
    K: () => { const g = new THREE.Group(); g.add(mk(kg, kingM)); for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4, sp = mk(spike, spikeM); sp.position.set(Math.cos(a) * 0.27, 0.83, Math.sin(a) * 0.27); g.add(sp); } const gm = mk(stone, gemM); gm.position.y = 0.8; gm.scale.y = 1.2; g.add(gm); return g; },
  };
  return { make, dispose() { [helm, dome, kg, spike, stone].forEach((g) => g.dispose()); [helmM, domeM, kingM, spikeM, gemM].forEach((m) => m.dispose()); } };
}

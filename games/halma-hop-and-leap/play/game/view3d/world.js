// The 3D world for Halma: a warm daylit room, a maple (or walnut / jade) board with a brass-edged walnut frame, the two or four stained camps, and lathe-turned
// lacquered pegs with a cream collar. Everything is procedural. Units: ONE WORLD UNIT = ONE BOARD CELL, y up. Board row 0 (the top of the flat game) is far (-z).
import * as THREE from '../vendor3d/three.js';
import { geo, VARIANTS } from '../src/rules.js';
import { BOARDS, SEAT } from '../src/art.js';
import { PROFILE } from '../src/v3.js';

export const FRW = 0.5, TOP = 0.34, PEG_H = 0.98;
export const lcg = (seed) => { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };
const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const tex = (c, rep = null) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); } return t; };
export const radialTex = (rgb, a = 1) => { const c = canvas(128, 128), x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(0.5, `rgba(${rgb},${a * 0.45})`); g.addColorStop(1, `rgba(${rgb},0)`); x.fillStyle = g; x.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; };

function woodFill(x, w, h, r, base, vertical = false) {
  const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, base[0]); g.addColorStop(0.5, base[1]); g.addColorStop(1, base[2]); x.fillStyle = g; x.fillRect(0, 0, w, h);
  for (let i = 0; i < (vertical ? w : h) / 1.4; i++) {
    const p = r() * (vertical ? w : h);
    x.strokeStyle = r() < 0.55 ? `rgba(40,18,6,${0.05 + r() * 0.12})` : `rgba(255,214,150,${0.04 + r() * 0.08})`; x.lineWidth = 0.6 + r() * 1.8; x.beginPath();
    if (vertical) { x.moveTo(p, 0); x.bezierCurveTo(p + (r() - 0.5) * 18, h * 0.3, p + (r() - 0.5) * 18, h * 0.7, p + (r() - 0.5) * 8, h); } else { x.moveTo(0, p); x.bezierCurveTo(w * 0.3, p + (r() - 0.5) * 18, w * 0.7, p + (r() - 0.5) * 18, w, p + (r() - 0.5) * 8); }
    x.stroke();
  }
}

const SQ = { maple: ['#ecd49c', '#c99a58'], walnut: ['#d2a468', '#9c6c3a'], jade: ['#d3e6d2', '#7fae95'] };   // richer than the flat palette: the lit 3D scene needs contrast
// ---- the board top: frame with brass inlay and edge letters, checkered field with grain, stained camps ----------------------------------------------
function boardTexture(n, P, variant, key) {
  const pal = BOARDS[key] || BOARDS.maple, TW = n + 2 * FRW, w = Math.round(TW * P), f = FRW * P, r = lcg(31 + n);
  const c = canvas(w, w), x = c.getContext('2d');
  woodFill(x, w, w, r, [pal.frame[0], pal.frame[1], pal.frame[2]]);
  x.strokeStyle = 'rgba(20,8,0,0.55)'; x.lineWidth = Math.max(3, P * 0.06); x.strokeRect(f - P * 0.03, f - P * 0.03, n * P + P * 0.06, n * P + P * 0.06);
  x.strokeStyle = '#d9a94a'; x.lineWidth = Math.max(2, P * 0.045); x.strokeRect(f - P * 0.1, f - P * 0.1, n * P + P * 0.2, n * P + P * 0.2);
  x.strokeStyle = 'rgba(255,236,170,0.5)'; x.lineWidth = Math.max(1, P * 0.014); x.strokeRect(f - P * 0.12, f - P * 0.12, n * P + P * 0.24, n * P + P * 0.24);
  x.save(); x.translate(f, f);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { x.fillStyle = (i + j) % 2 ? SQ[key]?.[1] || '#c99a58' : SQ[key]?.[0] || '#ecd49c'; x.fillRect(i * P, j * P, P, P); }
  // grain
  x.save(); x.beginPath(); x.rect(0, 0, n * P, n * P); x.clip();
  for (let i = 0; i < n * P / 2.2; i++) { const py = r() * n * P, px = r() * n * P, len = P * (1 + r() * 3); x.strokeStyle = `rgba(${pal.grain[0]},${pal.grain[1]},${pal.grain[2]},${0.04 + r() * 0.1})`; x.lineWidth = 0.6 + r() * 1.3; x.beginPath(); x.moveTo(px, py); x.bezierCurveTo(px + len * 0.3, py + (r() - 0.5) * 6, px + len * 0.7, py + (r() - 0.5) * 6, px + len, py + (r() - 0.5) * 3); x.stroke(); }
  x.restore();
  // stained camps (the squares each seat starts on)
  const G = geo(variant), V = VARIANTS[variant];
  V.corners.forEach((k, idx) => {
    const s = SEAT[idx + 1], set = new Set(G.camps[k]);
    for (const q of G.camps[k]) { const cc = q % n, rr = (q / n) | 0; x.fillStyle = `rgba(${s.tint},0.36)`; x.fillRect(cc * P, rr * P, P, P); }
    x.strokeStyle = `rgba(${s.tint},0.95)`; x.lineWidth = Math.max(3, P * 0.07); x.lineCap = 'round'; x.beginPath();
    for (const q of G.camps[k]) { const cc = q % n, rr = (q / n) | 0; for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) { const nc = cc + dx, nr = rr + dy; if (nc >= 0 && nc < n && nr >= 0 && nr < n && set.has(nr * n + nc)) continue; const X0 = (cc + (dx === 1 ? 1 : 0)) * P, Y0 = (rr + (dy === 1 ? 1 : 0)) * P; if (dx) { x.moveTo(X0, rr * P); x.lineTo(X0, (rr + 1) * P); } else { x.moveTo(cc * P, Y0); x.lineTo((cc + 1) * P, Y0); } } }
    x.stroke();
  });
  // fine grid
  x.strokeStyle = pal.line; x.lineWidth = Math.max(1, P * 0.014); x.beginPath(); for (let i = 0; i <= n; i++) { x.moveTo(i * P, 0); x.lineTo(i * P, n * P); x.moveTo(0, i * P); x.lineTo(n * P, i * P); } x.stroke();
  x.restore();
  // edge letters and numbers on the frame
  x.fillStyle = 'rgba(255,226,160,0.9)'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = `700 ${Math.round(P * 0.3)}px system-ui, sans-serif`;
  for (let i = 0; i < n; i++) { x.fillText(String.fromCharCode(97 + i), f + (i + 0.5) * P, w - f * 0.5); x.fillText(String(n - i), f * 0.5, f + (i + 0.5) * P); }
  return tex(c);
}

// ---- the board -------------------------------------------------------------------------------------------------------------------------------
export function buildBoard(n, texSize, variant, key) {
  const P = Math.min(80, Math.floor(texSize / (16 + 2 * FRW))), grp = new THREE.Group(), owned = [], TW = n + 2 * FRW;
  const top = boardTexture(n, P, variant, key); owned.push(top);
  const pal = BOARDS[key] || BOARDS.maple, rw = canvas(512, 512); woodFill(rw.getContext('2d'), 512, 512, lcg(3), [pal.frame[1], pal.frame[2], pal.edge[0]]); const side = tex(rw, [2, 1]); owned.push(side);
  const sideMat = new THREE.MeshStandardMaterial({ map: side, roughness: 0.6 }), topMat = new THREE.MeshStandardMaterial({ map: top, roughness: 0.62 });
  const slab = new THREE.Mesh(new THREE.BoxGeometry(TW, TOP, TW), [sideMat, sideMat, topMat, sideMat, sideMat, sideMat]); slab.position.y = TOP / 2; slab.castShadow = true; slab.receiveShadow = true; grp.add(slab);
  const brass = new THREE.MeshStandardMaterial({ color: 0xd9a94a, roughness: 0.3, metalness: 0.85 });
  for (const [sx, sz, w, d] of [[0, -TW / 2 + 0.03, TW, 0.06], [0, TW / 2 - 0.03, TW, 0.06], [-TW / 2 + 0.03, 0, 0.06, TW], [TW / 2 - 0.03, 0, 0.06, TW]]) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, d), brass); m.position.set(sx, TOP + 0.01, sz); grp.add(m); }
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.17, 0.1, 20), brass); m.position.set(sx * (TW / 2 - 0.2), TOP + 0.03, sz * (TW / 2 - 0.2)); m.castShadow = true; grp.add(m); }
  grp.userData.dispose = () => { owned.forEach((t) => t.dispose()); grp.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) [].concat(o.material).forEach((m) => { if (m.map && !owned.includes(m.map)) m.map.dispose(); m.dispose(); }); }); };
  return grp;
}

// ---- the room: a warm walnut table top under a sunny window ----------------------------------------------------------------------------------------
function tableTexture() {
  const c = canvas(1024, 1024), x = c.getContext('2d'), r = lcg(77);
  woodFill(x, 1024, 1024, r, ['#6e4526', '#5f3a1f', '#4f2f18'], true);
  for (let k = 1; k < 6; k++) { x.strokeStyle = 'rgba(25,10,2,0.5)'; x.lineWidth = 3; x.beginPath(); x.moveTo(k * 170, 0); x.lineTo(k * 170, 1024); x.stroke(); }
  for (let i = 0; i < 8; i++) { x.fillStyle = `rgba(30,12,4,${0.08 + r() * 0.1})`; x.beginPath(); x.ellipse(r() * 1024, r() * 1024, 8 + r() * 14, 4 + r() * 8, 0, 0, 7); x.fill(); }
  return tex(c, [3, 3]);
}
export function buildRoom(scene) {
  const grp = new THREE.Group(); scene.add(grp);
  const table = new THREE.Mesh(new THREE.CircleGeometry(80, 48), new THREE.MeshStandardMaterial({ map: tableTexture(), roughness: 0.72 })); table.rotation.x = -Math.PI / 2; table.receiveShadow = true; grp.add(table);
  // a folded linen cloth, a bowl of spare pegs would only crowd the board: keep the surroundings calm, a soft pool of window light on the wood
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshBasicMaterial({ map: radialTex('255,214,150', 0.5), transparent: true, depthWrite: false, fog: false })); glow.rotation.x = -Math.PI / 2; glow.position.y = 0.01; grp.add(glow);
  return { grp };
}
export function buildLights(scene) {
  const hemi = new THREE.HemisphereLight(0xfff1dc, 0x4a2c16, 0.6); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff0d2, 2.0); sun.position.set(-6, 12, 8); sun.target.position.set(0, 0, 0); scene.add(sun, sun.target);
  sun.shadow.camera.left = -11; sun.shadow.camera.right = 11; sun.shadow.camera.top = 11; sun.shadow.camera.bottom = -11; sun.shadow.camera.near = 1; sun.shadow.camera.far = 44; sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.02;
  const fill = new THREE.DirectionalLight(0xffe0b8, 0.45); fill.position.set(7, 6, -6); scene.add(fill);
  const warm = new THREE.PointLight(0xffc880, 10, 14, 2); warm.position.set(0, 3, 6); scene.add(warm);
  return { hemi, sun, fill, warm };
}

// ---- pegs: a turned wooden pawn (flared foot, waisted neck, collar, round head) in team lacquer with a cream collar ring ----------------------------
export function makePegKit() {
  const geom = new THREE.LatheGeometry(PROFILE.map(([r, y]) => new THREE.Vector2(r, y)), 36); geom.computeVertexNormals();
  const ring = new THREE.TorusGeometry(0.205, 0.035, 8, 28); ring.rotateX(Math.PI / 2);
  const cream = new THREE.MeshStandardMaterial({ color: 0xf3e3b6, roughness: 0.45, metalness: 0.15 }), mats = [];
  for (let s = 1; s <= 4; s++) { const S = SEAT[s]; mats[s] = new THREE.MeshPhysicalMaterial({ color: S.mid, roughness: 0.34, clearcoat: 1, clearcoatRoughness: 0.12, metalness: 0.02 }); }
  return {
    make(seat) { const g = new THREE.Group(), b = new THREE.Mesh(geom, mats[seat]); b.castShadow = true; b.receiveShadow = true; g.add(b); const r = new THREE.Mesh(ring, cream); r.position.y = 0.575; g.add(r); return g; },
    dispose() { geom.dispose(); ring.dispose(); cream.dispose(); mats.forEach((m) => m && m.dispose()); },
  };
}

// Dudo 3D world: a dark polished table under a warm lamp, carved bone (or ebony) dice with drilled pips, the leather cacho with a woven
// aguayo band, and woven aguayo cloths. Everything is procedural (canvas textures, analytic geometry): no image files.
// Units: 1 = 1 cm. A real Dudo die is about 1.6 cm; the cup about 9 cm across the mouth and 11 cm tall.
import * as THREE from '../vendor3d/three.js';
import { roundedBox, lathe, woodCanvas } from '../vendor3d/board3d.js';
import { THEMES } from '../src/art.js';

const TAU = Math.PI * 2;
const cv = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const rngOf = (seed) => { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; };
const texOf = (c, o = {}) => {
  const t = new THREE.CanvasTexture(c);
  if (o.srgb !== false) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (o.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(o.repeat[0], o.repeat[1]); }
  return t;
};
export const themeOf = (id) => THEMES.find((t) => t.id === id) ?? THEMES[0];

// ------------------------------------------------------------------------------------------------ dice
// Box material order is +x, -x, +y, -y, +z, -z. A real die: opposite faces add up to 7.
export const FACE_ON = [3, 4, 1, 6, 2, 5];
const NORMALS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
// quaternion that turns face f to the top (+y)
export const FACE_UP = [null, ...[1, 2, 3, 4, 5, 6].map((f) => {
  const n = NORMALS[FACE_ON.indexOf(f)];
  return new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(...n), new THREE.Vector3(0, 1, 0));
})];
const PIPS = {
  1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
  5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]],
};
// One face: the bone colour with a faint grain, drilled pips (dark, with a lit lower lip), the ace a red pip in a gold ring.
function faceCanvases(th, f, S = 512) {
  const d = th.die, c = cv(S), x = c.getContext('2d'), b = cv(S), bx = b.getContext('2d'), r = rngOf(f * 977 + 3);
  const g = x.createRadialGradient(S * 0.4, S * 0.35, S * 0.1, S / 2, S / 2, S * 0.75); g.addColorStop(0, d.a); g.addColorStop(1, d.b);
  x.fillStyle = g; x.fillRect(0, 0, S, S); bx.fillStyle = '#9a9a9a'; bx.fillRect(0, 0, S, S);
  // bone grain: fine long streaks, a few darker flecks
  for (let i = 0; i < 70; i++) { const y = r() * S; x.strokeStyle = `rgba(${r() < 0.5 ? '255,250,235' : '120,90,50'},${0.04 + r() * 0.06})`; x.lineWidth = 0.6 + r() * 1.4; x.beginPath(); x.moveTo(0, y); x.bezierCurveTo(S * 0.3, y + (r() - 0.5) * 10, S * 0.7, y + (r() - 0.5) * 10, S, y + (r() - 0.5) * 6); x.stroke(); }
  for (let i = 0; i < 260; i++) { x.fillStyle = `rgba(90,60,30,${0.05 + r() * 0.1})`; x.fillRect(r() * S, r() * S, 1 + r() * 1.5, 1 + r() * 1.5); }
  const sp = S * 0.255, pr = S * (f === 1 ? 0.15 : f >= 5 ? 0.082 : 0.094);
  for (const [px, py] of PIPS[f]) {
    const cx = S / 2 + px * sp, cy = S / 2 + py * sp;
    if (f === 1) {
      // the ace: a lacquered red pip inside a thin inlaid gold ring
      x.strokeStyle = d.ring; x.lineWidth = S * 0.03; x.beginPath(); x.arc(cx, cy, pr * 1.42, 0, TAU); x.stroke();
      x.fillStyle = '#7c0c05'; x.beginPath(); x.arc(cx, cy, pr, 0, TAU); x.fill();
      x.fillStyle = 'rgba(60,0,0,0.45)'; x.beginPath(); x.arc(cx, cy, pr * 0.8, 0, TAU); x.fill();
      x.strokeStyle = 'rgba(40,6,2,0.7)'; x.lineWidth = S * 0.01; x.beginPath(); x.arc(cx, cy, pr * 0.97, 0, TAU); x.stroke();
    } else {
      const pg = x.createRadialGradient(cx, cy - pr * 0.3, pr * 0.1, cx, cy, pr);
      pg.addColorStop(0, 'rgba(0,0,0,0.9)'); pg.addColorStop(0.8, d.pip); pg.addColorStop(1, d.pip);
      x.fillStyle = pg; x.beginPath(); x.arc(cx, cy, pr, 0, TAU); x.fill();
    }
    x.strokeStyle = d.pipHi; x.lineWidth = S * 0.012; x.beginPath(); x.arc(cx, cy, pr * 0.9, Math.PI * 0.2, Math.PI * 0.8); x.stroke();
    // bump: a drilled dimple
    const bg = bx.createRadialGradient(cx, cy, 0, cx, cy, pr * 1.05); bg.addColorStop(0, '#202020'); bg.addColorStop(0.8, '#555'); bg.addColorStop(1, '#9a9a9a');
    bx.fillStyle = bg; bx.beginPath(); bx.arc(cx, cy, pr * 1.05, 0, TAU); bx.fill();
    if (f === 1) { bx.strokeStyle = '#7a7a7a'; bx.lineWidth = 3; bx.beginPath(); bx.arc(cx, cy, pr * 1.45, 0, TAU); bx.stroke(); }
  }
  return { map: c, bump: b };
}
const diceCache = new Map();
// 6 materials for a theme's dice (bone for Aguayo/Altiplano, ebony for Lake Blue).
export function diceMaterials(themeId) {
  if (diceCache.has(themeId)) return diceCache.get(themeId);
  const th = themeOf(themeId), ebony = themeId === 'titicaca';
  const mats = FACE_ON.map((f) => {
    const c = faceCanvases(th, f);
    return new THREE.MeshPhysicalMaterial({
      map: texOf(c.map), bumpMap: texOf(c.bump, { srgb: false }), bumpScale: 1.4, roughness: ebony ? 0.32 : 0.42, metalness: 0,
      clearcoat: ebony ? 0.8 : 0.45, clearcoatRoughness: ebony ? 0.12 : 0.28, sheen: ebony ? 0 : 0.12, sheenColor: new THREE.Color('#fff4dc'), sheenRoughness: 0.6,
    });
  });
  diceCache.set(themeId, mats);
  return mats;
}
export const dieGeometry = () => roundedBox(1, 1, 1, 0.16, 5);

// ------------------------------------------------------------------------------------------------ the leather cup (cacho), mouth down
// Profile from the mouth (y = 0) to the closed base (y = 1); radius 0.5 at the mouth. Scaled by the cup's real width and height.
export function cupGeometry() {
  const p = [[0.43, 0.012], [0.5, 0], [0.525, 0.012], [0.53, 0.05], [0.522, 0.085], [0.5, 0.1], [0.47, 0.35], [0.44, 0.6], [0.41, 0.86],
    [0.415, 0.9], [0.418, 0.95], [0.4, 0.985], [0.3, 1.0], [0, 1.0]];
  return lathe(p, 56);
}
// The inside of the cup (seen only when it is lifted and tipped): darker, rougher suede.
const innerGeo = () => lathe([[0, 0.955], [0.38, 0.945], [0.42, 0.12], [0.432, 0.012]], 56);
const suede = new Map();
function suedeMaterial(themeId) {
  if (!suede.has(themeId)) suede.set(themeId, new THREE.MeshStandardMaterial({ color: new THREE.Color('#2a160b'), roughness: 0.95, metalness: 0 }));
  return suede.get(themeId);
}
// The cup as a group: leather outside, suede inside. setCupTheme swaps the leather when the table theme changes.
let cupGeos = null;
export function makeCup(themeId) {
  cupGeos ??= { outer: cupGeometry(), inner: innerGeo() };
  const g = new THREE.Group(), o = new THREE.Mesh(cupGeos.outer, cupMaterial(themeId)), i = new THREE.Mesh(cupGeos.inner, suedeMaterial(themeId));
  o.castShadow = true; o.receiveShadow = true; i.receiveShadow = true; g.add(o, i);
  return g;
}
export const setCupTheme = (g, themeId) => { g.children[0].material = cupMaterial(themeId); };
const cupCache = new Map();
export function cupMaterial(themeId) {
  if (cupCache.has(themeId)) return cupCache.get(themeId);
  const th = themeOf(themeId), W = 1024, H = 512, c = cv(W, H), x = c.getContext('2d'), b = cv(W, H), bx = b.getContext('2d'), r = rngOf(11);
  // v runs from the mouth (top of the canvas, y = 0) to the closed base (bottom)
  const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#3a2010'); g.addColorStop(0.12, '#7a4a26'); g.addColorStop(0.7, '#8a5630'); g.addColorStop(1, '#5a3418');
  x.fillStyle = g; x.fillRect(0, 0, W, H); bx.fillStyle = '#808080'; bx.fillRect(0, 0, W, H);
  // leather grain: pebbled creases and wear
  for (let i = 0; i < 9000; i++) { const px = r() * W, py = r() * H, s = 1 + r() * 2.5; x.fillStyle = `rgba(${r() < 0.5 ? '25,10,2' : '200,150,100'},${0.05 + r() * 0.07})`; x.fillRect(px, py, s, s); bx.fillStyle = r() < 0.5 ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.2)'; bx.fillRect(px, py, s, s); }
  for (let i = 0; i < 40; i++) { const px = r() * W, py = H * (0.15 + r() * 0.8); x.strokeStyle = 'rgba(20,8,2,0.12)'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + 30, py + (r() - 0.5) * 20, px + 60 + r() * 60, py + (r() - 0.5) * 10); x.stroke(); }
  // the woven aguayo band (stepped diamonds), a hand's width up from the mouth
  const by = H * 0.3, bh = H * 0.2, cell = bh;
  x.fillStyle = '#20100a'; x.fillRect(0, by - 6, W, bh + 12);
  x.fillStyle = th.tex[1]; x.fillRect(0, by, W, bh * 0.12); x.fillRect(0, by + bh * 0.88, W, bh * 0.12);
  for (let i = 0; i * cell < W + cell; i++) {
    const cx = i * cell + cell / 2, cy = by + bh / 2;
    for (let s = 0; s < 3; s++) { const rr = (bh * 0.36) * (1 - s * 0.3); x.fillStyle = s === 0 ? th.tex[i % 2 ? 0 : 2] : s === 1 ? th.tex[1] : th.tex[3]; x.beginPath(); x.moveTo(cx, cy - rr); x.lineTo(cx + rr, cy); x.lineTo(cx, cy + rr); x.lineTo(cx - rr, cy); x.closePath(); x.fill(); }
    x.fillStyle = th.tex[0]; x.fillRect(i * cell, by + bh * 0.42, 4, bh * 0.16);
  }
  for (let yy = by; yy < by + bh; yy += 3) { x.fillStyle = 'rgba(0,0,0,0.12)'; x.fillRect(0, yy, W, 1); bx.fillStyle = 'rgba(255,255,255,0.18)'; bx.fillRect(0, yy, W, 1.5); }
  bx.fillStyle = 'rgba(0,0,0,0.5)'; bx.fillRect(0, by - 6, W, 4); bx.fillRect(0, by + bh + 2, W, 4);
  // saddle stitching near the mouth and the base
  for (const sy of [H * 0.17, H * 0.9]) for (let sx = 0; sx < W; sx += 16) { x.fillStyle = 'rgba(240,215,170,0.75)'; x.fillRect(sx, sy, 9, 3); bx.fillStyle = 'rgba(0,0,0,0.6)'; bx.fillRect(sx - 2, sy - 1, 13, 5); }
  const m = new THREE.MeshPhysicalMaterial({ map: texOf(c), bumpMap: texOf(b, { srgb: false }), bumpScale: 1.4, roughness: 0.62, metalness: 0, clearcoat: 0.25, clearcoatRoughness: 0.5, sheen: 0.4, sheenColor: new THREE.Color('#ffcf9a'), sheenRoughness: 0.5 });
  cupCache.set(themeId, m);
  return m;
}

// ------------------------------------------------------------------------------------------------ woven cloth (aguayo) and the leather tray
// The plain field of the mat: a fine warp/weft weave in the theme's mat colour (tiles).
const clothCache = new Map();
export function clothMaterials(themeId) {
  if (clothCache.has(themeId)) return clothCache.get(themeId);
  const th = themeOf(themeId), S = 256, r = rngOf(5);
  const f = cv(S), x = f.getContext('2d'), fb = cv(S), bx = fb.getContext('2d');
  x.fillStyle = th.mat[0]; x.fillRect(0, 0, S, S); bx.fillStyle = '#808080'; bx.fillRect(0, 0, S, S);
  for (let i = 0; i < S; i += 4) {
    for (let j = 0; j < S; j += 4) {
      const over = ((i + j) / 4) % 2 === 0, k = 0.85 + r() * 0.3;
      x.fillStyle = over ? `rgba(255,235,210,${0.05 * k})` : `rgba(0,0,0,${0.12 * k})`; x.fillRect(i, j, over ? 4 : 2, over ? 2 : 4);
      bx.fillStyle = over ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)'; bx.fillRect(i, j, over ? 4 : 2, over ? 2 : 4);
    }
  }
  const field = new THREE.MeshStandardMaterial({ map: texOf(f, { repeat: [1, 1] }), bumpMap: texOf(fb, { srgb: false, repeat: [1, 1] }), bumpScale: 0.9, roughness: 0.96, metalness: 0, color: new THREE.Color(0.62, 0.6, 0.6) });
  // the patterned band (stepped diamonds between stripes), tiles along its length
  const B = cv(256, 64), y = B.getContext('2d'), Bb = cv(256, 64), yb = Bb.getContext('2d'), c = th.tex;
  y.fillStyle = c[3]; y.fillRect(0, 0, 256, 64); yb.fillStyle = '#808080'; yb.fillRect(0, 0, 256, 64);
  y.fillStyle = c[1]; y.fillRect(0, 0, 256, 7); y.fillRect(0, 57, 256, 7);
  y.fillStyle = c[0]; y.fillRect(0, 7, 256, 5); y.fillRect(0, 52, 256, 5);
  for (let i = 0; i < 4; i++) {
    const cx = i * 64 + 32, cy = 32;
    for (let s = 0; s < 4; s++) { const rr = 19 * (1 - s * 0.24); y.fillStyle = s === 0 ? c[i % 2 ? 0 : 2] : s === 1 ? c[3] : s === 2 ? c[1] : c[0]; y.beginPath(); y.moveTo(cx, cy - rr); y.lineTo(cx + rr, cy); y.lineTo(cx, cy + rr); y.lineTo(cx - rr, cy); y.closePath(); y.fill(); }
    y.fillStyle = c[2]; for (const dx of [-30, 30]) { y.beginPath(); y.moveTo(cx + dx, 22); y.lineTo(cx + dx + 8, 32); y.lineTo(cx + dx, 42); y.lineTo(cx + dx - 8, 32); y.fill(); }
  }
  for (let i = 0; i < 64; i += 2) { y.fillStyle = 'rgba(0,0,0,0.13)'; y.fillRect(0, i, 256, 1); yb.fillStyle = 'rgba(255,255,255,0.35)'; yb.fillRect(0, i, 256, 1); }
  for (let i = 0; i < 256; i += 3) { y.fillStyle = 'rgba(255,255,255,0.05)'; y.fillRect(i, 0, 1, 64); }
  const band = new THREE.MeshStandardMaterial({ map: texOf(B, { repeat: [1, 1] }), bumpMap: texOf(Bb, { srgb: false, repeat: [1, 1] }), bumpScale: 1.1, roughness: 0.93, metalness: 0 });
  // leather tray for the player's own dice
  const T = cv(256), z = T.getContext('2d'), Tb = cv(256), zb = Tb.getContext('2d');
  z.fillStyle = '#2a170c'; z.fillRect(0, 0, 256, 256); zb.fillStyle = '#808080'; zb.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 4000; i++) { const px = r() * 256, py = r() * 256; z.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '170,120,80'},0.08)`; z.fillRect(px, py, 2, 2); zb.fillStyle = r() < 0.5 ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.3)'; zb.fillRect(px, py, 2, 2); }
  const tray = new THREE.MeshPhysicalMaterial({ map: texOf(T, { repeat: [1, 1] }), bumpMap: texOf(Tb, { srgb: false, repeat: [1, 1] }), bumpScale: 0.8, roughness: 0.7, metalness: 0, sheen: 0.5, sheenColor: new THREE.Color('#b07a4a') });
  const out = { field, band, tray };
  clothCache.set(themeId, out);
  return out;
}

// ------------------------------------------------------------------------------------------------ the table and the room
// A long table of dark polished wood (planks with grain), lit by one warm lamp; the far end falls into the dark.
export function buildTable(scene, tier = 0) {
  const S = tier >= 2 ? 512 : 1024;
  const wc = woodCanvas(S, '#2b170b', '#4a2a15', 21, { lines: 170, knots: 3 });
  // plank seams across the grain
  { const x = wc.map.getContext('2d'), bx = wc.bump.getContext('2d'); for (let i = 0; i < 3; i++) { const yy = (i + 0.5) * S / 3; x.fillStyle = 'rgba(0,0,0,0.55)'; x.fillRect(0, yy, S, 3); bx.fillStyle = '#000'; bx.fillRect(0, yy, S, 4); } }
  const map = texOf(wc.map, { repeat: [6, 6] }), bump = texOf(wc.bump, { srgb: false, repeat: [6, 6] });
  const mat = new THREE.MeshPhysicalMaterial({ map, bumpMap: bump, bumpScale: 0.8, roughness: 0.38, metalness: 0, clearcoat: 0.55, clearcoatRoughness: 0.22, color: new THREE.Color('#d8c0a8') });
  const top = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600), mat);
  top.rotation.x = -Math.PI / 2; top.receiveShadow = true;
  scene.add(top);
  return top;
}
export function buildLights(scene) {
  const hemi = new THREE.HemisphereLight(0xffe2c0, 0x1a0c06, 0.14);
  // the lamp: a warm spot hanging above the table; its pool of light falls off toward the screen edges
  const lamp = new THREE.SpotLight(0xffd29a, 6200, 900, 0.5, 0.9, 1.25);
  lamp.position.set(-40, 210, 60); lamp.target.position.set(0, 0, 0);
  lamp.shadow.bias = -0.0004; lamp.shadow.normalBias = 0.02; lamp.shadow.radius = 4; lamp.shadow.camera.near = 60; lamp.shadow.camera.far = 600;
  // a cool rim from the far side (window light) so dice edges and the cup's lip read against the dark wood
  const rim = new THREE.DirectionalLight(0x9fc4ff, 0.9); rim.position.set(60, 50, -120);
  // a low warm fill from the player's side
  const fill = new THREE.DirectionalLight(0xffb27a, 0.16); fill.position.set(-30, 40, 140);
  scene.add(hemi, lamp, lamp.target, rim, fill);
  return { hemi, lamp, rim, fill };
}
// Soft round texture (contact shadows, glow, dust).
export function radialTex(rgb, a = 1, size = 128) {
  const c = cv(size), x = c.getContext('2d'), g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(0.45, `rgba(${rgb},${a * 0.5})`); g.addColorStop(1, `rgba(${rgb},0)`);
  x.fillStyle = g; x.fillRect(0, 0, size, size);
  return texOf(c);
}
// Soft rectangle shadow under a cloth (cloth edges lift a little off the wood).
export function rectShadowTex() {
  const c = cv(128), x = c.getContext('2d');
  x.filter = 'blur(10px)'; x.fillStyle = 'rgba(0,0,0,0.85)'; x.fillRect(18, 18, 92, 92);
  return texOf(c);
}

// The 3D world for Pachisi: a sunlit sandstone courtyard. The embroidered cloth cross lies on a thick teak platform; the four yards are
// brass bowls lined with coloured velvet; turned wooden pawns (ball, spire, crown, cube) stand on the squares; the six cowrie shells (or the
// Ludo die) are thrown on a woven rug on the floor in front. Everything is procedural; the cloth and the rug carry the SAME artwork the flat
// game paints (art.js), so the two layers never disagree. Units: ONE WORLD UNIT = ONE SQUARE of the cross, y up, flat-game row 0 is far (-z).
import * as THREE from '../vendor3d/three.js';
import { geo } from '../src/rules.js';
import { paintClothTex, paintRugTex, ARM_COLOURS, ARM_LIGHT, ARM_DARK, lcg } from '../src/art.js';
import { yardOffset } from '../src/layout.js';

export const PT = 1.5, CLOTH_T = 0.2, TOP = PT + CLOTH_T;      // y of the platform top and of the cloth surface
export const RUG_W = 17, RUG_D = 8.7, RUG_PAD = 38;
export const RUG_PX = { w: 628, h: 322 };                        // the rug's design size in the flat game
export const extent = (mode) => geo(mode).R + 2;                 // half-size of the cross, in squares
export const slabHalf = (mode) => extent(mode) + 0.45;
export const rugZ = (mode) => slabHalf(mode) + 1.1 + RUG_D / 2;  // centre of the rug (z)

const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const tex = (c, rep = null, aniso = 8) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); } return t; };
export const radialTex = (rgb, a = 1) => {
  const c = canvas(128, 128), x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(0.5, `rgba(${rgb},${a * 0.45})`); g.addColorStop(1, `rgba(${rgb},0)`); x.fillStyle = g; x.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
};

// ---- teak: the platform ----------------------------------------------------------------------------------------------------------
function teakTexture() {
  const S = 1024, c = canvas(S, S), x = c.getContext('2d'), r = lcg(31);
  const g = x.createLinearGradient(0, 0, S, 0); g.addColorStop(0, '#8a4f24'); g.addColorStop(0.5, '#9a5a2a'); g.addColorStop(1, '#86491f'); x.fillStyle = g; x.fillRect(0, 0, S, S);
  for (let i = 0; i < 360; i++) {
    const x0 = r() * S, amp = (r() - 0.5) * 16, dark = r() < 0.45;
    x.strokeStyle = dark ? `rgba(60,28,10,${0.10 + r() * 0.2})` : `rgba(255,205,140,${0.05 + r() * 0.12})`; x.lineWidth = 0.6 + r() * (dark ? 2.4 : 1.6);
    x.beginPath(); x.moveTo(x0, -10); x.bezierCurveTo(x0 + amp, S * 0.3, x0 - amp, S * 0.7, x0 + amp * 0.3, S + 10); x.stroke();
  }
  return tex(c, [2, 2]);
}
// ---- sandstone courtyard floor, with the light falling through a carved jali screen -------------------------------------------------
function floorTexture() {
  const S = 1024, c = canvas(S, S), x = c.getContext('2d'), r = lcg(5), n = 4, t = S / n;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const v = r(), R = 188 + v * 14, G = 140 + v * 14, B = 92 + v * 14;
    x.fillStyle = `rgb(${R},${G},${B})`; x.fillRect(i * t, j * t, t, t);
    for (let k = 0; k < 160; k++) { x.fillStyle = r() < 0.5 ? 'rgba(255,240,205,0.10)' : 'rgba(150,100,55,0.09)'; x.fillRect(i * t + r() * t, j * t + r() * t, 1 + r() * 3, 1 + r() * 3); }
    x.strokeStyle = 'rgba(120,80,45,0.55)'; x.lineWidth = 3; x.strokeRect(i * t + 1.5, j * t + 1.5, t - 3, t - 3);
  }
  return tex(c, [4, 4], 8);
}
function jaliTexture() {      // soft light cast through a lattice of cusped diamonds
  const S = 512, c = canvas(S, S), x = c.getContext('2d'); x.fillStyle = '#000'; x.fillRect(0, 0, S, S); x.fillStyle = '#fff';
  const n = 4, t = S / n;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    const cx = i * t + t / 2, cy = j * t + t / 2, a = t * 0.38;
    x.beginPath(); x.moveTo(cx, cy - a); x.quadraticCurveTo(cx + a * 0.25, cy - a * 0.25, cx + a, cy); x.quadraticCurveTo(cx + a * 0.25, cy + a * 0.25, cx, cy + a); x.quadraticCurveTo(cx - a * 0.25, cy + a * 0.25, cx - a, cy); x.quadraticCurveTo(cx - a * 0.25, cy - a * 0.25, cx, cy - a); x.fill();
    x.beginPath(); x.arc(cx, cy, a * 0.16, 0, 7); x.fill();
  }
  x.filter = 'blur(4px)'; x.drawImage(c, 0, 0); x.filter = 'none';
  const tt = new THREE.CanvasTexture(c); tt.colorSpace = THREE.SRGBColorSpace; return tt;
}
export function buildRoom(scene) {
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: floorTexture(), roughness: 0.9 }));
  floor.material.map.repeat.set(30, 30); floor.receiveShadow = true; scene.add(floor);
  const wl = new THREE.Mesh(new THREE.PlaneGeometry(64, 64).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: jaliTexture(), transparent: true, opacity: 0.2, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, color: 0xffe2a8 }));
  wl.position.set(-6, 0.04, -16); wl.rotation.y = 0.45; wl.renderOrder = 1; scene.add(wl);
  // marigold petals drifted over the stones
  const r = lcg(33), g = new THREE.CircleGeometry(0.34, 7).rotateX(-Math.PI / 2), im = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({ color: 0xf08a1c, roughness: 0.8, side: THREE.DoubleSide }), 46);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), e = new THREE.Euler(); let k = 0;
  while (k < 46) {
    const px = (r() - 0.5) * 44, pz = (r() - 0.5) * 54; if (Math.abs(px) < 12 && pz > -12.5 && pz < 33) continue;
    e.set(0, r() * 6.28, 0); q.setFromEuler(e); const sc = 0.8 + r() * 0.9; s.set(sc * 1.3, 1, sc * 0.8); p.set(px, 0.03 + r() * 0.02, pz); im.setMatrixAt(k++, m4.compose(p, q, s));
  }
  scene.add(im);
}
export function buildLights(scene) {
  scene.add(new THREE.HemisphereLight(0xfff4e2, 0xc4a070, 0.75));
  const sun = new THREE.DirectionalLight(0xfff0d2, 2.3);
  sun.position.set(-14, 30, 18); sun.target.position.set(0, 0, 6); scene.add(sun, sun.target);
  const sc = sun.shadow.camera; sc.left = -22; sc.right = 22; sc.top = 26; sc.bottom = -16; sc.near = 4; sc.far = 90; sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.04;
  return { sun };
}

// ---- the table: platform + cloth + bowls + rug --------------------------------------------------------------------------------------
function crossShape(l, e) {
  const q = [[-l, -e], [l, -e], [l, -l], [e, -l], [e, l], [l, l], [l, e], [-l, e], [-l, l], [-e, l], [-e, -l], [-l, -l]], s = new THREE.Shape();
  q.forEach(([x, z], i) => (i ? s.lineTo(x, -z) : s.moveTo(x, -z))); s.closePath(); return s;
}
export function buildTable(mode, texSize) {
  const gr = new THREE.Group(), E = extent(mode), SH = slabHalf(mode), R = geo(mode).R, cleanup = [];
  const brass = new THREE.MeshStandardMaterial({ color: 0xe0b04a, roughness: 0.28, metalness: 0.85 });
  // platform: a thick teak slab, a brass edge band and low feet
  const teak = new THREE.MeshStandardMaterial({ map: teakTexture(), roughness: 0.5, metalness: 0.0 }); cleanup.push(teak.map);
  const slab = new THREE.Mesh(new THREE.BoxGeometry(SH * 2, PT - 0.25, SH * 2), teak); slab.position.y = 0.25 + (PT - 0.25) / 2; slab.castShadow = true; slab.receiveShadow = true; gr.add(slab);
  const band = new THREE.Mesh(new THREE.BoxGeometry(SH * 2 + 0.12, 0.16, SH * 2 + 0.12), brass); band.position.y = PT - 0.5; gr.add(band);
  const band2 = new THREE.Mesh(new THREE.BoxGeometry(SH * 2 + 0.12, 0.1, SH * 2 + 0.12), brass); band2.position.y = 0.45; gr.add(band2);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const f = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.7, 0.3, 14), brass); f.position.set(sx * (SH - 0.7), 0.15, sz * (SH - 0.7)); f.castShadow = true; gr.add(f); }
  // the cloth: the cross, with a rounded edge, textured with the flat game's embroidery
  const cl = canvas(texSize, texSize), cx = cl.getContext('2d'); paintClothTex(cx, mode, texSize);
  const ct = tex(cl); cleanup.push(ct);
  const geom = new THREE.ExtrudeGeometry(crossShape(2, E), { depth: CLOTH_T, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 2 });
  geom.rotateX(-Math.PI / 2);
  const pos = geom.attributes.position, uv = geom.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, (pos.getX(i) + E) / (2 * E), 1 - (pos.getZ(i) + E) / (2 * E));
  const clothTop = new THREE.MeshStandardMaterial({ map: ct, roughness: 0.82, metalness: 0 }), clothSide = new THREE.MeshStandardMaterial({ color: 0x8e1b22, roughness: 0.9 });
  const cloth = new THREE.Mesh(geom, [clothTop, clothSide]); cloth.position.y = PT - 0.04; cloth.receiveShadow = true; cloth.castShadow = true; gr.add(cloth);
  // the four brass yards: a bowl on the platform, lined with velvet in the arm's colour
  for (let a = 0; a < 4; a++) {
    const [ux, uy] = yardOffset(mode, a), rad = (R / 2 - 0.5), bg = new THREE.Group();
    const prof = [[0.001, 0], [rad * 0.84, 0], [rad * 0.98, 0.16], [rad * 1.0, 0.5], [rad * 0.96, 0.66], [rad * 0.9, 0.64], [rad * 0.86, 0.48], [rad * 0.8, 0.34]].map(([r, y]) => new THREE.Vector2(r, y));
    const bowl = new THREE.Mesh(new THREE.LatheGeometry(prof, 48), new THREE.MeshStandardMaterial({ color: 0xe6b64e, roughness: 0.26, metalness: 0.9, side: THREE.DoubleSide })); bowl.castShadow = true; bowl.receiveShadow = true; bg.add(bowl);
    const vt = canvas(256, 256), vx = vt.getContext('2d'), gg = vx.createRadialGradient(100, 90, 8, 128, 128, 128); gg.addColorStop(0, ARM_LIGHT[a]); gg.addColorStop(0.65, ARM_COLOURS[a]); gg.addColorStop(1, ARM_DARK[a]);
    vx.fillStyle = gg; vx.fillRect(0, 0, 256, 256); vx.strokeStyle = 'rgba(255,225,150,0.35)'; vx.lineWidth = 3; vx.setLineDash([4, 9]); vx.beginPath(); vx.arc(128, 128, 90, 0, 7); vx.stroke();
    for (let k = 0; k < 4; k++) { const s = 1.15 * 256 / (1.64 * rad), o = [[-s, -s], [s, -s], [-s, s], [s, s]][k]; vx.setLineDash([]); vx.strokeStyle = 'rgba(0,0,0,0.28)'; vx.lineWidth = 5; vx.beginPath(); vx.arc(128 + o[0], 128 + o[1], 22, 0, 7); vx.stroke(); }
    const vtex = tex(vt); cleanup.push(vtex);
    const vel = new THREE.Mesh(new THREE.CircleGeometry(rad * 0.82, 40).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: vtex, roughness: 0.95 })); vel.position.y = 0.345; vel.receiveShadow = true; bg.add(vel);
    bg.position.set(ux, PT, uy); gr.add(bg);
  }
  // the rug on the floor in front, where the throw lands
  const rc = canvas(RUG_PX.w + 2 * RUG_PAD, RUG_PX.h + 2 * RUG_PAD), rx = rc.getContext('2d'); paintRugTex(rx, RUG_PX.w, RUG_PX.h, RUG_PAD);
  const rt = tex(rc); cleanup.push(rt);
  const rw = RUG_W * (RUG_PX.w + 2 * RUG_PAD) / RUG_PX.w, rd = RUG_D * (RUG_PX.h + 2 * RUG_PAD) / RUG_PX.h;
  const rugMat = new THREE.MeshStandardMaterial({ map: rt, roughness: 0.95, transparent: true, alphaTest: 0.5, emissive: 0xffc050, emissiveIntensity: 0 });
  const rug = new THREE.Mesh(new THREE.PlaneGeometry(rw, rd).rotateX(-Math.PI / 2), rugMat); rug.position.set(0, 0.07, rugZ(mode)); rug.receiveShadow = true; rug.name = 'rug'; gr.add(rug);
  gr.userData.rugMat = rugMat;
  gr.userData.dispose = () => { cleanup.forEach((t) => t.dispose()); gr.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) [].concat(o.material).forEach((m) => { if (m.map && !cleanup.includes(m.map)) m.map.dispose(); m.dispose(); }); }); };
  return gr;
}

// ---- the pawns: turned wood, four head shapes (ball, spire, crown, cube), brass collar ---------------------------------------------------
const lathe = (pts, seg = 28) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(Math.max(r, 0.001), y)), seg);
const BODY = [[0, 0], [0.5, 0], [0.52, 0.1], [0.46, 0.2], [0.34, 0.3], [0.24, 0.46], [0.19, 0.7], [0.17, 0.95], [0.2, 1.02], [0, 1.02]];
const COLLAR = [[0.18, 1.0], [0.3, 1.04], [0.31, 1.12], [0.26, 1.2], [0.19, 1.22], [0.19, 1.0]];
export const PAWN_H = 2.05;
const pawnGeo = {};
function pawnParts(arm) {
  if (pawnGeo[arm]) return pawnGeo[arm];
  const body = lathe(BODY), collar = lathe(COLLAR, 20);
  let head;
  if (arm === 0) { head = new THREE.SphereGeometry(0.43, 28, 20); head.translate(0, 1.62, 0); }
  else if (arm === 1) head = lathe([[0, 1.2], [0.4, 1.2], [0.38, 1.3], [0.3, 1.6], [0.18, 1.9], [0.07, 2.08], [0.0, 2.1]], 28);
  else if (arm === 2) {
    const parts = [lathe([[0, 1.22], [0.44, 1.22], [0.46, 1.34], [0.36, 1.42], [0, 1.42]], 28), lathe([[0, 1.42], [0.36, 1.42], [0.38, 1.54], [0.28, 1.62], [0, 1.62]], 28), lathe([[0, 1.62], [0.28, 1.62], [0.3, 1.74], [0.2, 1.82], [0, 1.82]], 28)];
    const fin = new THREE.SphereGeometry(0.13, 14, 10); fin.translate(0, 1.95, 0); parts.push(fin); head = mergeGeos(parts);
  } else { head = new THREE.BoxGeometry(0.66, 0.66, 0.66); head.rotateY(Math.PI / 4); head.translate(0, 1.6, 0); }
  return (pawnGeo[arm] = { body, collar, head });
}
function mergeGeos(list) {
  const pos = [], idx = [], nor = [], uv = []; let off = 0;
  for (const g of list) { const p = g.attributes.position, n = g.attributes.normal, u = g.attributes.uv; for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i)); uv.push(u ? u.getX(i) : 0, u ? u.getY(i) : 0); } const ix = g.index; for (let i = 0; i < ix.count; i++) idx.push(ix.getX(i) + off); off += p.count; }
  const m = new THREE.BufferGeometry(); m.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); m.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); m.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); m.setIndex(idx); return m;
}
export function pawnMaterials(arm, ghost) {
  const wood = new THREE.MeshStandardMaterial({ color: ARM_COLOURS[arm], roughness: 0.3, metalness: 0.05, transparent: ghost, opacity: ghost ? 0.5 : 1, depthWrite: !ghost });
  const br = new THREE.MeshStandardMaterial({ color: 0xe6b64e, roughness: 0.28, metalness: 0.85, transparent: ghost, opacity: ghost ? 0.5 : 1, depthWrite: !ghost });
  return { wood, brass: br };
}
export function makePawn(arm, mats) {
  const P = pawnParts(arm), g = new THREE.Group(), body = new THREE.Mesh(P.body, mats.wood), collar = new THREE.Mesh(P.collar, mats.brass), head = new THREE.Mesh(P.head, mats.wood);
  for (const m of [body, collar, head]) { m.castShadow = true; m.receiveShadow = true; g.add(m); }
  return g;
}

// ---- cowrie shells: a domed back, a flat toothed mouth ------------------------------------------------------------------------------------
export const COWRY_L = 2.3, COWRY_W = 1.6, COWRY_H = 0.8;
export function cowryTextures(sprites) {   // sprites: { back: canvas|null, mouth: canvas|null } (the flat game's own cowry art)
  const mk = (c) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
  return { back: sprites.back ? mk(sprites.back) : null, mouth: sprites.mouth ? mk(sprites.mouth) : null };
}
export function makeCowry(T) {
  const g = new THREE.Group(), SW = 44, SH2 = 64, rx = 17.5 / SW, rz = 26 / SH2;
  const dome = new THREE.SphereGeometry(0.5, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2); dome.scale(COWRY_W, COWRY_H * 2, COWRY_L);
  const p = dome.attributes.position, uv = dome.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, 0.5 + (p.getX(i) / (COWRY_W / 2)) * rx, 1 - (0.5 + (p.getZ(i) / (COWRY_L / 2)) * rz));
  const dm = new THREE.Mesh(dome, new THREE.MeshStandardMaterial({ map: T.back, color: T.back ? 0xffffff : 0xe6cb98, roughness: 0.22, metalness: 0.0 })); dm.castShadow = true; dm.receiveShadow = true;
  const base = new THREE.CircleGeometry(0.5, 32); base.rotateX(Math.PI / 2); base.scale(COWRY_W, 1, COWRY_L);
  const bp = base.attributes.position, bu = base.attributes.uv;
  for (let i = 0; i < bp.count; i++) bu.setXY(i, 0.5 + (bp.getX(i) / (COWRY_W / 2)) * rx, 1 - (0.5 + (bp.getZ(i) / (COWRY_L / 2)) * rz));
  const bm = new THREE.Mesh(base, new THREE.MeshStandardMaterial({ map: T.mouth, color: T.mouth ? 0xffffff : 0xcaa86c, roughness: 0.5, side: THREE.FrontSide })); bm.position.y = -0.002; bm.receiveShadow = true;
  g.add(dm, bm); dm.position.y = -COWRY_H / 2; bm.position.y = -COWRY_H / 2 - 0.002; return g;
}
// ---- the die (Ludo mode): ivory with pips; face order +x,-x,+y,-y,+z,-z = 3,4,1,6,2,5 ----------------------------------------------------------
export const DIE_S = 1.9;
export function makeDie() {
  const PIPS = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] };
  const mats = [3, 4, 1, 6, 2, 5].map((f) => { const c = canvas(128, 128), x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 128, 128); g.addColorStop(0, '#fffaf0'); g.addColorStop(1, '#e3cda0'); x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    x.strokeStyle = 'rgba(120,80,30,0.5)'; x.lineWidth = 6; x.strokeRect(0, 0, 128, 128);
    for (const [px, py] of PIPS[f]) { x.beginPath(); x.arc(64 + px * 30, 64 + py * 30, 11, 0, 7); x.fillStyle = f === 1 ? '#a3282d' : '#3a1a0c'; x.fill(); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return new THREE.MeshStandardMaterial({ map: t, roughness: 0.3 }); });
  const m = new THREE.Mesh(new THREE.BoxGeometry(DIE_S, DIE_S, DIE_S), mats); m.castShadow = true; m.receiveShadow = true; return m;
}
export const DIE_UP = { 1: [0, 0, 0], 6: [Math.PI, 0, 0], 3: [0, 0, Math.PI / 2], 4: [0, 0, -Math.PI / 2], 2: [-Math.PI / 2, 0, 0], 5: [Math.PI / 2, 0, 0] };

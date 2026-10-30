// Gamelan 3D world (presentation only; procedural, no image files). Units: centimetres. x right, y up, z toward the player.
// A lamp-lit pendopo (open teak pavilion): plank floor, a woven mat, red-and-gold pillars, a carved back wall, brass lanterns.
// The instrument is a gendèr-style metallophone: hammered bronze keys hung over graduated brass tube resonators in a carved,
// red-lacquered frame with gilded scroll end boards. Gongs are lathe-turned bronze with a raised boss (kenong sits face up in
// its box on crossed cords; kempul and the big gong hang from a carved gayor). Mallets are padded disc tabuh.
import * as THREE from '../vendor3d/three.js';
import * as B from '../vendor3d/board3d.js';

export const CELL = 8.6;                     // key spacing (cm)
export const KEY_W = 6.6, KEY_T = 1.4;       // key width and thickness
export const KEY_Y = 46;                     // height of the key tops above the floor
export const keyLen = (i, n) => 20 - 5 * (n > 1 ? i / (n - 1) : 0);          // low keys (left) are the longest
export const tubeLen = (i, n) => 30 - 13 * (n > 1 ? i / (n - 1) : 0);
export const GONG_R = { kenong: 17, kempul: 26, gong: 44 };
const TAU = Math.PI * 2;
const cv = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const rng = (s) => () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
const tex = (c, { srgb = true, repeat } = {}) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); } return t; };

// ---- textures ---------------------------------------------------------------------------------------------------------------------------------
// Hammered bronze: warm base with soft hammer dimples (bump) and a few long polishing streaks.
let bronzeTex = null;
function bronzeMaps() {
  if (bronzeTex) return bronzeTex;
  const S = 512, c = cv(S), x = c.getContext('2d'), b = cv(S), bx = b.getContext('2d'), r = rng(7);
  const g = x.createLinearGradient(0, 0, S, S); g.addColorStop(0, '#c08a3c'); g.addColorStop(0.5, '#dcae5c'); g.addColorStop(1, '#b88236');
  x.fillStyle = g; x.fillRect(0, 0, S, S); bx.fillStyle = '#808080'; bx.fillRect(0, 0, S, S);
  for (let i = 0; i < 520; i++) {
    const px = r() * S, py = r() * S, rr = 6 + r() * 16;
    const gb = bx.createRadialGradient(px - rr * 0.2, py - rr * 0.2, 0, px, py, rr); gb.addColorStop(0, 'rgba(0,0,0,0.22)'); gb.addColorStop(0.7, 'rgba(0,0,0,0.05)'); gb.addColorStop(1, 'rgba(255,255,255,0.07)');
    bx.fillStyle = gb; bx.fillRect(px - rr, py - rr, rr * 2, rr * 2);
    const gc = x.createRadialGradient(px, py, 0, px, py, rr); gc.addColorStop(0, r() < 0.5 ? 'rgba(255,226,160,0.10)' : 'rgba(80,40,6,0.10)'); gc.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = gc; x.fillRect(px - rr, py - rr, rr * 2, rr * 2);
  }
  for (let i = 0; i < 40; i++) { x.fillStyle = `rgba(40,70,40,${0.05 + r() * 0.07})`; const px = r() * S, py = r() * S; x.beginPath(); x.ellipse(px, py, 4 + r() * 14, 2 + r() * 6, r() * 3, 0, TAU); x.fill(); }   // faint patina
  bronzeTex = { map: tex(c), bump: tex(b, { srgb: false }) };
  return bronzeTex;
}
// Carved, red-lacquered and gilded panel (floral scrolls in relief). Returns { map, bump }.
const carvedCache = new Map();
export function carvedMaps(w = 1024, h = 256, seed = 3, base = '#7c1612') {
  const k = `${w}x${h}|${seed}|${base}`; if (carvedCache.has(k)) return carvedCache.get(k);
  const c = cv(w, h), x = c.getContext('2d'), b = cv(w, h), bx = b.getContext('2d'), r = rng(seed);
  const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, base); g.addColorStop(1, '#4a0b0a');
  x.fillStyle = g; x.fillRect(0, 0, w, h); bx.fillStyle = '#606060'; bx.fillRect(0, 0, w, h);
  const gold = (ctx, lw, col) => { ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.lineCap = 'round'; };
  // borders
  for (const [ctx, col, col2] of [[x, '#e6b85a', '#8a5a1a'], [bx, '#ffffff', '#c0c0c0']]) {
    gold(ctx, h * 0.05, col); ctx.strokeRect(h * 0.06, h * 0.06, w - h * 0.12, h - h * 0.12);
    gold(ctx, h * 0.018, col2); ctx.strokeRect(h * 0.13, h * 0.13, w - h * 0.26, h - h * 0.26);
  }
  // running scroll: a wave stem with curled leaves
  const n = Math.max(3, Math.round(w / h * 1.6)), seg = (w - h * 0.4) / n, cy = h / 2, amp = h * 0.16;
  for (const [ctx, col, glow] of [[bx, '#ffffff', 0], [x, '#f0c766', 1]]) {
    gold(ctx, h * 0.032, col); ctx.beginPath();
    for (let s = 0; s <= w - h * 0.4; s += 4) { const yy = cy + Math.sin(s / seg * Math.PI) * amp; s ? ctx.lineTo(h * 0.2 + s, yy) : ctx.moveTo(h * 0.2, yy); }
    ctx.stroke();
    for (let i = 0; i < n; i++) {
      const sx = h * 0.2 + seg * (i + 0.5), up = i % 2 ? 1 : -1, sy = cy + up * amp * 0.95;
      for (let q = 0; q < 3; q++) {
        const rr = h * (0.17 - q * 0.045); ctx.lineWidth = h * (0.03 - q * 0.006); ctx.beginPath();
        ctx.arc(sx + up * seg * 0.16 * (q ? 0.5 : 1), sy - up * h * 0.05 * q, rr, up > 0 ? Math.PI * 1.1 : 0.1, up > 0 ? Math.PI * 2.6 : Math.PI * 1.6); ctx.stroke();
      }
      ctx.beginPath(); ctx.ellipse(sx - seg * 0.28, cy - up * amp * 0.2, h * 0.09, h * 0.035, up * 0.7, 0, TAU); ctx.fillStyle = col; ctx.fill();
      ctx.beginPath(); ctx.ellipse(sx + seg * 0.3, cy + up * amp * 0.1, h * 0.08, h * 0.03, -up * 0.6, 0, TAU); ctx.fill();
    }
    if (glow) { x.fillStyle = 'rgba(255,240,200,0.05)'; for (let i = 0; i < 2600; i++) x.fillRect(r() * w, r() * h, 1.5, 1.5); }
  }
  const out = { map: tex(c), bump: tex(b, { srgb: false }) };
  carvedCache.set(k, out); return out;
}
// Teak planks: long boards with seams, varied tone.
function plankMaps() {
  const S = 1024, c = cv(S), x = c.getContext('2d'), b = cv(S), bx = b.getContext('2d'), r = rng(11);
  const rows = 8, rh = S / rows;
  bx.fillStyle = '#808080'; bx.fillRect(0, 0, S, S);
  for (let i = 0; i < rows; i++) {
    const off = r() * S;
    for (let k = -1; k < 2; k++) {
      const x0 = off + k * S * 0.62, wood = B.woodCanvas(256, ['#3a1c0e', '#4a2412', '#33180c'][i % 3], ['#5c321a', '#6a3a1e', '#55301a'][(i + 1) % 3], 3 + i, { lines: 60, knots: 1 });
      x.drawImage(wood.map, 0, 0, 256, 256, x0, i * rh, S * 0.62, rh);
      bx.globalAlpha = 0.6; bx.drawImage(wood.bump, 0, 0, 256, 256, x0, i * rh, S * 0.62, rh); bx.globalAlpha = 1;
      x.fillStyle = 'rgba(10,4,2,0.8)'; x.fillRect(x0 - 1, i * rh, 3, rh); bx.fillStyle = '#202020'; bx.fillRect(x0 - 1, i * rh, 3, rh);
    }
    x.fillStyle = 'rgba(8,3,1,0.85)'; x.fillRect(0, i * rh, S, 3); bx.fillStyle = '#101010'; bx.fillRect(0, i * rh, S, 3);
  }
  return { map: tex(c, { repeat: [5, 5] }), bump: tex(b, { srgb: false, repeat: [5, 5] }) };
}
// Woven pandan mat (tikar) with a red border band.
function matMaps() {
  const S = 512, c = cv(S), x = c.getContext('2d'), b = cv(S), bx = b.getContext('2d');
  x.fillStyle = '#7a5a34'; x.fillRect(0, 0, S, S); bx.fillStyle = '#808080'; bx.fillRect(0, 0, S, S);
  const st = 8;
  for (let i = 0; i < S / st; i++) for (let j = 0; j < S / st; j++) {
    const on = (i + j) % 2 === 0; x.fillStyle = on ? 'rgba(255,230,170,0.18)' : 'rgba(60,30,10,0.18)'; x.fillRect(i * st, j * st, st, st);
    bx.fillStyle = on ? '#b0b0b0' : '#505050'; bx.fillRect(i * st + 1, j * st + 1, st - 2, st - 2);
  }
  for (const [y0, col] of [[20, '#5a1410'], [S - 52, '#5a1410']]) { x.fillStyle = col; x.fillRect(0, y0, S, 32); x.fillStyle = 'rgba(220,170,90,0.35)'; for (let i = 0; i < S; i += 24) { x.beginPath(); x.moveTo(i, y0 + 16); x.lineTo(i + 12, y0 + 6); x.lineTo(i + 24, y0 + 16); x.lineTo(i + 12, y0 + 26); x.fill(); } }
  return { map: tex(c), bump: tex(b, { srgb: false }) };
}
export function radialTex(rgb = '255,180,90', a = 1) {
  const c = cv(128), x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(0.4, `rgba(${rgb},${a * 0.4})`); g.addColorStop(1, `rgba(${rgb},0)`);
  x.fillStyle = g; x.fillRect(0, 0, 128, 128); return tex(c);
}
// Engraved scale numeral decal for a key.
const numCache = new Map();
export function numeralTex(label) {
  if (numCache.has(label)) return numCache.get(label);
  const c = cv(128), x = c.getContext('2d');
  x.font = '800 92px Cinzel, Georgia, serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillStyle = 'rgba(255,236,190,0.55)'; x.fillText(String(label), 66, 70); x.fillStyle = 'rgba(52,26,4,0.92)'; x.fillText(String(label), 64, 66);
  const t = tex(c); numCache.set(label, t); return t;
}

// ---- materials ----------------------------------------------------------------------------------------------------------------------------------
export function materials() {
  const bz = bronzeMaps();
  const bronze = () => new THREE.MeshPhysicalMaterial({ color: 0xffffff, map: bz.map, bumpMap: bz.bump, bumpScale: 0.3, metalness: 1, roughness: 0.48, clearcoat: 0.25, clearcoatRoughness: 0.18, envMapIntensity: 1.0, emissive: 0xff9a40, emissiveIntensity: 0 });
  const cr = carvedMaps(1024, 192, 3);
  const carved = new THREE.MeshPhysicalMaterial({ map: cr.map, bumpMap: cr.bump, bumpScale: 1.2, roughness: 0.35, metalness: 0.15, clearcoat: 0.6, clearcoatRoughness: 0.2 });
  const ce = carvedMaps(256, 512, 5);
  const carvedEnd = new THREE.MeshPhysicalMaterial({ map: ce.map, bumpMap: ce.bump, bumpScale: 1.2, roughness: 0.35, metalness: 0.15, clearcoat: 0.6, clearcoatRoughness: 0.2 });
  return {
    bronze,
    brass: B.material('brass', { color: '#c9963e', color2: '#e8bf6a', roughness: 0.3, envIntensity: 1.8 }),
    tubeIn: new THREE.MeshStandardMaterial({ color: 0x0c0603, roughness: 1, side: THREE.BackSide }),
    teak: B.material('darkWood', { color: '#3a1a0c', color2: '#5a2c14', seed: 8 }),
    red: B.material('lacquer', { color: '#7a1410', color2: '#8e1c14' }),
    gold: new THREE.MeshStandardMaterial({ color: 0xd9a64a, metalness: 1, roughness: 0.32, envMapIntensity: 1.6 }),
    carved, carvedEnd,
    cloth: B.material('cloth', { color: '#5a1410', color2: '#7a2418' }),
    cord: new THREE.MeshStandardMaterial({ color: 0xc8a878, roughness: 0.9 }),
    pad: new THREE.MeshStandardMaterial({ color: 0x2a1610, roughness: 0.95 }),
  };
}

// ---- the metallophone ------------------------------------------------------------------------------------------------------------------------------
// Returns { group, keys: [{ mesh, mat, x, len, i }], width, depth }. Keys centred on x = (i - (n-1)/2) * CELL, z = 0; tops at KEY_Y.
export function buildGender(n, M) {
  const group = new THREE.Group(), keys = [], half = (n - 1) / 2 * CELL, maxL = keyLen(0, n);
  const W = n * CELL + 10, zf = maxL / 2 + 1.5, zb = -maxL / 2 - 1.5;
  const sh = (m) => { m.castShadow = true; m.receiveShadow = true; return m; };
  // rails under the key ends (front and back), each on a carved panel down to the floor
  const railG = B.roundedBox(W, 3.2, 3.4, 0.6);
  for (const z of [zf - 1, zb + 1]) { const r = sh(new THREE.Mesh(railG, M.teak)); r.position.set(0, KEY_Y - KEY_T - 3.6, z); group.add(r); }
  const goldLine = B.roundedBox(W, 0.6, 0.5, 0.2);
  for (const z of [zf + 0.8, zb - 0.8]) { const gl = new THREE.Mesh(goldLine, M.gold); gl.position.set(0, KEY_Y - KEY_T - 3.6, z); group.add(gl); }
  // carved front + back panels (low, so the resonator tubes show above them)
  const PH = 15, panelG = new THREE.BoxGeometry(W, PH, 2.2);
  const front = sh(new THREE.Mesh(panelG, [M.teak, M.teak, M.teak, M.teak, M.carved, M.teak])); front.position.set(0, 4 + PH / 2, zf); group.add(front);
  const back = sh(new THREE.Mesh(panelG, [M.teak, M.teak, M.teak, M.teak, M.teak, M.carved])); back.position.set(0, 4 + PH / 2, zb); group.add(back);
  const capG = B.roundedBox(W + 2, 1.6, 3.6, 0.5);
  for (const z of [zf, zb]) { const cp = sh(new THREE.Mesh(capG, M.teak)); cp.position.set(0, 4 + PH + 0.6, z); group.add(cp); const bs = sh(new THREE.Mesh(capG, M.teak)); bs.position.set(0, 3.2, z); group.add(bs); }
  // feet
  const footG = B.roundedBox(5, 3, maxL + 9, 0.8);
  for (const s of [-1, 1]) { const f = sh(new THREE.Mesh(footG, M.teak)); f.position.set(s * (W / 2 - 3), 1.5, 0); group.add(f); }
  // carved end boards with a scroll crest (the gendèr's "wings")
  const shape = new THREE.Shape(), hw = (zf - zb) / 2 + 1.5, top = KEY_Y + 2;
  shape.moveTo(-hw, 0); shape.lineTo(hw, 0); shape.lineTo(hw, KEY_Y - 8);
  shape.bezierCurveTo(hw + 2.5, KEY_Y - 2, hw - 1, top + 4, hw * 0.35, top + 1);
  shape.bezierCurveTo(0, top - 1, -hw * 0.4, top + 3.5, -hw * 0.8, top + 1.5);
  shape.bezierCurveTo(-hw - 3, top - 1, -hw - 1, KEY_Y - 6, -hw, KEY_Y - 12); shape.lineTo(-hw, 0);
  const endG = new THREE.ExtrudeGeometry(shape, { depth: 2.4, bevelEnabled: true, bevelThickness: 0.5, bevelSize: 0.5, bevelSegments: 2, curveSegments: 16 });
  endG.computeBoundingBox(); { const bb = endG.boundingBox, uv = endG.attributes.uv, p = endG.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, (p.getX(i) - bb.min.x) / (bb.max.x - bb.min.x), (p.getY(i) - bb.min.y) / (bb.max.y - bb.min.y)); }
  for (const s of [-1, 1]) {
    const e = sh(new THREE.Mesh(endG, M.carvedEnd)); e.rotation.y = Math.PI / 2 * s; e.position.set(s * (W / 2 + 0.2), 0, 0); group.add(e);
    const finial = sh(new THREE.Mesh(B.lathe([[0, 0], [1.3, 0.3], [1.5, 1.3], [0.9, 2.4], [1.1, 3.3], [0, 4.6]], 16), M.gold)); finial.position.set(s * (W / 2 + 1.4), top + 2.6, s > 0 ? -hw * 0.35 : hw * 0.35); group.add(finial);
  }
  // keys, posts, cords, tubes
  const bz = M.bronze, postG = new THREE.CylinderGeometry(0.35, 0.35, 3.4, 8), cordG = new THREE.TorusGeometry(0.55, 0.22, 6, 12), padG = B.roundedBox(KEY_W * 0.9, 0.5, 1.6, 0.2);
  const tubeR = Math.min(3.3, CELL * 0.4);
  for (let i = 0; i < n; i++) {
    const x = (i - (n - 1) / 2) * CELL, len = keyLen(i, n), mat = bz();
    const key = sh(new THREE.Mesh(B.roundedBox(KEY_W, KEY_T, len, 0.55, 3), mat)); key.position.set(x, KEY_Y - KEY_T / 2, 0); group.add(key);
    const ridge = sh(new THREE.Mesh(B.roundedBox(KEY_W * 0.3, 0.35, len * 0.8, 0.17, 2), mat)); ridge.position.set(x, KEY_Y + 0.12, 0); group.add(ridge);
    for (const f of [-0.28, 0.28]) {
      const z = f * len;
      const pad = sh(new THREE.Mesh(padG, M.pad)); pad.position.set(x, KEY_Y - KEY_T - 0.3, z); group.add(pad);
      const post = new THREE.Mesh(postG, M.brass); post.position.set(x + KEY_W * 0.5 + 0.5, KEY_Y - KEY_T - 0.4, z); group.add(post);
      const cord = new THREE.Mesh(cordG, M.cord); cord.rotation.y = Math.PI / 2; cord.position.set(x, KEY_Y - KEY_T * 0.5, z); cord.scale.set(1, 1, KEY_W / 1.1); group.add(cord);
    }
    for (const z of [-0.28 * len, 0.28 * len]) { const rr = new THREE.Mesh(B.roundedBox(1.2, 3.6, 1.2, 0.3), M.teak); rr.position.set(x + KEY_W * 0.5 + 0.5, KEY_Y - KEY_T - 3.4, z); group.add(rr); }
    const tl = tubeLen(i, n), tg = new THREE.CylinderGeometry(tubeR, tubeR, tl, 24, 1, true);
    const tube = sh(new THREE.Mesh(tg, M.brass)); tube.position.set(x, KEY_Y - 5.5 - tl / 2, 0); group.add(tube);
    const inner = new THREE.Mesh(tg, M.tubeIn); inner.position.copy(tube.position); inner.scale.set(0.96, 1, 0.96); group.add(inner);
    const lip = new THREE.Mesh(new THREE.TorusGeometry(tubeR, 0.35, 8, 24), M.brass); lip.rotation.x = Math.PI / 2; lip.position.set(x, KEY_Y - 5.5, 0); group.add(lip);
    const num = new THREE.Mesh(new THREE.PlaneGeometry(KEY_W * 0.62, KEY_W * 0.62), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, toneMapped: false }));
    num.rotation.x = -Math.PI / 2; num.position.set(x, KEY_Y + 0.42, len * 0.36); num.renderOrder = 2; num.visible = false; group.add(num);
    keys.push({ mesh: key, ridge, mat, x, len, i, num });
  }
  // tube rail across the bottom of the tubes
  const tr = sh(new THREE.Mesh(B.roundedBox(W - 2, 1.4, 2, 0.4), M.teak)); tr.position.set(0, KEY_Y - 5.5 - tubeLen(0, n) + 2, tubeR + 1.2); group.add(tr);
  return { group, keys, width: W + 6, depth: zf - zb + 6, half };
}

// A gong: lathe-turned bronze with a boss. kind 'kenong' = deep kettle facing up (+y); 'kempul' / 'gong' face +z.
export function gongGeo(kind) {
  const R = 1;
  const p = kind === 'kenong'
    ? [[0, 0.62], [0.12, 0.64], [0.2, 0.78], [0.27, 0.75], [0.31, 0.62], [0.62, 0.6], [0.92, 0.55], [1, 0.48], [1.02, 0.1], [0.94, 0], [0.88, 0.08], [0.9, 0.45], [0.6, 0.52], [0, 0.55]]
    : [[0, 0.2], [0.09, 0.21], [0.15, 0.3], [0.24, 0.29], [0.29, 0.13], [0.34, 0.1], [0.9, 0.08], [0.97, 0.06], [R, 0.02], [R, -0.24], [0.97, -0.27], [0.95, -0.05], [0.6, 0.02], [0, 0.04]];
  const g = B.lathe(p.slice().reverse(), 48);                       // listed centre-out; the lathe wants bottom-up for outward normals
  if (kind !== 'kenong') g.rotateX(Math.PI / 2);
  return g;
}
export function buildGong(kind, M) {
  const r = GONG_R[kind], g = new THREE.Group(), mat = M.bronze(); mat.envMapIntensity = 2.2; mat.roughness = 0.4;
  const disc = new THREE.Mesh(gongGeo(kind), mat); disc.castShadow = true; disc.receiveShadow = true; disc.scale.setScalar(r); g.add(disc);
  return { group: g, disc, mat, r, kind };
}
// Stand for a hanging gong (gayor): two posts, a carved beam with gilded scroll ends, cords. Returns { group, pivot } (hang the gong on pivot).
export function buildGayor(r, M) {
  const g = new THREE.Group(), W = r * 2.7, H = r * 2.55 + 16, sh = (m) => { m.castShadow = true; m.receiveShadow = true; return m; };
  for (const s of [-1, 1]) {
    const post = sh(new THREE.Mesh(B.roundedBox(5, H, 5, 0.8), M.red)); post.position.set(s * W / 2, H / 2, 0); g.add(post);
    const foot = sh(new THREE.Mesh(B.roundedBox(8, 5, 34, 1), M.teak)); foot.position.set(s * W / 2, 2.5, 0); g.add(foot);
    for (const y of [H * 0.18, H * 0.82]) { const band = new THREE.Mesh(B.roundedBox(5.8, 1.2, 5.8, 0.3), M.gold); band.position.set(s * W / 2, y, 0); g.add(band); }
    const crest = sh(new THREE.Mesh(new THREE.TorusGeometry(4.2, 1.3, 10, 24, Math.PI * 1.5), M.gold)); crest.position.set(s * (W / 2 + 4), H + 3, 0); crest.rotation.z = s > 0 ? -0.6 : Math.PI + 0.6; g.add(crest);
  }
  const beam = sh(new THREE.Mesh(new THREE.BoxGeometry(W + 10, 9, 5), [M.teak, M.teak, M.gold, M.teak, M.carved, M.carved])); beam.position.set(0, H, 0); g.add(beam);
  const pivot = new THREE.Group(); pivot.position.set(0, H - 4.5, 0); g.add(pivot);
  for (const s of [-1, 1]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 14 + r * 0.2, 6), M.cord); c.position.set(s * r * 0.35, -(7 + r * 0.1), 0); c.rotation.z = s * 0.18; pivot.add(c); }
  return { group: g, pivot, hangY: H - 4.5 - (14 + r * 0.2) - r * 0.82 };
}
// Kenong box (rancak): a red box with crossed cords the kettle sits on.
export function buildKenongBox(M) {
  const g = new THREE.Group(), s = GONG_R.kenong * 2.5, h = 26;
  const box = new THREE.Mesh(B.roundedBox(s, h, s, 1.2), M.red); box.position.y = h / 2; box.castShadow = box.receiveShadow = true; g.add(box);
  const top = new THREE.Mesh(B.roundedBox(s + 2, 2, s + 2, 0.6), M.gold); top.position.y = h; g.add(top);
  for (const a of [Math.PI / 4, -Math.PI / 4]) { const c = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, s * 1.3, 6), M.cord); c.rotation.z = Math.PI / 2; c.rotation.y = a; c.position.y = h + 1.4; g.add(c); }
  return { group: g, topY: h + 1.4 };
}

// Padded disc mallet (tabuh): the disc rim strikes. Origin at the strike point on the rim; the stick runs up toward +y/+z.
export function buildMallet(M) {
  const g = new THREE.Group(), R = 3.6;
  const head = new THREE.Group(); g.add(head);
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 1.1, 28), M.teak); disc.rotation.z = Math.PI / 2; disc.position.y = R; disc.castShadow = true; head.add(disc);
  const pad = new THREE.Mesh(new THREE.TorusGeometry(R, 0.6, 10, 28), M.pad); pad.rotation.y = Math.PI / 2; pad.position.y = R; pad.castShadow = true; head.add(pad);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(R * 0.45, 0.22, 6, 20), M.gold); ring.rotation.y = Math.PI / 2; ring.position.set(0.85, R, 0); head.add(ring);
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, 24, 10), M.teak); stick.position.set(0, R * 2 + 11.5, 0); stick.castShadow = true; head.add(stick);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.9, 10, 8), M.gold); cap.position.set(0, R * 2 + 23.6, 0); head.add(cap);
  return { group: g, head };
}

// ---- the hall -------------------------------------------------------------------------------------------------------------------------------------
export function buildHall(scene, M, { quality = 1 } = {}) {
  const hall = new THREE.Group(); scene.add(hall);
  const pl = plankMaps();
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(1600, 1600), new THREE.MeshPhysicalMaterial({ color: 0x8a6a5a, map: pl.map, bumpMap: pl.bump, bumpScale: 0.8, roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.3, envMapIntensity: 0.5 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; hall.add(floor);
  const mm = matMaps();
  const mat = new THREE.Mesh(new THREE.PlaneGeometry(170, 150), new THREE.MeshStandardMaterial({ color: 0x9a8a80, map: mm.map, bumpMap: mm.bump, bumpScale: 0.6, roughness: 0.95 }));
  mat.rotation.x = -Math.PI / 2; mat.position.set(0, 0.15, 30); mat.receiveShadow = true; hall.add(mat);
  // pillars (soko guru): red lacquer, gold bands, carved stone bases
  const pillarG = new THREE.CylinderGeometry(13, 14, 420, 28), baseG = B.lathe([[0, 0], [24, 0], [24, 8], [20, 12], [18, 22], [15, 26], [0, 26]], 32);
  const pillars = [[-200, -190], [200, -190], [-330, 40], [330, 40]];
  for (const [x, z] of pillars) {
    const p = new THREE.Mesh(pillarG, M.red); p.position.set(x, 236, z); p.castShadow = true; p.receiveShadow = true; hall.add(p);
    const b = new THREE.Mesh(baseG, B.material('stone', { color: '#4a3a30', color2: '#6a5444' })); b.position.set(x, 0, z); b.receiveShadow = true; hall.add(b);
    for (const y of [40, 52, 300]) { const band = new THREE.Mesh(new THREE.CylinderGeometry(14.2, 14.2, y === 52 ? 3 : 6, 28), M.gold); band.position.set(x, y, z); hall.add(band); }
    const capT = new THREE.Mesh(new THREE.CylinderGeometry(16, 14, 70, 28, 1, true), M.carvedEnd); capT.position.set(x, 340, z); hall.add(capT);
  }
  // the carved back wall (gebyok): teak frame with carved red-gold panels
  const wall = new THREE.Group(); wall.position.set(0, 0, -480); hall.add(wall);
  const wallM = B.material('darkWood', { color: '#2a1208', color2: '#3a1a0c', seed: 12 });
  const wb = new THREE.Mesh(new THREE.BoxGeometry(1100, 520, 8), wallM); wb.position.set(0, 260, -6); wb.receiveShadow = true; wall.add(wb);
  const pc = carvedMaps(512, 512, 9, '#5a120e'), panM = new THREE.MeshPhysicalMaterial({ map: pc.map, bumpMap: pc.bump, bumpScale: 1.5, roughness: 0.4, metalness: 0.2, clearcoat: 0.4 });
  for (let i = -3; i <= 3; i++) {
    const pn = new THREE.Mesh(B.roundedBox(110, 170, 4, 2), panM); pn.position.set(i * 140, 150, 0); pn.receiveShadow = true; wall.add(pn);
    const lo = new THREE.Mesh(B.roundedBox(110, 60, 4, 2), M.carved); lo.position.set(i * 140, 36, 0); lo.receiveShadow = true; wall.add(lo);
    const tp = new THREE.Mesh(B.roundedBox(110, 46, 4, 2), M.carved); tp.position.set(i * 140, 280, 0); wall.add(tp);
  }
  // lanterns: brass cages with a warm glass, chains up out of view; point lights
  const lamps = [];
  const glowT = radialTex('255,170,80', 1);
  for (const [x, y, z] of [[-150, 150, -140], [150, 150, -140], [-300, 190, -260], [300, 190, -260]]) {
    const lg = new THREE.Group(); lg.position.set(x, y, z); hall.add(lg);
    lg.add(new THREE.Mesh(B.lathe([[0, -16], [5, -14], [8.5, -9], [9, -8]], 12), M.brass), new THREE.Mesh(B.lathe([[9, 8], [7, 12], [3, 16], [1.5, 22], [0, 24]], 12), M.brass));
    for (let k = 0; k < 6; k++) { const a = k / 6 * TAU, bar = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 16, 5), M.brass); bar.position.set(Math.cos(a) * 9, 0, Math.sin(a) * 9); lg.add(bar); }
    const glass = new THREE.Mesh(new THREE.SphereGeometry(7, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffc070, toneMapped: false })); glass.scale.set(1, 1.15, 1); lg.add(glass);
    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 300, 4), M.brass); chain.position.y = 174; lg.add(chain);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowT, color: 0xffb060, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.55 })); halo.scale.set(80, 80, 1); lg.add(halo);
    const light = new THREE.PointLight(0xffb878, quality ? 9000 : 6000, 700, 2); light.position.set(0, -4, 0); lg.add(light);
    lamps.push({ group: lg, light, halo, base: light.intensity, ph: x * 0.013 + z * 0.007 });
  }
  return { hall, floor, mat, lamps, wall };
}

// Key + rim + fill. Shadows from the key light only (a lantern-like warm sun through the pavilion).
export function buildLights(scene) {
  const hemi = new THREE.HemisphereLight(0x6a4030, 0x140806, 0.22); scene.add(hemi);
  // a warm pool of lamplight on the instrument and the mat, falling off into the dark hall
  const key = new THREE.SpotLight(0xffe2c0, 5.0, 0, 0.36, 0.8, 0); key.position.set(-80, 300, 170); key.target.position.set(0, 20, 0); scene.add(key, key.target);
  key.shadow.camera.near = 40; key.shadow.camera.far = 700; key.shadow.bias = -0.0003; key.shadow.normalBias = 0.5; key.shadow.radius = 5;
  const rim = new THREE.DirectionalLight(0xff9050, 1.5); rim.position.set(90, 90, -160); scene.add(rim);
  const fill = new THREE.DirectionalLight(0x9fb0ff, 0.18); fill.position.set(60, 40, 160); scene.add(fill);
  return { hemi, key, rim, fill };
}

// A dark, warm environment for reflections (instead of a bright neutral room): lamp glows, a dim teak ceiling and floor bounce.
export function warmEnvScene() {
  const sc = new THREE.Scene(); sc.background = new THREE.Color(0x0a0403);
  const box = new THREE.Mesh(new THREE.BoxGeometry(100, 50, 100), new THREE.MeshBasicMaterial({ color: 0x1c0d07, side: THREE.BackSide })); box.position.y = 20; sc.add(box);
  const lamp = (x, y, z, s, c) => { const m = new THREE.Mesh(new THREE.SphereGeometry(s, 12, 8), new THREE.MeshBasicMaterial({ color: c })); m.position.set(x, y, z); sc.add(m); };
  const front = new THREE.Mesh(new THREE.PlaneGeometry(70, 26), new THREE.MeshBasicMaterial({ color: 0x4a2a14 })); front.position.set(0, 12, 48); front.rotation.y = Math.PI; sc.add(front);
  lamp(-22, 34, 18, 3.2, 0xffe2b0); lamp(8, 18, 47, 7, 0xd08848); lamp(24, 36, -20, 3, 0xffb070); lamp(-30, 26, -25, 2.5, 0xff9a50); lamp(30, 22, 25, 2, 0xffc890);
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(60, 18), new THREE.MeshBasicMaterial({ color: 0x6a3a1c, side: THREE.DoubleSide })); panel.position.set(0, 44, 0); panel.rotation.x = Math.PI / 2; sc.add(panel);
  const flr = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), new THREE.MeshBasicMaterial({ color: 0x2a1408 })); flr.rotation.x = -Math.PI / 2; flr.position.y = -4; sc.add(flr);
  return sc;
}

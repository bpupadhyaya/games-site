// The lit 3D world for Hasami Shogi: a kaya shogi-ban (straight masame grain, black lacquer grid lines raised a hair above the wood,
// four star points, carved gardenia-fruit feet), five-sided wedge koma that are thicker at the base than at the tip, two komadai
// (piece stands) and a tatami floor with dark cloth borders, under a warm paper lamp. Units are centimetres.
// Presentation only: nothing here reads or changes the simulation.
import * as THREE from '../vendor3d/three.js';
import * as B from '../vendor3d/board3d.js';
import { WOODS, PIECE_STYLES } from '../src/art.js';

export const SX = 3.0, SZ = 3.3;            // a real shogi-ban cell: 30 mm across, 33 mm toward the player (looks square when seated)
export const MARGIN = 1.55;                 // board margin in cm beyond the outer grid line
export const BW = 9 * SX + 2 * MARGIN, BD = 9 * SZ + 2 * MARGIN;   // 30.1 x 32.8 cm top
export const T = 6.0, LEG = 3.0;            // block thickness, feet height
export const TOP = T + LEG;                 // y of the playing surface
export const KW = 2.3, KL = 2.66, KH0 = 0.82, KH1 = 0.5;           // koma: base width, length, thickness at the base and at the tip
const TAU = Math.PI * 2;
const hash = (a, b = 0) => { let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967295; };
const cv = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const texOf = (c, srgb = true, aniso = 8) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso; return t; };

// square index -> centre on the board top (row 0 is the far side, White's home rank)
export const sqPos = (i) => ({ x: ((i % 9) - 4) * SX, z: (((i / 9) | 0) - 4) * SZ });
export const radialTex = (rgb, a = 1, inner = 0) => {
  const c = cv(128), x = c.getContext('2d'), g = x.createRadialGradient(64, 64, inner * 64, 64, 64, 64);
  if (inner > 0) g.addColorStop(0, `rgba(${rgb},0)`);
  g.addColorStop(Math.max(inner, 0.001), `rgba(${rgb},${a})`); g.addColorStop(Math.min(1, inner + (1 - inner) * 0.45), `rgba(${rgb},${a * 0.42})`); g.addColorStop(1, `rgba(${rgb},0)`);
  x.fillStyle = g; x.fillRect(0, 0, 128, 128); return texOf(c);
};

// ---------------------------------------------------------------- the board top: masame grain, lacquer lines, star points, coordinates
function paintTop(wood, px) {
  const W = WOODS[wood] ?? WOODS.kaya, pw = px, ph = Math.round(px * BD / BW), k = pw / BW;
  const map = cv(pw, ph), bump = cv(pw, ph), m = map.getContext('2d'), b = bump.getContext('2d');
  const g = B.woodCanvas(1024, W.top[2], W.top[0], wood.length * 11 + 5, { lines: 210, knots: 0 });
  for (const [ctx, src] of [[m, g.map], [b, g.bump]]) { ctx.save(); ctx.translate(pw / 2, ph / 2); ctx.rotate(Math.PI / 2); ctx.drawImage(src, -ph / 2, -pw / 2, ph, pw); ctx.restore(); }
  const gr = W.grain.join(',');
  for (let i = 0; i < 30; i++) {                                         // long straight growth lines running toward the player
    const x0 = hash(i, 3) * pw, amp = pw * 0.003 * (0.3 + hash(i, 4)), a = 0.04 + hash(i, 5) * 0.09;
    m.strokeStyle = `rgba(${gr},${a})`; m.lineWidth = 1 + hash(i, 6) * 3; m.beginPath();
    for (let y = 0; y <= ph; y += 16) { const x = x0 + Math.sin(y * 0.004 + i) * amp; y ? m.lineTo(x, y) : m.moveTo(x, y); }
    m.stroke();
  }
  let lg = m.createLinearGradient(0, 0, pw, ph); lg.addColorStop(0, 'rgba(255,242,210,0.12)'); lg.addColorStop(1, 'rgba(70,35,8,0.14)'); m.fillStyle = lg; m.fillRect(0, 0, pw, ph);
  const X = (i) => (MARGIN + i * SX) * k, Z = (j) => (MARGIN + j * SZ) * k;
  const lw = Math.max(1.6, 0.07 * k);
  for (const [ctx, col, extra] of [[m, '#1a0f07', 0], [b, '#ffffff', lw * 0.6]]) {
    ctx.save(); ctx.strokeStyle = col; ctx.lineCap = 'square'; ctx.lineWidth = lw + extra; ctx.beginPath();
    for (let i = 0; i <= 9; i++) { ctx.moveTo(X(i), Z(0)); ctx.lineTo(X(i), Z(9)); ctx.moveTo(X(0), Z(i)); ctx.lineTo(X(9), Z(i)); }
    ctx.stroke(); ctx.lineWidth = lw * 1.9 + extra; ctx.strokeRect(X(0), Z(0), X(9) - X(0), Z(9) - Z(0));
    ctx.fillStyle = col; for (const [sx, sz] of [[3, 3], [6, 3], [3, 6], [6, 6]]) { ctx.beginPath(); ctx.ellipse(X(sx), Z(sz), 0.17 * k + extra, 0.17 * k + extra, 0, 0, TAU); ctx.fill(); }
    ctx.restore();
  }
  // coordinates in the margin: files 9..1 along the far edge, ranks a..i down the right (as on the flat board)
  const fs = 0.78 * k; m.font = `700 ${fs}px "Cormorant Garamond", Georgia, serif`; m.textAlign = 'center'; m.textBaseline = 'middle'; m.fillStyle = `rgba(${gr},0.62)`;
  for (let i = 0; i < 9; i++) { m.fillText(String(9 - i), X(i + 0.5), MARGIN * k * 0.5); m.fillText('abcdefghi'[i], pw - MARGIN * k * 0.5, Z(i + 0.5)); }
  return { map: texOf(map), bump: texOf(bump, false) };
}

// ---------------------------------------------------------------- tatami: woven igusa rush with dark cloth borders (heri) on the long sides
function paintTatami() {
  const w = 1024, h = 512, c = cv(w, h), x = c.getContext('2d'), b = cv(w, h), bx = b.getContext('2d');
  x.fillStyle = '#8c8048'; x.fillRect(0, 0, w, h); bx.fillStyle = '#808080'; bx.fillRect(0, 0, w, h);
  const step = 6;                                                       // one weave row every ~1 cm across the 182 cm mat
  for (let i = 0; i < w; i += step) {
    const t = hash(i, 11), col = t < 0.5 ? `rgba(110,108,56,${0.18 + t * 0.16})` : `rgba(214,196,128,${0.1 + (t - 0.5) * 0.16})`;
    x.fillStyle = col; x.fillRect(i, 0, step * 0.55, h);
    bx.fillStyle = 'rgba(255,255,255,0.45)'; bx.fillRect(i + 1, 0, step * 0.45, h); bx.fillStyle = 'rgba(0,0,0,0.5)'; bx.fillRect(i + step * 0.6, 0, step * 0.3, h);
  }
  for (let j = 0; j < h; j += 3) { x.fillStyle = `rgba(255,240,190,${0.03 + hash(j, 9) * 0.04})`; x.fillRect(0, j, w, 1); }
  for (let n = 0; n < 9000; n++) { x.fillStyle = hash(n, 21) < 0.5 ? 'rgba(255,240,200,0.05)' : 'rgba(40,40,10,0.06)'; x.fillRect(hash(n, 22) * w, hash(n, 23) * h, 1 + hash(n, 24) * 3, 1); }
  // the warp threads of the facing
  for (const yy of [h * 0.25, h * 0.5, h * 0.75]) { x.fillStyle = 'rgba(80,70,30,0.12)'; x.fillRect(0, yy, w, 2); }
  const heri = 16;                                                      // ~3 cm cloth border, dark indigo with a fine pattern
  for (const y0 of [0, h - heri]) {
    x.fillStyle = '#16161c'; x.fillRect(0, y0, w, heri);
    for (let i = 0; i < w; i += 8) { x.fillStyle = 'rgba(160,140,90,0.18)'; x.fillRect(i, y0 + heri * 0.35, 4, heri * 0.3); }
    x.fillStyle = 'rgba(255,255,255,0.06)'; x.fillRect(0, y0 + (y0 ? 0 : heri - 1), w, 1);
    bx.fillStyle = '#909090'; bx.fillRect(0, y0, w, heri);
  }
  const g2 = x.createLinearGradient(0, 0, 0, h); g2.addColorStop(0, 'rgba(0,0,0,0.12)'); g2.addColorStop(0.08, 'rgba(0,0,0,0)'); g2.addColorStop(0.92, 'rgba(0,0,0,0)'); g2.addColorStop(1, 'rgba(0,0,0,0.12)');
  x.fillStyle = g2; x.fillRect(0, 0, w, h);
  return { map: texOf(c), bump: texOf(b, false) };
}

// ---------------------------------------------------------------- materials
export function makeMaterials(wood) {
  const W = WOODS[wood] ?? WOODS.kaya;
  const side = B.material('wood', { color: W.frame[1], color2: W.frame[0], seed: 14 + wood.length, roughness: 0.48 });
  side.bumpScale = 0.25;
  const end = side.clone(); end.color = new THREE.Color(0xd9c3a8);                   // end grain on the left/right faces is darker
  const feet = B.material('wood', { color: W.edge[1], color2: W.edge[0], seed: 31, roughness: 0.42 });
  const tat = paintTatami();
  tat.map.wrapS = tat.map.wrapT = THREE.ClampToEdgeWrapping;
  const tatami = new THREE.MeshStandardMaterial({ map: tat.map, bumpMap: tat.bump, bumpScale: 0.6, roughness: 0.92, metalness: 0, color: 0xb8ad8e });
  const stand = B.material('darkWood', { color: '#3a2212', color2: '#5a3820', seed: 8 });
  return { side, end, feet, tatami, stand };
}

// ---------------------------------------------------------------- the shogi-ban
const footProfile = () => [[0, 0], [1.2, 0], [1.8, 0.5], [2.0, 1.2], [1.6, 2.0], [1.0, 2.6], [1.25, LEG], [0, LEG]];
export function buildBoard(wood, mats, px = 2048) {
  const g = new THREE.Group();
  const block = new THREE.Mesh(B.roundedBox(BW, T, BD, 0.35, 4), [mats.end, mats.end, mats.side, mats.side, mats.side, mats.side]);
  block.position.y = LEG + T / 2; block.castShadow = true; block.receiveShadow = true; g.add(block);
  const top = paintTop(wood, px);
  const topMat = new THREE.MeshPhysicalMaterial({ map: top.map, bumpMap: top.bump, bumpScale: 0.35, roughness: 0.42, metalness: 0, clearcoat: 0.28, clearcoatRoughness: 0.35 });
  const face = new THREE.Mesh(new THREE.PlaneGeometry(BW - 0.36, BD - 0.36), topMat);
  face.rotation.x = -Math.PI / 2; face.position.y = TOP + 0.002; face.receiveShadow = true; g.add(face);
  const fg = new THREE.LatheGeometry(footProfile().map(([r, y]) => new THREE.Vector2(r, y)), 28);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const f = new THREE.Mesh(fg, mats.feet); f.position.set(sx * (BW / 2 - 3.6), 0, sz * (BD / 2 - 3.6)); f.castShadow = true; g.add(f); }
  // the soft dark contact under the block
  const sh = new THREE.Mesh(new THREE.PlaneGeometry(BW * 1.5, BD * 1.5), new THREE.MeshBasicMaterial({ map: radialTex('0,0,0', 0.75), transparent: true, depthWrite: false }));
  sh.rotation.x = -Math.PI / 2; sh.position.y = 0.03; sh.renderOrder = 1; g.add(sh);
  g.userData.topMat = topMat;
  return g;
}

// ---------------------------------------------------------------- tatami floor (running bond, 182 x 91 cm mats)
export function buildFloor(mats) {
  const g = new THREE.Group(), geo = new THREE.PlaneGeometry(182, 91);
  for (let r = -4; r <= 3; r++) for (let c = -3; c <= 2; c++) {
    const m = new THREE.Mesh(geo, mats.tatami); m.rotation.x = -Math.PI / 2;
    m.position.set(c * 182 + (r & 1 ? 91 : 0) + 30, 0, r * 91 + 45.5 + 22); m.receiveShadow = true; g.add(m);
  }
  return g;
}

// ---------------------------------------------------------------- komadai (piece stand), 18 x 18 cm tray on four feet
export const STAND = { w: 17, d: 17, h: 8.6 };
export function buildStand(mats) {
  const g = new THREE.Group();
  const tray = new THREE.Mesh(B.slab(STAND.w, STAND.d, 1.6, 0.6, 0.18), mats.stand); tray.position.y = STAND.h - 1.6; tray.castShadow = tray.receiveShadow = true; g.add(tray);
  const lip = new THREE.Mesh(B.slab(STAND.w - 2.4, STAND.d - 2.4, 0.25, 0.4, 0.05), mats.side); lip.position.y = STAND.h - 0.1; lip.receiveShadow = true; g.add(lip);
  const lg = new THREE.CylinderGeometry(0.75, 1.0, STAND.h - 1.6, 16); lg.translate(0, (STAND.h - 1.6) / 2, 0);
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { const l = new THREE.Mesh(lg, mats.stand); l.position.set(sx * (STAND.w / 2 - 2), 0, sz * (STAND.d / 2 - 2)); l.castShadow = true; g.add(l); }
  const sh = new THREE.Mesh(new THREE.PlaneGeometry(STAND.w * 1.7, STAND.d * 1.7), new THREE.MeshBasicMaterial({ map: radialTex('0,0,0', 0.6), transparent: true, depthWrite: false }));
  sh.rotation.x = -Math.PI / 2; sh.position.y = 0.04; sh.renderOrder = 1; g.add(sh);
  g.userData.topY = STAND.h + 0.15;
  return g;
}

// ---------------------------------------------------------------- koma: a five-sided wedge, tip toward -z, thicker at the base
// Two material groups: 0 = the top face (texture with the engraved letter), 1 = sides, chamfer and bottom (plain wood).
export function komaGeometry(bev = 0.075) {
  const P = [[0, -KL / 2], [KW * 0.35, -KL / 2 + KL * 0.17], [KW / 2, KL / 2], [-KW / 2, KL / 2], [-KW * 0.35, -KL / 2 + KL * 0.17]];
  const cx = 0, cz = P.reduce((s, p) => s + p[1], 0) / P.length;
  const Q = P.map(([x, z]) => { const dx = x - cx, dz = z - cz, d = Math.hypot(dx, dz); return [x - (dx / d) * bev * 1.3, z - (dz / d) * bev * 1.3]; });
  const H = (z) => KH1 + (KH0 - KH1) * ((z + KL / 2) / KL);
  const pos = [], uv = [], groups = [[], []];
  const tri = (a, b, c, out, g, uvs) => {
    const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], ac = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const n = [ab[1] * ac[2] - ab[2] * ac[1], ab[2] * ac[0] - ab[0] * ac[2], ab[0] * ac[1] - ab[1] * ac[0]];
    let A = a, Bv = b, C = c, ua = uvs[0], ub = uvs[1], uc = uvs[2];
    if (n[0] * out[0] + n[1] * out[1] + n[2] * out[2] < 0) { Bv = c; C = b; ub = uvs[2]; uc = uvs[1]; }
    groups[g].push([A, Bv, C, ua, ub, uc]);
  };
  const tuv = ([x, z]) => [(x + KW / 2) / KW, 1 - (z + KL / 2) / KL];
  const suv = (p, y) => [(p[0] + p[1]) * 0.3, y * 0.3];
  // top face (fan) and bottom
  for (let i = 1; i < 4; i++) {
    const a = Q[0], b = Q[i], c = Q[i + 1];
    tri([a[0], H(a[1]), a[1]], [b[0], H(b[1]), b[1]], [c[0], H(c[1]), c[1]], [0, 1, 0], 0, [tuv(a), tuv(b), tuv(c)]);
    const pa = P[0], pb = P[i], pc = P[i + 1];
    tri([pa[0], 0, pa[1]], [pb[0], 0, pb[1]], [pc[0], 0, pc[1]], [0, -1, 0], 1, [[0, 0], [1, 0], [0, 1]]);
  }
  for (let i = 0; i < 5; i++) {
    const p = P[i], q = P[(i + 1) % 5], pi = Q[i], qi = Q[(i + 1) % 5];
    const mx = (p[0] + q[0]) / 2, mz = (p[1] + q[1]) / 2, out = [mx - cx, 0, mz - cz];
    const p0 = [p[0], 0, p[1]], q0 = [q[0], 0, q[1]], p1 = [p[0], H(p[1]) - bev, p[1]], q1 = [q[0], H(q[1]) - bev, q[1]];
    tri(p0, q0, q1, out, 1, [suv(p, 0), suv(q, 0), suv(q, H(q[1]))]); tri(p0, q1, p1, out, 1, [suv(p, 0), suv(q, H(q[1])), suv(p, H(p[1]))]);
    const p2 = [pi[0], H(pi[1]), pi[1]], q2 = [qi[0], H(qi[1]), qi[1]], up = [out[0], 1.4, out[2]];
    tri(p1, q1, q2, up, 1, [suv(p, 1), suv(q, 1), suv(q, 1.1)]); tri(p1, q2, p2, up, 1, [suv(p, 1), suv(q, 1.1), suv(p, 1.1)]);
  }
  const geo = new THREE.BufferGeometry(); let start = 0;
  for (let gi = 0; gi < 2; gi++) {
    for (const [a, b, c, ua, ub, uc] of groups[gi]) { pos.push(...a, ...b, ...c); uv.push(...ua, ...ub, ...uc); }
    geo.addGroup(start, groups[gi].length * 3, gi); start += groups[gi].length * 3;
  }
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.computeVertexNormals();
  return geo;
}

// Face texture: wood of the piece with the letter (B / W) or the shogi mark cut into it. rot = turn the mark half round.
const FONT_JP = '"Hiragino Mincho ProN", "Yu Mincho", "Noto Serif CJK JP", "Noto Serif JP", serif';
export function komaMaterials(side, style, faces, rot) {
  const pal = (PIECE_STYLES[style] || PIECE_STYLES.classic)[side];
  const w = 256, h = Math.round(256 * KL / KW), c = cv(w, h), x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, w, h); g.addColorStop(0, pal.face[0]); g.addColorStop(0.5, pal.face[1]); g.addColorStop(1, pal.face[2]);
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  for (let k = 0; k < 26; k++) {                                         // fine straight grain along the piece
    const xx = hash(k, side * 7 + 1) * w, a = 0.03 + hash(k, 5) * 0.06;
    x.strokeStyle = side === 1 && style === 'classic' ? `rgba(255,220,160,${a})` : `rgba(110,70,20,${a * 1.2})`; x.lineWidth = 0.8 + hash(k, 6) * 2;
    x.beginPath(); x.moveTo(xx, 0); x.bezierCurveTo(xx + 6, h * 0.3, xx - 6, h * 0.7, xx + 3, h); x.stroke();
  }
  const en = faces !== 'jp', ch = en ? (side === 1 ? 'B' : 'W') : side === 1 ? '歩' : 'と';
  x.save(); x.translate(w / 2, h * 0.6); if (rot) x.rotate(Math.PI);
  x.textAlign = 'center'; x.textBaseline = 'middle';
  const fs = en ? 150 : side === 1 ? 118 : 130;
  x.font = en ? `700 ${fs}px "Cormorant Garamond", Georgia, serif` : `700 ${fs}px ${FONT_JP}`;
  x.fillStyle = 'rgba(0,0,0,0.45)'; x.fillText(ch, 2, 4);                // carved: a shadow inside the cut, a light lip above it
  x.fillStyle = 'rgba(255,255,255,0.18)'; x.fillText(ch, -1.5, -2);
  x.fillStyle = pal.ink; x.fillText(ch, 0, 0);
  x.restore();
  const lac = style === 'lacquer';
  const top = new THREE.MeshPhysicalMaterial({ map: texOf(c), roughness: lac ? 0.22 : 0.42, metalness: 0, clearcoat: lac ? 0.9 : 0.35, clearcoatRoughness: lac ? 0.08 : 0.3 });
  const sc = new THREE.Color(pal.face[1]).lerp(new THREE.Color(pal.side), 0.35);
  const sideM = new THREE.MeshPhysicalMaterial({ color: sc, roughness: lac ? 0.25 : 0.5, clearcoat: lac ? 0.8 : 0.2, clearcoatRoughness: 0.2 });
  return [top, sideM];
}

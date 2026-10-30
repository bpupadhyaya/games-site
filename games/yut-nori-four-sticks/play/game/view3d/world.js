// Yut Nori 3D world (procedural: canvas textures + analytic geometry, no bitmaps). Units: centimetres, y up.
// A Seollal evening in a hanok room: the warm oiled-paper (jangpan-ji) ondol floor, the hanji game board (mal-pan) on its indigo
// cloth, black-lacquer trays for the tokens (mal), a quilted silk cushion to throw the four half-round sticks (yut) onto, lattice
// paper doors glowing with moonlight behind, a brass bowl of tangerines. The board's local art space (layout.js, 720 x 1560 units)
// maps linearly onto the floor: x = (lx - 360) * U, z = (ly - 692) * U.
import * as THREE from '../vendor3d/three.js';
import { slab, lathe } from '../vendor3d/board3d.js';
import { paintBoardTop } from '../src/art.js';
import { horse, TEAMS } from '../src/pieces.js';
import { TRAY } from '../src/layout.js';

export const U = 0.075;                       // cm per local board unit (track side 544 units = 40.8 cm)
export const CLOTH_H = 0.5;                   // the board cloth's thickness: tokens stand on y = CLOTH_H
export const TOK_R = 2.35, TOK_H = 1.25;      // token (mal): 4.7 cm across, 1.25 cm thick
export const TRAY_TOP = 0.75;                 // the inside floor of a lacquer tray
export const STICK = { L: 16, W: 3.1, H: 1.35 };   // one yut stick: 16 cm long, 3.1 cm wide, 1.35 cm thick (a split half-round branch)
export const lx2x = (x) => (x - 360) * U, ly2z = (y) => (y - 692) * U;
export const x2lx = (x) => x / U + 360, z2ly = (z) => z / U + 692;
export const BACK_Z = -78;                    // the lattice door wall

const TAU = Math.PI * 2;
function lcg(seed) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }
export const canvas = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const tex = (c, srgb = true, rep) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); } return t; };

export function radialTex(rgb = '0,0,0', a = 1, inner = 0) {
  const c = canvas(128), x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 64 * inner, 64, 64, 64);
  g.addColorStop(0, `rgba(${rgb},${inner ? 0 : a})`); if (inner) g.addColorStop(Math.min(0.95, inner + 0.12), `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`);
  x.fillStyle = g; x.fillRect(0, 0, 128, 128); return tex(c);
}

// ---- floor: jangpan-ji, sheets of oiled mulberry paper, amber and glossy, burnished darker along the overlapping seams --------------
function floorCanvas(size) {
  const c = canvas(size), x = c.getContext('2d'), r = lcg(5), k = size / 1024;
  x.fillStyle = '#a06d30'; x.fillRect(0, 0, size, size);
  // the texture covers 120 x 120 cm: a 3 x 2 grid of 40 x 60 cm sheets, offset per row like laid paper
  const sw = size / 3, sh = size / 2;
  for (let j = 0; j < 2; j++) for (let i = -1; i < 4; i++) {
    const x0 = i * sw + (j % 2 ? sw / 2 : 0), y0 = j * sh, tone = r();
    const g = x.createLinearGradient(x0, y0, x0 + sw, y0 + sh);
    g.addColorStop(0, `rgb(${168 + tone * 18},${110 + tone * 14},${44 + tone * 10})`); g.addColorStop(0.55, `rgb(${180 + tone * 14},${121 + tone * 12},${52 + tone * 8})`); g.addColorStop(1, `rgb(${158 + tone * 16},${102 + tone * 12},${40 + tone * 8})`);
    x.fillStyle = g; x.fillRect(x0, y0, sw, sh);
    // mottling: oil soaked in unevenly
    for (let m = 0; m < 26; m++) {
      const mx = x0 + r() * sw, my = y0 + r() * sh, mr = (20 + r() * 90) * k, mg = x.createRadialGradient(mx, my, 0, mx, my, mr), dark = r() < 0.55;
      mg.addColorStop(0, dark ? 'rgba(120,64,18,0.10)' : 'rgba(255,214,140,0.08)'); mg.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = mg; x.fillRect(mx - mr, my - mr, mr * 2, mr * 2);
    }
    // the seam: a slightly raised overlapping edge, darker where oil pooled, with a thin light ridge
    x.strokeStyle = 'rgba(110,58,16,0.45)'; x.lineWidth = 5 * k; x.strokeRect(x0 + 1, y0 + 1, sw - 2, sh - 2);
    x.strokeStyle = 'rgba(255,220,160,0.18)'; x.lineWidth = 1.5 * k; x.strokeRect(x0 + 5 * k, y0 + 5 * k, sw - 10 * k, sh - 10 * k);
  }
  // mulberry fibres
  for (let f = 0; f < 5200; f++) {
    const fx = r() * size, fy = r() * size, a = r() * TAU, l = (3 + r() * 16) * k;
    x.strokeStyle = r() < 0.5 ? 'rgba(255,226,170,0.10)' : 'rgba(90,46,10,0.10)'; x.lineWidth = (0.5 + r()) * k;
    x.beginPath(); x.moveTo(fx, fy); x.quadraticCurveTo(fx + Math.cos(a + 0.6) * l * 0.5, fy + Math.sin(a + 0.6) * l * 0.5, fx + Math.cos(a) * l, fy + Math.sin(a) * l); x.stroke();
  }
  return c;
}
export function buildFloor(scene, quality = 1) {
  const m = new THREE.MeshPhysicalMaterial({ map: tex(floorCanvas(quality ? 1024 : 512), true, [10, 10]), roughness: 0.42, clearcoat: 0.55, clearcoatRoughness: 0.28, envMapIntensity: 0.6 });
  const g = new THREE.PlaneGeometry(1200, 1200); g.rotateX(-Math.PI / 2);
  const floor = new THREE.Mesh(g, m); floor.receiveShadow = true; scene.add(floor);
  return floor;
}

// ---- the board: the 2D art's cloth, paper and ink, painted at high resolution onto a 50 cm square slab -------------------------
export function buildBoard(texSize = 2048) {
  const c = canvas(texSize), x = c.getContext('2d'), k = texSize / 668;
  x.scale(k, k); x.translate(-26, -370); paintBoardTop(x);
  const top = tex(c); top.anisotropy = 12;
  const g = slab(668 * U, 668 * U, CLOTH_H, 26 * U, 0.18, { seg: 2 });
  const mat = new THREE.MeshStandardMaterial({ map: top, roughness: 0.86, metalness: 0 });
  const mesh = new THREE.Mesh(g, mat); mesh.receiveShadow = true; mesh.castShadow = true;
  mesh.position.set(lx2x(360), 0, ly2z(704));
  mesh.userData.dispose = () => { g.dispose(); mat.dispose(); top.dispose(); };
  return mesh;
}

// ---- black lacquer trays (waiting / home), one pair per team, red lacquer inside -----------------------------------------------
export function buildTrays() {
  const grp = new THREE.Group();
  const outer = new THREE.MeshPhysicalMaterial({ color: 0x1a110c, roughness: 0.32, clearcoat: 1, clearcoatRoughness: 0.18 });
  const inner = new THREE.MeshPhysicalMaterial({ color: 0x4a120c, roughness: 0.38, clearcoat: 0.9, clearcoatRoughness: 0.25 });
  for (const T of TRAY) {
    const a = T.wait(0);
    for (const [x0, x1] of [[a.x, T.wait(3).x], [T.home(0).x, T.home(3).x]]) {
      const w = (x1 - x0 + 70) * U, d = 66 * U;
      const o = new THREE.Mesh(slab(w, d, 0.65, 2.3, 0.2), outer); o.castShadow = true; o.receiveShadow = true;
      const i = new THREE.Mesh(slab(w - 0.9, d - 0.9, 0.1, 1.9, 0.04, { bottom: false }), inner); i.position.y = 0.65; i.receiveShadow = true;
      const rim = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rrPath(w / 2 - 0.3, d / 2 - 0.3, 2.0, 0.85), true), 80, 0.32, 8, true), outer); rim.castShadow = true;
      const t = new THREE.Group(); t.add(o, i, rim); t.position.set(lx2x((x0 + x1) / 2), 0, ly2z(a.y)); grp.add(t);
    }
  }
  return grp;
}

// ---- tokens (mal): lacquered wooden pucks, the team colour, a gold rim and an inlaid horse on top ----------------------------------
function tokenTopCanvas(team) {
  const T = TEAMS[team], c = canvas(256), x = c.getContext('2d'), cx = 128;
  const g = x.createRadialGradient(cx - 40, cx - 40, 8, cx, cx, 130); g.addColorStop(0, T.top[0]); g.addColorStop(0.6, T.top[1]); g.addColorStop(1, T.top[2]);
  x.fillStyle = g; x.fillRect(0, 0, 256, 256);
  x.strokeStyle = '#d9b45a'; x.lineWidth = 9; x.beginPath(); x.arc(cx, cx, 112, 0, TAU); x.stroke();
  x.strokeStyle = 'rgba(0,0,0,0.35)'; x.lineWidth = 3; x.beginPath(); x.arc(cx, cx, 100, 0, TAU); x.stroke();
  for (const [dx, dy, col] of [[2.5, 3, 'rgba(0,0,0,0.5)'], [0, 0, '#e6c46a']]) {
    x.save(); x.translate(cx + dx, cx + dy); x.scale(1.45, 1.45); x.translate(-60, -52); x.fillStyle = col; horse(x); x.fill(); x.restore();
  }
  x.save(); x.translate(cx, cx); x.scale(1.45, 1.45); x.translate(-60, -52); x.fillStyle = T.top[2]; x.beginPath(); x.arc(63, 40, 2.8, 0, TAU); x.fill(); x.restore();
  return c;
}
export function tokenKit() {
  const prof = [[0, 0], [TOK_R - 0.3, 0], [TOK_R - 0.05, 0.12], [TOK_R, 0.35], [TOK_R, TOK_H - 0.32], [TOK_R - 0.08, TOK_H - 0.1], [TOK_R - 0.3, TOK_H], [0, TOK_H]];
  const body = lathe(prof, 40);
  const topG = new THREE.CircleGeometry(TOK_R - 0.28, 40); topG.rotateX(-Math.PI / 2); topG.translate(0, TOK_H + 0.005, 0);
  const mats = TEAMS.map((T, team) => ({
    body: new THREE.MeshPhysicalMaterial({ color: new THREE.Color(T.top[2]).lerp(new THREE.Color(T.top[1]), 0.5), roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.12 }),
    top: new THREE.MeshPhysicalMaterial({ map: tex(tokenTopCanvas(team)), roughness: 0.34, clearcoat: 1, clearcoatRoughness: 0.1 }),
  }));
  const make = (team) => {
    const g = new THREE.Group(), b = new THREE.Mesh(body, mats[team].body), t = new THREE.Mesh(topG, mats[team].top);
    b.castShadow = true; b.receiveShadow = true; t.receiveShadow = true; g.add(b, t); g.userData.team = team; return g;
  };
  return { make, mats };
}

// ---- yut sticks: a half-round branch split lengthwise. The flat face (pale heartwood, three carved grooves; the back-do stick also
// carries a red mark) and the round back (darker, the bark shaved off) get their own material groups. ------------------------------
function woodStrip(w, h, base, dark, seed, grooves, mark) {
  const c = canvas(w, h), x = c.getContext('2d'), r = lcg(seed);
  const g = x.createLinearGradient(0, 0, w, 0); g.addColorStop(0, dark[0]); g.addColorStop(0.5, base); g.addColorStop(1, dark[0]);
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  // growth lines run along the stick; they wander slowly and vary in strength, never ruler-straight
  for (let i = 0; i < 26; i++) {
    let px = r() * w; const a = 0.05 + r() * 0.13, lw = 0.6 + r() * 1.8, ph = r() * TAU, f = 0.004 + r() * 0.01;
    x.strokeStyle = `rgba(${dark[1]},${a})`; x.lineWidth = lw; x.beginPath();
    for (let y = 0; y <= h; y += 8) { const xx = px + Math.sin(y * f + ph) * (3 + r() * 0.6) + Math.sin(y * f * 3.1 + ph) * 1.2; y ? x.lineTo(xx, y) : x.moveTo(xx, y); }
    x.stroke();
  }
  for (let i = 0; i < 900; i++) { x.fillStyle = r() < 0.5 ? `rgba(${dark[1]},0.12)` : 'rgba(255,240,210,0.07)'; x.fillRect(r() * w, r() * h, 0.8, 2 + r() * 7); }   // pores
  if (grooves) {
    for (const yy of [0.33, 0.5, 0.67]) {
      x.strokeStyle = 'rgba(70,38,12,0.62)'; x.lineWidth = w * 0.05; x.lineCap = 'round'; x.beginPath(); x.moveTo(w * 0.16, h * yy - w * 0.06); x.lineTo(w * 0.84, h * yy + w * 0.06); x.stroke();
      x.strokeStyle = 'rgba(255,236,200,0.25)'; x.lineWidth = w * 0.015; x.beginPath(); x.moveTo(w * 0.16, h * yy - w * 0.06 + w * 0.035); x.lineTo(w * 0.84, h * yy + w * 0.06 + w * 0.035); x.stroke();
    }
  }
  if (mark) { x.strokeStyle = 'rgba(176,34,24,0.92)'; x.lineWidth = w * 0.1; x.lineCap = 'round'; x.beginPath(); x.moveTo(w * 0.22, h * 0.09); x.lineTo(w * 0.78, h * 0.2); x.moveTo(w * 0.78, h * 0.09); x.lineTo(w * 0.22, h * 0.2); x.stroke(); }
  return c;
}
function stickGeometry() {
  const { L, W, H } = STICK, sh = new THREE.Shape(), n = 18;
  sh.moveTo(-W / 2, 0);
  for (let i = 1; i < n; i++) { const a = Math.PI + (i / n) * Math.PI; sh.lineTo(Math.cos(a) * W / 2, Math.sin(a) * H); }   // the round back (y < 0)
  sh.lineTo(W / 2, 0); sh.lineTo(-W / 2, 0);
  const bev = 0.38;
  let g = new THREE.ExtrudeGeometry(sh, { depth: L - 2 * bev, bevelEnabled: true, bevelThickness: bev, bevelSize: 0.22, bevelSegments: 4, curveSegments: 4 });
  g.translate(0, H * 0.42, -(L - 2 * bev) / 2);                 // centre: the flat face is at y = +0.42 H, the round back reaches -0.58 H
  g = g.index ? g.toNonIndexed() : g; g.computeVertexNormals();
  // regroup the triangles: flat face (normal up) -> group 0, everything else -> group 1; UVs: across x / along z
  const P = g.attributes.position, N = g.attributes.normal, tri = P.count / 3, flat = [], other = [];
  for (let t = 0; t < tri; t++) { let ny = 0; for (let v = 0; v < 3; v++) ny += N.getY(t * 3 + v); (ny / 3 > 0.75 ? flat : other).push(t); }
  const pos = [], nor = [], uv = [], push = (t, isFlat) => {
    for (let v = 0; v < 3; v++) {
      const i = t * 3 + v, x = P.getX(i), y = P.getY(i), z = P.getZ(i);
      pos.push(x, y, z); nor.push(N.getX(i), N.getY(i), N.getZ(i));
      uv.push(isFlat ? x / (W + 0.5) + 0.5 : (Math.atan2(y - H * 0.42, x) / Math.PI + 1) % 1, z / L + 0.5);
    }
  };
  flat.forEach((t) => push(t, true)); other.forEach((t) => push(t, false));
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  out.addGroup(0, flat.length * 3, 0); out.addGroup(flat.length * 3, other.length * 3, 1);
  out.computeBoundingSphere(); g.dispose();
  return out;
}
export function stickKit() {
  const geo = stickGeometry();
  const face = (mark) => new THREE.MeshPhysicalMaterial({ map: tex(woodStrip(128, 640, '#ead6aa', ['#c9a970', '120,72,28'], mark ? 17 : 9, true, mark)), roughness: 0.55, clearcoat: 0.35, clearcoatRoughness: 0.5 });
  const back = new THREE.MeshPhysicalMaterial({ map: tex(woodStrip(128, 640, '#8a5a30', ['#4a2c14', '40,20,6'], 23, false, false)), roughness: 0.5, clearcoat: 0.45, clearcoatRoughness: 0.4 });
  const plain = face(false), marked = face(true);
  return {
    make(i) { const m = new THREE.Mesh(geo, [i === 0 ? marked : plain, back]); m.castShadow = true; m.receiveShadow = true; return m; },
  };
}

// ---- the throwing cushion: a quilted crimson silk blanket folded square, cloud-pattern damask, gold piping ---------------------------
function silkCanvas(size) {
  const c = canvas(size), x = c.getContext('2d'), r = lcg(41), k = size / 512;
  x.fillStyle = '#86202a'; x.fillRect(0, 0, size, size);
  // woven sheen: fine twill, a whole number of lines per tile so the repeat has no seam
  x.strokeStyle = 'rgba(255,190,170,0.05)'; x.lineWidth = 1 * k;
  for (let i = -size; i < size; i += size / 128) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + size, size); x.stroke(); }
  // tonal cloud motifs (gureum-mun), woven a little lighter than the ground
  const cloud = (cx, cy, s) => {
    x.beginPath();
    for (const [dx, dy, rr] of [[0, 0, 1], [1.1, -0.35, 0.8], [2.0, 0.1, 0.62], [-1.0, -0.2, 0.7]]) x.arc(cx + dx * 14 * s, cy + dy * 14 * s, rr * 14 * s, 0, TAU);
    x.fill();
    x.beginPath(); x.moveTo(cx - 26 * s, cy + 12 * s); x.bezierCurveTo(cx - 6 * s, cy + 22 * s, cx + 20 * s, cy + 22 * s, cx + 40 * s, cy + 12 * s); x.stroke();
  };
  x.fillStyle = 'rgba(230,120,110,0.12)'; x.strokeStyle = 'rgba(230,120,110,0.16)'; x.lineWidth = 3 * k;
  for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) cloud((i + (j % 2) * 0.5) * 128 * k + 30 * k, j * 128 * k + 60 * k, k * 0.95);   void r;
  return c;
}
export const CUSHION = { w: 68, d: 28, h: 3.2 };
export function buildCushion() {
  const g = new THREE.Group(), { w, d, h } = CUSHION;
  const silk = new THREE.MeshPhysicalMaterial({ map: tex(silkCanvas(512), true, [3, 1.25]), roughness: 0.48, sheen: 1, sheenRoughness: 0.4, sheenColor: new THREE.Color(0xffb0a0) });
  const body = new THREE.Mesh(slab(w, d, h, 3.2, 1.45, { seg: 4 }), silk); body.castShadow = true; body.receiveShadow = true; g.add(body);
  // gold piping round the top edge and a row of quilting stitches
  const piping = new THREE.MeshPhysicalMaterial({ color: 0xc89a46, roughness: 0.35, metalness: 0.7 });
  const rr = 3.2, hw = w / 2 - 1.2, hd = d / 2 - 1.2;
  const curve = new THREE.CatmullRomCurve3(rrPath(hw, hd, rr - 1, h - 0.25), true);
  const pipe = new THREE.Mesh(new THREE.TubeGeometry(curve, 120, 0.22, 6, true), piping); pipe.castShadow = true; g.add(pipe);
  const stitch = new THREE.MeshStandardMaterial({ color: 0xe0b878, roughness: 0.6 });
  const sc = new THREE.CatmullRomCurve3(rrPath(hw - 2.8, hd - 2.8, rr - 1.6, h + 0.02), true);
  const st = new THREE.Mesh(new THREE.TubeGeometry(sc, 160, 0.06, 4, true), stitch); g.add(st);
  return g;
}
function rrPath(hw, hd, r, y) {
  const out = [], seg = 6, corners = [[hw - r, hd - r, 0], [-(hw - r), hd - r, 0.5], [-(hw - r), -(hd - r), 1], [hw - r, -(hd - r), 1.5]];
  for (const [cx, cz, a0] of corners) for (let i = 0; i <= seg; i++) { const a = (a0 + (i / seg) * 0.5) * Math.PI; out.push(new THREE.Vector3(cx + Math.cos(a) * r, y, cz + Math.sin(a) * r)); }
  return out;
}

// ---- the room behind: a low wooden sill and lattice paper doors (changho) lit by the moon outside -----------------------------------
function latticeCanvas(w, h) {
  const c = canvas(w, h), x = c.getContext('2d'), r = lcg(77);
  const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#a9b6cf'); g.addColorStop(0.6, '#c8cbd2'); g.addColorStop(1, '#d9cdb4');
  x.fillStyle = g; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 1600; i++) { x.strokeStyle = r() < 0.5 ? 'rgba(255,255,255,0.12)' : 'rgba(80,80,90,0.06)'; x.lineWidth = 0.7; const fx = r() * w, fy = r() * h; x.beginPath(); x.moveTo(fx, fy); x.lineTo(fx + (r() - 0.5) * 18, fy + (r() - 0.5) * 18); x.stroke(); }
  // the lattice (ttisal): a grid of thin dark bars, denser bands near the top and bottom
  x.fillStyle = '#2a1a10';
  const cols = 6, cw = w / cols; for (let i = 0; i <= cols; i++) x.fillRect(i * cw - 4, 0, 8, h);
  const rowsY = [0, 0.06, 0.12, 0.3, 0.48, 0.66, 0.84, 0.9, 0.96, 1]; for (const yy of rowsY) x.fillRect(0, yy * h - 4, w, 8);
  x.fillStyle = '#21140b'; x.fillRect(0, 0, 18, h); x.fillRect(w - 18, 0, 18, h); x.fillRect(0, 0, w, 18); x.fillRect(0, h - 18, w, 18);
  return c;
}
export function buildRoom(scene) {
  const g = new THREE.Group();
  const paper = tex(latticeCanvas(512, 768));
  const doorM = new THREE.MeshStandardMaterial({ map: paper, emissive: 0xffffff, emissiveMap: paper, emissiveIntensity: 0.55, roughness: 0.9 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x2b1b12, roughness: 0.7 });
  for (let i = -3; i <= 2; i++) { const d = new THREE.Mesh(new THREE.PlaneGeometry(54, 88), doorM); d.position.set(i * 56 + 28, 18 + 44, BACK_Z); g.add(d); }
  const sill = new THREE.Mesh(new THREE.BoxGeometry(400, 18, 10), dark); sill.position.set(0, 9, BACK_Z + 1); sill.receiveShadow = true; g.add(sill);
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(400, 10, 12), dark); lintel.position.set(0, 18 + 88 + 5, BACK_Z + 1); g.add(lintel);
  for (const px of [-196, 196]) { const post = new THREE.Mesh(new THREE.BoxGeometry(14, 140, 14), dark); post.position.set(px, 70, BACK_Z + 4); g.add(post); }
  scene.add(g);
  return g;
}

// ---- a brass bowl (yugi) of tangerines ---------------------------------------------------------------------------------------
export function buildBowl() {
  const g = new THREE.Group();
  const brass = new THREE.MeshPhysicalMaterial({ color: 0xc9a050, metalness: 0.92, roughness: 0.3, clearcoat: 0.3 });
  const prof = [[0, 0.2], [4.6, 0.2], [4.8, 0], [5.6, 0], [5.9, 0.5], [8.4, 2.6], [10.6, 6.0], [11.1, 7.4], [10.85, 7.6], [10.2, 6.4], [8.0, 3.2], [5.4, 1.3], [0, 1.1]];
  const bowl = new THREE.Mesh(lathe(prof, 56), brass); bowl.castShadow = true; bowl.receiveShadow = true; g.add(bowl);
  const peel = new THREE.MeshStandardMaterial({ color: 0xf08a1c, roughness: 0.55 });
  const leaf = new THREE.MeshStandardMaterial({ color: 0x2f5a24, roughness: 0.6 });
  const sp = new THREE.SphereGeometry(3.1, 24, 16); sp.scale(1, 0.84, 1);
  const r = lcg(3);
  for (const [x, y, z] of [[-3.2, 4.3, -1.6], [3.0, 4.2, -2.4], [0.4, 4.0, 3.1], [0.2, 8.2, -0.6], [-4.3, 4.6, 3.2]]) {
    const t = new THREE.Mesh(sp, peel); t.position.set(x, y, z); t.rotation.set(r(), r() * 6, r()); t.castShadow = true; g.add(t);
    const l = new THREE.Mesh(new THREE.SphereGeometry(0.9, 8, 6), leaf); l.scale.set(1.4, 0.25, 0.7); l.position.set(x + 0.6, y + 2.5, z); g.add(l);
  }
  return g;
}

// ---- lights: a warm lantern key from the upper left, cool moonlight from the doors behind, a soft fill -------------------------------
export function buildLights(scene) {
  const key = new THREE.DirectionalLight(0xffd29a, 1.25); key.position.set(-70, 150, 60); key.target.position.set(0, 0, 0);
  Object.assign(key.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 20, far: 400 }); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02; key.shadow.radius = 4;
  const hemi = new THREE.HemisphereLight(0x8a98c0, 0x5a3418, 0.32);
  // the lantern overhead: a warm pool of light on the board and the cushion, the room falling off into dusk around it
  const pool = new THREE.SpotLight(0xffcf8a, 5.2, 0, 0.62, 0.85, 0); pool.position.set(-25, 190, 55); pool.target.position.set(4, 0, 14);
  scene.add(pool, pool.target);
  const moon = new THREE.DirectionalLight(0x9db4ff, 0.75); moon.position.set(30, 60, -160);
  const lamp = new THREE.PointLight(0xffa860, 1.2, 0, 0); lamp.position.set(70, 60, -10);
  scene.add(key, key.target, hemi, moon, lamp);
  return { key, hemi, moon, lamp, pool };
}

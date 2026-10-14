// Cymbergaj 3D models: the lacquered walnut table with goal slots, brass paddles on felt, the brass coin puck, and the lounge
// around it. Pure construction (no state); used by the presenter and by the icon page. Units are METRES: one world unit of the
// simulation (the table is 420 x 800 units) is S = 1.2 mm, so the playing surface is 0.50 x 0.96 m, a paddle is 10 cm across
// and the puck 5.8 cm: the real size of a tabletop air-puck game, which is also what the hand holding it needs.
import { THREE, board3d as B } from '../vendor3d/index.js';
import { HW, HH, GOAL_HW, R_PAD, R_PUCK, R_POST, CORNER, POCKET } from '../src/sim.js';
import { FRAME, FRAME_END, paintSurface } from '../src/art.js';

export const S = 0.0012;
export const OW = HW + FRAME, OH = HH + FRAME_END;
export const RAIL_H = 0.034, FRAME_H = 0.019, FLOOR_Y = -0.78;
const TAU = Math.PI * 2;
const hash = (n) => { let h = (n * 374761393 + 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
export const tex = (c, { repeat = null, srgb = true, aniso = 8 } = {}) => {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  t.anisotropy = aniso; return t;
};
const phys = (color, o = {}) => new THREE.MeshPhysicalMaterial({ color, ...o });
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, ...o });
const shadowy = (m, cast = true, recv = true) => { m.castShadow = cast; m.receiveShadow = recv; return m; };

// ------------------------------------------------------------------------------------------------ textures
let TX = null;
export function textures() {
  if (TX) return TX;
  // the lacquered playing surface: the 2D painting, at 2 px per world unit
  const sc = 2, surf = canvas(HW * 2 * sc, HH * 2 * sc), sx = surf.getContext('2d');
  sx.translate(HW * sc, HH * sc); sx.scale(sc, sc); paintSurface(sx);
  // surface relief map: air holes read as tiny dimples under the clearcoat
  const bump = canvas(HW * 2, HH * 2), bx = bump.getContext('2d');
  bx.fillStyle = '#808080'; bx.fillRect(0, 0, bump.width, bump.height);
  bx.fillStyle = '#4c4c4c';
  for (let y = 20; y < HH * 2; y += 24) for (let x = 20; x < HW * 2; x += 24) { bx.beginPath(); bx.arc(x, y, 1.9, 0, TAU); bx.fill(); }
  // parquet floor (herringbone-ish planks)
  const fl = canvas(1024, 1024), fx = fl.getContext('2d');
  fx.fillStyle = '#2a1608'; fx.fillRect(0, 0, 1024, 1024);
  const PW = 128, PH = 32;
  for (let row = 0; row < 1024 / PH; row++) for (let col = -1; col < 1024 / PW + 1; col++) {
    const off = (row % 2) * PW * 0.5, x = col * PW + off, y = row * PH, k = hash(row * 31 + col + 7);
    const l = 20 + k * 14;
    fx.fillStyle = `hsl(${20 + k * 8},${34 + k * 10}%,${l * 0.62}%)`; fx.fillRect(x + 1, y + 1, PW - 2, PH - 2);
    fx.fillStyle = 'rgba(255,200,130,0.07)'; fx.fillRect(x + 1, y + 1, PW - 2, 3);
    fx.strokeStyle = 'rgba(0,0,0,0.12)'; fx.lineWidth = 1;
    for (let g = 0; g < 4; g++) { const gy = y + 5 + g * 6 + k * 3; fx.beginPath(); fx.moveTo(x + 2, gy); fx.lineTo(x + PW - 2, gy + (k - 0.5) * 3); fx.stroke(); }
  }
  // wall: oxblood-teal panelling with a cream picture rail and a quilted upper wallpaper
  const wl = canvas(1024, 1024), wx = wl.getContext('2d');
  const wg = wx.createLinearGradient(0, 0, 0, 1024);
  wg.addColorStop(0, '#16302f'); wg.addColorStop(0.5, '#1c403c'); wg.addColorStop(0.54, '#2a1a10'); wg.addColorStop(1, '#3a2012');
  wx.fillStyle = wg; wx.fillRect(0, 0, 1024, 1024);
  wx.strokeStyle = 'rgba(233,183,74,0.10)'; wx.lineWidth = 2;
  for (let y = -40; y < 560; y += 64) for (let x = -40; x < 1100; x += 64) {
    wx.beginPath(); wx.moveTo(x + 32, y); wx.lineTo(x + 64, y + 32); wx.lineTo(x + 32, y + 64); wx.lineTo(x, y + 32); wx.closePath(); wx.stroke();
    wx.fillStyle = 'rgba(233,183,74,0.12)'; wx.beginPath(); wx.arc(x + 32, y + 32, 3, 0, TAU); wx.fill();
  }
  wx.fillStyle = '#d9a73a'; wx.fillRect(0, 548, 1024, 8); wx.fillStyle = '#7a5410'; wx.fillRect(0, 556, 1024, 5);
  for (let x = 0; x < 1024; x += 128) {
    wx.fillStyle = 'rgba(0,0,0,0.25)'; wx.fillRect(x + 8, 590, 112, 380);
    const g2 = wx.createLinearGradient(x, 590, x + 128, 970); g2.addColorStop(0, '#5a3418'); g2.addColorStop(1, '#2e180a');
    wx.fillStyle = g2; wx.fillRect(x + 12, 594, 104, 372);
    wx.strokeStyle = 'rgba(255,215,160,0.18)'; wx.lineWidth = 2; wx.strokeRect(x + 22, 604, 84, 352);
  }
  // softly lit poster (abstract folk motif, no text)
  const po = canvas(256, 340), px = po.getContext('2d');
  px.fillStyle = '#f2e3bf'; px.fillRect(0, 0, 256, 340);
  px.fillStyle = '#c8372d'; px.beginPath(); px.arc(128, 150, 74, 0, TAU); px.fill();
  px.fillStyle = '#1f7a78'; for (let i = 0; i < 8; i++) { px.save(); px.translate(128, 150); px.rotate((i / 8) * TAU); px.beginPath(); px.ellipse(0, -52, 14, 30, 0, 0, TAU); px.fill(); px.restore(); }
  px.fillStyle = '#e9b74a'; px.beginPath(); px.arc(128, 150, 20, 0, TAU); px.fill();
  px.fillStyle = '#2b180e'; px.fillRect(34, 268, 188, 10); px.fillRect(70, 292, 116, 8);
  // puck face: rosette in relief
  const pf = canvas(512, 512), pfx = pf.getContext('2d');
  const pg = pfx.createRadialGradient(200, 190, 20, 256, 256, 280);
  pg.addColorStop(0, '#fff2b0'); pg.addColorStop(0.5, '#f1c14e'); pg.addColorStop(1, '#a8741a');
  pfx.fillStyle = pg; pfx.fillRect(0, 0, 512, 512);
  pfx.strokeStyle = 'rgba(255,248,200,0.9)'; pfx.lineWidth = 10; pfx.beginPath(); pfx.arc(256, 256, 218, 0, TAU); pfx.stroke();
  pfx.strokeStyle = 'rgba(110,70,10,0.8)'; pfx.lineWidth = 6; pfx.beginPath(); pfx.arc(256, 256, 236, 0, TAU); pfx.stroke();
  pfx.translate(256, 256); pfx.fillStyle = 'rgba(120,78,12,0.65)';
  for (let i = 0; i < 6; i++) { pfx.save(); pfx.rotate((i / 6) * TAU); pfx.beginPath(); pfx.moveTo(0, 0); pfx.quadraticCurveTo(70, 60, 0, 150); pfx.quadraticCurveTo(-70, 60, 0, 0); pfx.fill(); pfx.restore(); }
  pfx.fillStyle = 'rgba(255,245,190,0.95)'; pfx.beginPath(); pfx.arc(0, 0, 34, 0, TAU); pfx.fill();
  const pb = canvas(512, 512), pbx = pb.getContext('2d');
  pbx.fillStyle = '#808080'; pbx.fillRect(0, 0, 512, 512); pbx.translate(256, 256);
  pbx.strokeStyle = '#d8d8d8'; pbx.lineWidth = 10; pbx.beginPath(); pbx.arc(0, 0, 218, 0, TAU); pbx.stroke();
  pbx.fillStyle = '#e8e8e8';
  for (let i = 0; i < 6; i++) { pbx.save(); pbx.rotate((i / 6) * TAU); pbx.beginPath(); pbx.moveTo(0, 0); pbx.quadraticCurveTo(70, 60, 0, 150); pbx.quadraticCurveTo(-70, 60, 0, 0); pbx.fill(); pbx.restore(); }
  // goal net
  const nt = canvas(256, 256), nx = nt.getContext('2d');
  nx.fillStyle = '#080301'; nx.fillRect(0, 0, 256, 256);
  nx.strokeStyle = 'rgba(233,183,74,0.55)'; nx.lineWidth = 3;
  for (let k = -256; k < 512; k += 32) { nx.beginPath(); nx.moveTo(k, 0); nx.lineTo(k + 256, 256); nx.moveTo(k + 256, 0); nx.lineTo(k, 256); nx.stroke(); }
  TX = {
    surf: tex(surf), bump: tex(bump, { srgb: false }), floor: tex(fl, { repeat: [5, 5] }), wall: tex(wl, { repeat: [3, 1] }), poster: tex(po),
    puck: tex(pf), puckBump: tex(pb, { srgb: false }), net: tex(nt, { repeat: [3, 1] }),
  };
  return TX;
}

// ------------------------------------------------------------------------------------------------ geometry helpers
function rrOutline(path, hw, hh, r, pockets) {
  // counter-clockwise rounded rectangle; pockets = true cuts the two goal slots (trapezoids) into the short sides
  path.moveTo(-hw + r, -hh);
  if (pockets) { path.lineTo(-GOAL_HW, -hh); path.lineTo(-GOAL_HW + 7, -hh - POCKET); path.lineTo(GOAL_HW - 7, -hh - POCKET); path.lineTo(GOAL_HW, -hh); }
  path.lineTo(hw - r, -hh); path.absarc(hw - r, -hh + r, r, -Math.PI / 2, 0, false);
  path.lineTo(hw, hh - r); path.absarc(hw - r, hh - r, r, 0, Math.PI / 2, false);
  if (pockets) { path.lineTo(GOAL_HW, hh); path.lineTo(GOAL_HW - 7, hh + POCKET); path.lineTo(-GOAL_HW + 7, hh + POCKET); path.lineTo(-GOAL_HW, hh); }
  path.lineTo(-hw + r, hh); path.absarc(-hw + r, hh - r, r, Math.PI / 2, Math.PI, false);
  path.lineTo(-hw, -hh + r); path.absarc(-hw + r, -hh + r, r, Math.PI, Math.PI * 1.5, false);
  return path;
}
const scaleGeo = (g) => { g.scale(S, S, S); return g; };
// extrude a flat shape (units: world units) upward from y0 by `depth` metres; shape y becomes scene +Z
function extrude(shape, depth, y0, bevel = 0.0015) {
  const g = new THREE.ExtrudeGeometry(shape, { depth: depth / S - bevel * 2 / S, bevelEnabled: bevel > 0, bevelSize: bevel / S, bevelThickness: bevel / S, bevelSegments: 3, curveSegments: 16 });
  g.scale(S, S, S); g.rotateX(Math.PI / 2); g.translate(0, y0 + depth - bevel, 0);
  return g;
}

// ------------------------------------------------------------------------------------------------ the table
export function buildTable() {
  const t = textures(), g = new THREE.Group(); g.name = 'table';
  const walnut = B.material('wood', { color: '#5a2f14', color2: '#2c1508', seed: 11, repeat: [1.5, 2.5], roughness: 0.4 });
  const walnutDark = B.material('darkWood', { color: '#4a2410', color2: '#2a1206', seed: 5, repeat: [1, 3], roughness: 0.36 });
  const brass = B.material('brass', { roughness: 0.2 }); brass.metalness = 1; brass.envMapIntensity = 1.9;
  const lacquer = phys('#5e0b09', { roughness: 0.5, metalness: 0.0, clearcoat: 0.6, clearcoatRoughness: 0.04, envMapIntensity: 0.14 });
  // cabinet: a ledge ring of walnut around the rail, a dark underside, so the playing surface itself stays open at y = 0
  { const sh = new THREE.Shape(); rrOutline(sh, OW, OH, 104, false);
    const h = new THREE.Path(); rrOutline(h, HW + 24, HH + 72, CORNER + 24, false); sh.holes.push(h);
    const m = shadowy(new THREE.Mesh(extrude(sh, FRAME_H + 0.12, -0.12, 0.004), walnut)); g.add(m); }
  { const under = shadowy(new THREE.Mesh(B.slab(2 * (OW - 6) * S, 2 * (OH - 6) * S, 0.1, 0.12, 0.02), walnutDark)); under.position.y = -0.006 - 0.1; g.add(under); }
  // brass inlay ring on the wooden ledge
  { const sh = new THREE.Shape(); rrOutline(sh, HW + 38, HH + 70, CORNER + 38, false);
    const h = new THREE.Path(); rrOutline(h, HW + 35.5, HH + 67.5, CORNER + 35.5, false); sh.holes.push(h);
    const m = new THREE.Mesh(extrude(sh, 0.0016, FRAME_H - 0.0004, 0), brass); m.receiveShadow = true; g.add(m); }
  // red lacquered rail with the goal slots cut in
  { const sh = new THREE.Shape(); rrOutline(sh, HW + 26, HH + 74, CORNER + 26, false);
    const h = new THREE.Path(); rrOutline(h, HW, HH, CORNER, true); sh.holes.push(h);
    const m = shadowy(new THREE.Mesh(extrude(sh, RAIL_H + 0.01, -0.01, 0.0016), lacquer)); g.add(m);
    // a bright brass line along the top edge of the inner rail
    const sh2 = new THREE.Shape(); rrOutline(sh2, HW + 1.6, HH + 1.6, CORNER + 1.6, true);
    const h2 = new THREE.Path(); rrOutline(h2, HW, HH, CORNER, true); sh2.holes.push(h2);
    const m2 = new THREE.Mesh(extrude(sh2, 0.0012, RAIL_H - 0.0006, 0), brass); g.add(m2); }
  // playing surface
  const surfMat = phys('#cfc6ae', { map: t.surf, bumpMap: t.bump, bumpScale: 0.5, roughness: 0.32, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 0.75 });
  const surf = new THREE.Mesh(new THREE.PlaneGeometry(2 * HW * S, 2 * HH * S), surfMat);
  surf.rotation.x = -Math.PI / 2; surf.position.y = 0; surf.receiveShadow = true; surf.name = 'surface'; g.add(surf);
  // goal slots: dark net floor + back, brass posts
  const netMat = new THREE.MeshStandardMaterial({ map: t.net, roughness: 0.8, metalness: 0.3, emissive: '#2a1204', emissiveIntensity: 0.5 });
  for (const e of [-1, 1]) {
    const w = (2 * GOAL_HW - 14) * S, d = POCKET * S;
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(w, d), netMat); fl.rotation.x = -Math.PI / 2; fl.position.set(0, -0.0035, e * (HH + POCKET / 2) * S); g.add(fl);
    const back = new THREE.Mesh(new THREE.PlaneGeometry(w, RAIL_H + 0.004), netMat); back.position.set(0, (RAIL_H - 0.0035) / 2, e * (HH + POCKET - 0.5) * S); if (e > 0) back.rotation.y = Math.PI; g.add(back);
    for (const px of [-GOAL_HW, GOAL_HW]) {
      const post = shadowy(B.piece([[0, 0], [(R_POST + 1.4) * S, 0], [(R_POST + 1.4) * S, RAIL_H * 0.9], [(R_POST + 0.6) * S, RAIL_H], [0, RAIL_H + 0.002]], brass, 28));
      post.position.set(px * S, -0.0035, e * HH * S); g.add(post);
    }
    // soft warm light spilling out of the slot
    const spill = new THREE.Mesh(new THREE.PlaneGeometry((2 * GOAL_HW + 60) * S, 120 * S), new THREE.MeshBasicMaterial({ color: 0xffa24a, transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false }));
    spill.rotation.x = -Math.PI / 2; spill.position.set(0, 0.0015, e * (HH - 50) * S); spill.name = e > 0 ? 'spillN' : 'spillF'; g.add(spill);
  }
  // corner studs and the two brass plates
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    const stud = shadowy(B.piece([[0, 0], [0.011, 0], [0.0125, 0.002], [0.011, 0.005], [0.006, 0.0075], [0, 0.008]], brass, 24));
    stud.position.set(sx * (OW - 26) * S, FRAME_H, sy * (OH - 26) * S); g.add(stud);
  }
  for (const sx of [-1, 1]) {
    const pl = shadowy(new THREE.Mesh(B.slab(0.016, 0.13, 0.0016, 0.007, 0.0006), brass));
    pl.position.set(sx * (HW + 46) * S, FRAME_H, 0); g.add(pl);
  }
  // turned legs with brass feet
  const legP = [[0, 0], [0.026, 0], [0.026, 0.02], [0.034, 0.035], [0.03, 0.09], [0.026, 0.26], [0.034, 0.34], [0.04, 0.38], [0.04, 0.5], [0.034, 0.6], [0.0, 0.7]];
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    const leg = shadowy(B.piece(legP.map(([r, y]) => [r, y]), walnutDark, 28)); leg.scale.y = (-0.1 - FLOOR_Y) / 0.7;
    leg.position.set(sx * (OW - 46) * S, FLOOR_Y, sy * (OH - 50) * S); g.add(leg);
    const foot = shadowy(B.piece([[0, 0], [0.03, 0], [0.032, 0.006], [0.027, 0.014], [0, 0.014]], brass, 20)); foot.position.copy(leg.position); g.add(foot);
  }
  g.userData.lacquer = lacquer;
  return g;
}

// ------------------------------------------------------------------------------------------------ paddles and puck
export const SIDE3 = [
  { felt: '#c8301f', ring: '#e8452e', knob: '#f4e4bd', glow: '#ff9a7a' },
  { felt: '#157a6e', ring: '#1f9d8e', knob: '#e6f4ea', glow: '#7ae0cc' },
];
export function buildPaddle(side) {
  const g = new THREE.Group(), c = SIDE3[side];
  const brass = B.material('brass', { roughness: 0.15, color: '#ffd978' }); brass.metalness = 1; brass.envMapIntensity = 2.2;
  const R = R_PAD * S;
  const felt = shadowy(B.piece([[0, 0], [R * 0.985, 0], [R * 0.985, 0.0032], [0, 0.0032]], B.material('felt', { color: c.felt }), 48));
  const body = shadowy(B.piece([[0, 0.0032], [R * 0.97, 0.0032], [R, 0.0046], [R, 0.0135], [R * 0.955, 0.0178], [R * 0.82, 0.0192], [R * 0.7, 0.0176], [R * 0.62, 0.0192], [R * 0.2, 0.0198], [0, 0.0198]], brass, 56));
  const enamel = shadowy(B.piece([[R * 0.64, 0.0188], [R * 0.64, 0.0201], [R * 0.8, 0.0201], [R * 0.8, 0.0188]], phys(c.ring, { roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.05 }), 56));
  const neck = shadowy(B.piece([[0, 0.0195], [0.0112, 0.0195], [0.0098, 0.03], [0.0098, 0.0345], [0, 0.0345]], brass, 24));
  const knob = shadowy(B.piece([[0, 0.032], [0.0165, 0.033], [0.0225, 0.0385], [0.0236, 0.0455], [0.0205, 0.0518], [0.0125, 0.0558], [0, 0.0568]], phys(c.knob, { roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.08 }), 36));
  const band = shadowy(B.piece([[0.0229, 0.0425], [0.0242, 0.0425], [0.0244, 0.0442], [0.0229, 0.0442]], phys(c.ring, { roughness: 0.2, clearcoat: 1 }), 36));
  g.add(felt, body, enamel, neck, knob, band);
  g.userData = { radius: R, knobR: 0.0236, knobTop: 0.0568, knobMid: 0.044 };
  return g;
}
export function buildPuck() {
  const t = textures(), g = new THREE.Group();
  const gold = B.material('brass', { color: '#ffe08c', roughness: 0.16 }); gold.metalness = 1; gold.envMapIntensity = 2.2;
  const R = R_PUCK * S, H = 0.0125;
  const body = shadowy(B.piece([[0, 0], [R * 0.95, 0], [R, 0.0012], [R, H - 0.0016], [R * 0.95, H], [0, H]], gold, 48));
  const face = new THREE.Mesh(new THREE.CircleGeometry(R * 0.93, 48), new THREE.MeshStandardMaterial({ map: t.puck, bumpMap: t.puckBump, bumpScale: 1.4, metalness: 0.9, roughness: 0.24, envMapIntensity: 1.5 }));
  face.rotation.x = -Math.PI / 2; face.position.y = H + 0.0002; face.receiveShadow = true; face.name = 'face';
  g.add(body, face); g.userData = { radius: R, height: H };
  return g;
}

export const ROOM_HALF = 4.2;
export const PATRON_SPOTS = [
  { x: -2.3, z: -2.95, seated: true }, { x: 2.3, z: -2.95, seated: true },
  { x: -0.6, z: -3.95, seated: false }, { x: 1.1, z: -3.95, seated: false },
  { x: -2.95, z: -0.6, seated: true }, { x: -2.95, z: 0.9, seated: true }, { x: 2.95, z: -0.2, seated: true }, { x: 2.95, z: 1.2, seated: true },
];
// ------------------------------------------------------------------------------------------------ the lounge around the table
// A warm retro milk-bar: herringbone floor, panelled walls with picture rail, back-bar shelves of amber and green bottles,
// glowing posters, pendant lamps over the table. All emissive and baked-looking so it stays cheap; the table is the only
// shadow caster. Returns { group, lamps, update(t) }.
export function buildLounge(opt = {}) {
  const t = textures(), g = new THREE.Group(); g.name = 'lounge';
  const ROOM = opt.room ?? ROOM_HALF, HGT = 2.55;
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM * 2 + 2, ROOM * 2 + 2), std('#ffffff', { map: t.floor, roughness: 0.42, metalness: 0.05, envMapIntensity: 0.9 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = FLOOR_Y; floor.receiveShadow = true; g.add(floor);
  { // a woven rug under the table anchors it and carries the table's shadow
    const rc = canvas(512, 768), rx = rc.getContext('2d');
    rx.fillStyle = '#2a0c0a'; rx.fillRect(0, 0, 512, 768);
    rx.strokeStyle = '#d9a73a'; rx.lineWidth = 8; rx.strokeRect(26, 26, 460, 716);
    rx.strokeStyle = '#1f7a78'; rx.lineWidth = 14; rx.strokeRect(52, 52, 408, 664);
    rx.fillStyle = '#4a120e'; rx.fillRect(74, 74, 364, 620);
    for (let y = 96; y < 690; y += 56) for (let x = 96; x < 440; x += 56) {
      rx.fillStyle = ((x + y) / 56) % 2 ? 'rgba(233,183,74,0.28)' : 'rgba(31,122,120,0.30)';
      rx.beginPath(); rx.moveTo(x + 22, y); rx.lineTo(x + 44, y + 22); rx.lineTo(x + 22, y + 44); rx.lineTo(x, y + 22); rx.closePath(); rx.fill();
    }
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 3.1), std('#ffffff', { map: tex(rc), roughness: 0.95 }));
    rug.rotation.x = -Math.PI / 2; rug.position.y = FLOOR_Y + 0.004; rug.receiveShadow = true; g.add(rug);
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 2.1), new THREE.MeshBasicMaterial({ map: haloTex(), color: 0x000000, transparent: true, opacity: 0.75, depthWrite: false }));
    sh.rotation.x = -Math.PI / 2; sh.position.y = FLOOR_Y + 0.008; g.add(sh);
  }
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(ROOM * 2 + 2, ROOM * 2 + 2), std('#2a1a12', { roughness: 0.9 }));
  ceil.rotation.x = Math.PI / 2; ceil.position.y = FLOOR_Y + HGT + 0.5; g.add(ceil);
  const wallMat = std('#ffffff', { map: t.wall, roughness: 0.75, metalness: 0.0, emissive: '#20120a', emissiveIntensity: 0.35 });
  const posterMat = new THREE.MeshBasicMaterial({ map: t.poster, color: 0xd9c9a8 });
  const frameMat = B.material('brass', { roughness: 0.3 });
  const bottleMats = [phys('#c27a1c', { roughness: 0.1, transmission: 0, clearcoat: 1, emissive: '#6a3a06', emissiveIntensity: 0.9 }),
    phys('#2f8a4a', { roughness: 0.1, clearcoat: 1, emissive: '#0c4a1c', emissiveIntensity: 0.8 }),
    phys('#d7e6ea', { roughness: 0.08, clearcoat: 1, emissive: '#5b7078', emissiveIntensity: 0.6 }),
    phys('#8a1e1a', { roughness: 0.1, clearcoat: 1, emissive: '#3c0806', emissiveIntensity: 0.8 })];
  const bottleGeo = B.lathe([[0, 0], [0.032, 0], [0.034, 0.02], [0.034, 0.17], [0.026, 0.21], [0.012, 0.25], [0.011, 0.3], [0.0125, 0.31], [0, 0.31]], 14);
  const half = ROOM;
  const walls = [
    { x: 0, z: -half, ry: 0 }, { x: half, z: 0, ry: -Math.PI / 2 }, { x: 0, z: half, ry: Math.PI }, { x: -half, z: 0, ry: Math.PI / 2 },
  ];
  walls.forEach((w, wi) => {
    const grp = new THREE.Group(); grp.position.set(w.x, FLOOR_Y, w.z); grp.rotation.y = w.ry;
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(ROOM * 2 + 2, HGT + 0.5), wallMat); wall.position.y = (HGT + 0.5) / 2; grp.add(wall);
    // back-bar: two shelves of bottles with a warm strip behind
    const shelfY = [1.05, 1.5, 1.95];
    for (const sx of [-1.35, 0, 1.35]) {
      const case_ = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.15, 0.05), std('#1a0e07', { roughness: 0.6 })); case_.position.set(sx, 1.5, 0.02); grp.add(case_);
      shelfY.forEach((y, si) => {
        const shelf = shadowy(new THREE.Mesh(new THREE.BoxGeometry(1.08, 0.025, 0.2), B.material('wood', { color: '#7a4522', seed: 3 })), false, false); shelf.position.set(sx, y, 0.12); grp.add(shelf);
        const strip = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.03), new THREE.MeshBasicMaterial({ color: 0xffc070 })); strip.position.set(sx, y + 0.34, 0.06); grp.add(strip);
        if (si < 2) for (let i = 0; i < 9; i++) {
          const k = hash(wi * 100 + si * 10 + i + Math.round(sx * 7));
          const b = new THREE.Mesh(bottleGeo, bottleMats[Math.floor(k * 4)]); b.position.set(sx - 0.45 + i * 0.11 + k * 0.01, y + 0.0125, 0.12); b.scale.set(1, 0.7 + hash(i + si * 5 + wi) * 0.3, 1); grp.add(b);
        }
      });
    }
    // framed posters between the cases
    for (const sx of [-2.1, 2.1]) {
      const fr = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.66, 0.04), frameMat); fr.position.set(sx, 1.55, 0.03); grp.add(fr);
      const po = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.57), posterMat); po.position.set(sx, 1.55, 0.056); grp.add(po);
    }
    // bar counter along the wall
    const bar = shadowy(new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.95, 0.55), B.material('darkWood', { color: '#4a2410', seed: 7, repeat: [3, 1] })), false, false);
    bar.position.set(0, 0.475, 0.62); grp.add(bar);
    const top = new THREE.Mesh(new THREE.BoxGeometry(5.3, 0.045, 0.62), phys('#2b1608', { roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.05 })); top.position.set(0, 0.97, 0.62); grp.add(top);
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 5.1, 12), B.material('brass', { roughness: 0.25 })); rail.rotation.z = Math.PI / 2; rail.position.set(0, 0.18, 0.95); grp.add(rail);
    g.add(grp);
  });
  // pendant lamps: opal globes with brass caps
  const lamps = [];
  const lampSpots = opt.lamps ?? [[-0.6, -1.0], [0.6, -1.0], [0, -1.7]];
  for (const [lx, lz] of lampSpots) {
    const lg = new THREE.Group(); lg.position.set(lx, FLOOR_Y + 2.05, lz);
    const globe = new THREE.Mesh(new THREE.SphereGeometry(0.14, 24, 18), new THREE.MeshBasicMaterial({ color: 0xffe4b0 }));
    const cap = shadowy(B.piece([[0, 0], [0.05, 0], [0.04, 0.05], [0.012, 0.08], [0, 0.08]], B.material('brass', { roughness: 0.2 }), 20), false, false); cap.position.y = 0.12;
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 1.0, 6), std('#120804')); cord.position.y = 0.7;
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex(), color: 0xffcf8a, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
    halo.scale.setScalar(1.0);
    lg.add(globe, cap, cord, halo); g.add(lg); lamps.push(lg);
  }
  // stools along the bars (seats for the patrons)
  const seatMat = phys('#8a1e1a', { roughness: 0.4, clearcoat: 0.6 });
  g.userData.stools = [];
  for (let i = 0; i < PATRON_SPOTS.length; i++) {
    if (!PATRON_SPOTS[i].seated) continue;
    const st = new THREE.Group();
    const seat = shadowy(B.piece([[0, 0.62], [0.17, 0.62], [0.18, 0.66], [0.15, 0.7], [0, 0.71]], seatMat, 24), false, false);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.62, 10), B.material('brass', { roughness: 0.25 })); post.position.y = 0.31;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.02, 20), B.material('brass', { roughness: 0.3 })); base.position.y = 0.01;
    st.add(seat, post, base); st.position.set(PATRON_SPOTS[i].x, FLOOR_Y, PATRON_SPOTS[i].z); g.add(st); g.userData.stools.push(st);
  }
  const motes = makeMotes(70);
  g.add(motes.points);
  g.userData.update = (time, calm) => { motes.update(time, calm); lamps.forEach((l, i) => { l.rotation.z = Math.sin(time * 0.5 + i) * 0.012; }); };
  g.userData.lamps = lamps;
  return g;
}
let HALO = null;
function haloTex() {
  if (HALO) return HALO;
  const c = canvas(128, 128), x = c.getContext('2d'), gr = x.createRadialGradient(64, 64, 2, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,240,200,1)'); gr.addColorStop(0.25, 'rgba(255,200,120,0.45)'); gr.addColorStop(1, 'rgba(255,170,80,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
  return (HALO = tex(c));
}
export const glowTexture = haloTex;
function makeMotes(n) {
  const geo = new THREE.BufferGeometry(), pos = new Float32Array(n * 3), seed = [];
  for (let i = 0; i < n; i++) { seed.push([hash(i * 3) , hash(i * 3 + 1), hash(i * 3 + 2)]); }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ color: 0xffd8a0, size: 0.012, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true, map: haloTex() });
  const points = new THREE.Points(geo, mat); points.frustumCulled = false;
  return {
    points,
    update(time, calm) {
      const k = calm ? 0.0 : 1;
      for (let i = 0; i < n; i++) {
        const s = seed[i];
        pos[i * 3] = (s[0] - 0.5) * 3.2 + Math.sin(time * 0.17 * k + s[2] * 9) * 0.12;
        pos[i * 3 + 1] = -0.2 + ((s[1] * 1.6 + time * 0.012 * k * (0.5 + s[2])) % 1.6);
        pos[i * 3 + 2] = (s[2] - 0.5) * 3.2 + Math.cos(time * 0.13 * k + s[0] * 9) * 0.12;
      }
      geo.attributes.position.needsUpdate = true;
    },
  };
}

// An environment map made from a dark lounge with a few warm lamps and a cool window: gives the lacquer and brass real,
// readable reflections (PMREM from this scene). Used as scene.environment.
export function buildEnvScene() {
  const sc = new THREE.Scene();
  const room = new THREE.Mesh(new THREE.BoxGeometry(8, 4, 8), new THREE.MeshBasicMaterial({ color: 0x5a3220, side: THREE.BackSide }));
  sc.add(room);
  const lamp = (x, y, z, w, h, col, i = 1) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(col).multiplyScalar(i), side: THREE.DoubleSide })); m.position.set(x, y, z); m.lookAt(0, 0, 0); sc.add(m); };
  lamp(0, 1.95, 0, 4.5, 3.4, '#ffe2b8', 1.1);                   // the pale ceiling above the pendant lamps
  lamp(-0.8, 1.8, -0.8, 1.4, 0.7, '#fff0d0', 14); lamp(0.9, 1.8, -0.4, 1.4, 0.7, '#ffe6c0', 12); lamp(0, 1.8, 1.0, 1.6, 0.7, '#fff0d8', 10);
  lamp(3.8, 0.6, 0.0, 1.8, 2.0, '#ffb878', 5); lamp(-3.8, 0.8, 0.5, 1.4, 1.6, '#cfe8ff', 4.5);
  lamp(0, 0.4, -3.8, 5, 1.2, '#ffc890', 3); lamp(0, 0.2, 3.8, 5, 1.0, '#ffd8b0', 2.4);
  return sc;
}

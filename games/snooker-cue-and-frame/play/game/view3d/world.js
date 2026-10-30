// Snooker 3D world (units: metres, TABLE frame: x across, y up the table away from the baulk end, z up). A members'-club table: deep
// emerald baize with printed baulk line / D / spots, walnut rails with brass-pearl sights, oxblood leather pockets in brass rings, a
// panelled apron on turned legs over an oak floor, lit by one warm overhead lamp. Everything is procedural (canvas textures + analytic
// geometry): no image files. The presenter maps the table frame to the camera frame.
import * as THREE from '../vendor3d/three.js';
import { TW, TL, R, BAULK_Y, D_R, MID_X, SPOT, POCKETS, GEOM } from '../src/sim.js';
import { BALL, ballStyle } from '../src/art.js';

export const TAU = Math.PI * 2;
export const CB = 0.058, RAIL = 0.112, RAIL_Z = 0.07;
export const holeAt = (i) => { const p = POCKETS[i]; return p.kind === 'c' ? { x: p.x < 0.5 ? -0.012 : TW + 0.012, y: p.y < 0.5 ? -0.012 : TL + 0.012, r: 0.085 } : { x: p.x < 0.5 ? -0.03 : TW + 0.03, y: p.y, r: 0.07 }; };
const lcg = (seed) => { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); };
const canvas = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const tex = (c, srgb = true, rep) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); } return t; };
const std = (o) => new THREE.MeshStandardMaterial(o);

// ---- textures ---------------------------------------------------------------------------------------------------------
function clothTextures(big) {
  const W = big ? 1024 : 512, H = Math.round(W * TL / TW), c = canvas(W, H), g = c.getContext('2d'), rnd = lcg(3);
  g.fillStyle = '#0a5a3c'; g.fillRect(0, 0, W, H);
  // a soft wear pattern: lighter centre, darker near the cushions
  const gr = g.createRadialGradient(W / 2, H / 2, W * 0.1, W / 2, H / 2, H * 0.62); gr.addColorStop(0, 'rgba(60,170,120,0.18)'); gr.addColorStop(1, 'rgba(0,30,20,0.28)');
  g.fillStyle = gr; g.fillRect(0, 0, W, H);
  for (let i = 0; i < (big ? 52000 : 14000); i++) { g.fillStyle = `rgba(${rnd() < 0.5 ? '0,25,15' : '150,230,190'},${0.03 + rnd() * 0.05})`; g.fillRect(rnd() * W, rnd() * H, 1 + rnd() * 1.6, 1 + rnd() * 1.6); }
  const px = (x) => (x / TW) * W, py = (y) => (1 - y / TL) * H, k = W / TW;
  g.strokeStyle = 'rgba(244,244,230,0.78)'; g.lineWidth = Math.max(1.5, 0.005 * k);
  g.beginPath(); g.moveTo(0, py(BAULK_Y)); g.lineTo(W, py(BAULK_Y)); g.stroke();
  g.beginPath(); g.arc(px(MID_X), py(BAULK_Y), D_R * k, 0, Math.PI); g.stroke();       // the D bulges toward the baulk cushion
  g.fillStyle = 'rgba(20,20,24,0.55)';
  for (const id of [16, 17, 18, 19, 20, 21]) { g.beginPath(); g.arc(px(SPOT[id].x), py(SPOT[id].y), 0.0075 * k, 0, TAU); g.fill(); }
  // bump (nap) texture
  const b = canvas(256), bg = b.getContext('2d'); bg.fillStyle = '#808080'; bg.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 9000; i++) { bg.fillStyle = `rgba(${rnd() < 0.5 ? 0 : 255},${rnd() < 0.5 ? 0 : 255},${rnd() < 0.5 ? 0 : 255},0.18)`; bg.fillRect(rnd() * 256, rnd() * 256, 1.5, 1.5); }
  return { map: tex(c), bump: tex(b, false, [8, 16]) };
}
function woodTex(seed, w = 512, h = 512, base = [96, 46, 24], rep) {
  const c = canvas(w, h), g = c.getContext('2d'), rnd = lcg(seed);
  g.fillStyle = `rgb(${base})`; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 260; i++) {
    const y = rnd() * h, k = (rnd() - 0.5) * 46;
    g.strokeStyle = `rgba(${base.map((v) => Math.max(0, Math.min(255, v + k)))},${0.3 + rnd() * 0.5})`; g.lineWidth = 0.6 + rnd() * 2.8;
    g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= w; x += 32) g.lineTo(x, y + Math.sin(x * 0.015 + i) * 3 + (rnd() - 0.5) * 1.4); g.stroke();
  }
  return tex(c, true, rep);
}
function floorTex() {
  const c = canvas(512), g = c.getContext('2d'), rnd = lcg(21); g.fillStyle = '#2a1b10'; g.fillRect(0, 0, 512, 512);
  for (let r = 0; r < 8; r++) for (let q = 0; q < 2; q++) {
    const sh = 28 + rnd() * 26; g.fillStyle = `rgb(${sh + 22},${sh * 0.62 + 12},${sh * 0.34 + 6})`; g.fillRect(((q + (r % 2) * 0.5) * 256) % 512, r * 64, 254, 62);
    for (let i = 0; i < 14; i++) { g.strokeStyle = 'rgba(0,0,0,0.16)'; g.lineWidth = 1; const y = r * 64 + rnd() * 62; g.beginPath(); g.moveTo(q * 256, y); g.lineTo(q * 256 + 256, y + (rnd() - 0.5) * 3); g.stroke(); }
  }
  return tex(c, true, [8, 8]);
}

// ---- cushions -----------------------------------------------------------------------------------------------------------
// profile points (u outward from the cloth edge, z up); the ends are cut back toward the pockets (the mouth is narrowest at the nose).
const PROFILE = [[0, 0], [-0.012, 0.05], [-CB, 0.063], [-CB, 0]];
function prism(frame, lo, hi, mat) {
  const pos = [], pushTri = (a, b, c) => pos.push(...a, ...b, ...c);
  const V = (u, z, t) => frame(u, z, t);
  const ends = [lo, hi], cut = (u) => -u * 0.95;
  const pts = (i, e) => V(PROFILE[i][0], PROFILE[i][1], e === 0 ? lo + cut(PROFILE[i][0]) : hi - cut(PROFILE[i][0]));
  for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; const a = pts(i, 0), b = pts(i, 1), c = pts(j, 1), d = pts(j, 0); pushTri(a, b, c); pushTri(a, c, d); }
  for (const e of [0, 1]) { const p = [0, 1, 2, 3].map((i) => pts(i, e)); pushTri(p[0], p[1], p[2]); pushTri(p[0], p[2], p[3]); }
  void ends;
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
  const m = new THREE.Mesh(g, mat); m.castShadow = true; m.receiveShadow = true; return m;
}
export function buildTable(big) {
  const g = new THREE.Group(), ct = clothTextures(big);
  const cloth = std({ map: ct.map, bumpMap: ct.bump, bumpScale: 0.5, roughness: 0.96, metalness: 0 });
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(TW + 2 * CB, TL + 2 * CB), cloth); plane.position.set(TW / 2, TL / 2, 0); plane.receiveShadow = true;
  // the cloth texture covers TW x TL: widen the UVs so the printed lines stay put under the cushions
  { const uv = plane.geometry.attributes.uv, kx = (TW + 2 * CB) / TW, ky = (TL + 2 * CB) / TL; for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.5 + (uv.getX(i) - 0.5) * kx, 0.5 + (uv.getY(i) - 0.5) * ky); }
  g.add(plane);
  const baize = std({ color: 0x0a5a3e, roughness: 0.95, side: THREE.DoubleSide });
  const { CE, MG } = GEOM;
  // frames: u points AWAY from the cloth. baulk: y = -u ; top: y = TL + (-u)... (u is negative outward)
  const fr = {
    bottom: (u, z, t) => [t, u, z],               // outward = -y, so y = u (u <= 0)
    top: (u, z, t) => [t, TL - u, z],
    left: (u, z, t) => [u, t, z],
    right: (u, z, t) => [TW - u, t, z],
  };
  g.add(prism(fr.bottom, CE, TW - CE, baize), prism(fr.top, CE, TW - CE, baize));
  for (const f of [fr.left, fr.right]) g.add(prism(f, CE, TL / 2 - MG / 2, baize), prism(f, TL / 2 + MG / 2, TL - CE, baize));
  // rails: a flat frame around the cushions
  const sh = new THREE.Shape(); sh.moveTo(-RAIL, -RAIL); sh.lineTo(TW + RAIL, -RAIL); sh.lineTo(TW + RAIL, TL + RAIL); sh.lineTo(-RAIL, TL + RAIL); sh.closePath();
  const ho = new THREE.Path(); ho.moveTo(-CB, -CB); ho.lineTo(-CB, TL + CB); ho.lineTo(TW + CB, TL + CB); ho.lineTo(TW + CB, -CB); ho.closePath(); sh.holes.push(ho);
  const rg = new THREE.ExtrudeGeometry(sh, { depth: 0.08, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 2, curveSegments: 4 });
  { const uv = rg.attributes.uv, p = rg.attributes.position; for (let i = 0; i < uv.count; i++) uv.setXY(i, p.getX(i) * 0.9, p.getY(i) * 0.9); }
  const woodMap = woodTex(11, 512, 512, [98, 48, 25], [1, 1]); woodMap.wrapS = woodMap.wrapT = THREE.RepeatWrapping;
  const wood = std({ map: woodMap, roughness: 0.42, metalness: 0.05 });
  const rail = new THREE.Mesh(rg, wood); rail.position.z = RAIL_Z - 0.08; rail.castShadow = true; rail.receiveShadow = true; g.add(rail);
  // apron + legs
  const apron = new THREE.Mesh(new THREE.BoxGeometry(TW + 2 * RAIL - 0.04, TL + 2 * RAIL - 0.04, 0.26), std({ map: woodTex(12, 256, 256, [70, 34, 18]), roughness: 0.5 }));
  apron.position.set(TW / 2, TL / 2, -0.14); apron.castShadow = true; apron.receiveShadow = true; g.add(apron);
  const legM = std({ map: woodTex(13, 128, 256, [78, 38, 20]), roughness: 0.45 });
  for (const [x, y] of [[-0.02, -0.02], [TW + 0.02, -0.02], [-0.02, TL + 0.02], [TW + 0.02, TL + 0.02]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.095, 0.82, 16), legM); leg.rotation.x = Math.PI / 2; leg.position.set(x, y, -0.55); leg.castShadow = true; g.add(leg);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.05, 16), std({ color: 0xb98a3a, roughness: 0.3, metalness: 0.9 })); cap.rotation.x = Math.PI / 2; cap.position.set(x, y, -0.96); g.add(cap);
  }
  // pockets: dark mouth, oxblood leather ring, brass bezel
  const leather = std({ color: 0x5a0f12, roughness: 0.55, metalness: 0.05 }), brass = std({ color: 0xc89b3c, roughness: 0.28, metalness: 0.95 });
  const black = new THREE.MeshBasicMaterial({ color: 0x050403 });
  for (let i = 0; i < 6; i++) {
    const h = holeAt(i), r = h.r * 0.93;
    const mouth = new THREE.Mesh(new THREE.CircleGeometry(r, 40), black); mouth.position.set(h.x, h.y, RAIL_Z + 0.0015); g.add(mouth);
    const lr = new THREE.Mesh(new THREE.TorusGeometry(r, 0.011, 10, 48), leather); lr.position.set(h.x, h.y, RAIL_Z + 0.004); lr.castShadow = true; g.add(lr);
    const br = new THREE.Mesh(new THREE.TorusGeometry(r + 0.016, 0.0055, 8, 48), brass); br.position.set(h.x, h.y, RAIL_Z + 0.006); g.add(br);
  }
  // sights: mother-of-pearl diamonds
  const pearl = std({ color: 0xf1ead8, roughness: 0.25, metalness: 0.2 });
  const dg = new THREE.CircleGeometry(0.0085, 4); dg.scale(1.25, 1, 1);
  const dia = (x, y) => { const m = new THREE.Mesh(dg, pearl); m.position.set(x, y, RAIL_Z + 0.0072); m.rotation.z = Math.PI / 2 * 0; g.add(m); };
  const off = (RAIL + CB) / 2;
  for (let i = 1; i < 8; i++) { if (i !== 4) { dia(TW * i / 8, -off); dia(TW * i / 8, TL + off); } }
  for (let i = 1; i < 8; i++) { dia(-off, TL * i / 8); dia(TW + off, TL * i / 8); }
  g.userData.dispose = () => { ct.map.dispose(); ct.bump.dispose(); };
  return g;
}

// ---- room ---------------------------------------------------------------------------------------------------------------
export function buildRoom(scene) {
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), std({ map: floorTex(), roughness: 0.62, metalness: 0 }));
  floor.position.set(TW / 2, TL / 2, -1.01); floor.receiveShadow = true; scene.add(floor);
  return { floor };
}
export function buildLights(scene) {
  const hemi = new THREE.HemisphereLight(0xffe6c0, 0x1c140c, 0.22); hemi.position.set(0, 0, 4); hemi.up.set(0, 0, 1);
  const key = new THREE.SpotLight(0xffe4b8, 80, 0, 0.78, 0.85, 2);
  key.position.set(TW / 2 + 0.2, TL / 2 - 0.4, 3.4); key.target.position.set(TW / 2, TL / 2, 0);
  key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0003; key.shadow.normalBias = 0.01; key.shadow.camera.near = 1.5; key.shadow.camera.far = 6;
  const fill = new THREE.DirectionalLight(0xbfd6ff, 0.28); fill.position.set(-2, -3, 3);
  return { hemi, key, fill, add(grp) { grp.add(hemi, key, key.target, fill); } };
}

// ---- balls and cue -----------------------------------------------------------------------------------------------------
const ballTex = new Map();
function ballTexture(id) {
  const st = ballStyle(id), key = id >= 1 && id <= 15 ? 'red' : id;
  if (ballTex.has(key)) return ballTex.get(key);
  const c = canvas(128, 64), g = c.getContext('2d'); g.fillStyle = st.main; g.fillRect(0, 0, 128, 64);
  const cap = Math.round(64 * 0.2 / Math.PI * 1.4);
  g.fillStyle = id === 0 ? '#c8261f' : id === 21 ? '#d9d9e6' : 'rgba(255,255,255,0.78)';
  if (id === 0) { g.fillRect(0, 0, 128, cap); g.fillStyle = '#222'; g.fillRect(0, 64 - Math.max(2, cap - 2), 128, Math.max(2, cap - 2)); } else { g.fillRect(0, 0, 128, Math.max(2, cap - 1)); }
  const t = tex(c); ballTex.set(key, t); return t;
}
let ballGeo = null;
export function buildBall(id) {
  ballGeo = ballGeo || new THREE.SphereGeometry(R, 40, 28);
  const m = new THREE.Mesh(ballGeo, new THREE.MeshPhysicalMaterial({ map: ballTexture(id), roughness: 0.16, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 1.1 }));
  m.castShadow = true; m.receiveShadow = false; return m;
}
// The cue lies along +x from the tip (origin) to the butt, 1.45 m long; the presenter turns it to the aim and tilts it.
export function buildCue() {
  const prof = [[0.0048, 0], [0.0049, 0.012], [0.0052, 0.012], [0.0054, 0.03], [0.0056, 0.03], [0.0105, 0.62], [0.0108, 0.62], [0.0108, 0.64], [0.0112, 0.64], [0.0165, 1.45]];
  const geo = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 18); geo.rotateZ(-Math.PI / 2);
  const g = new THREE.Group();
  const shaft = std({ color: 0xe8c98c, roughness: 0.4 });
  const mesh = new THREE.Mesh(geo, [shaft]); mesh.castShadow = true;
  // colour bands via vertex colours: tip blue, ferrule cream, ash, joint brass, butt walnut
  const pos = geo.attributes.position, cols = new Float32Array(pos.count * 3), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) { const x = pos.getX(i); c.set(x < 0.012 ? 0x2f6fd0 : x < 0.03 ? 0xf2ecd8 : x < 0.62 ? 0xe9c98d : x < 0.64 ? 0xb8903a : x < 0.8 ? 0x4a2812 : 0x2b160a); cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3)); mesh.material = std({ vertexColors: true, roughness: 0.38, metalness: 0.05 });
  g.add(mesh); return g;
}
export { BALL };

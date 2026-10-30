// Koto 3D world: every mesh and texture is procedural (no image files). The koto (paulownia body with an arched top, lacquered and
// gold-patterned ends, raised nuts, thirteen silk strings, ivory kotoji bridges), ivory-tipped tsume picks, and a quiet evening room:
// tatami mats with cloth borders, a backlit shoji wall, a tokonoma alcove with an ikebana arrangement, and a paper andon lamp.
// Instrument frame (shared with the 2D layout): local x = along the strings (u * len), local z = -(across) so string s sits at
// z = -(s + 0.5) * sp, y = up with the string plane at y = 0. Room pieces are built in centimetres.
import * as THREE from '../vendor3d/three.js';
import { NSTR, GEO } from '../src/music.js';
import { BODY } from '../src/layout.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hash = (i) => { const x = Math.sin(i * 12.9898 + 4.1) * 43758.5453; return x - Math.floor(x); };

function canvasTex(w, h, paint, { repeat = null, srgb = true } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  paint(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}

// ---------------------------------------------------------------- textures
function paulowniaTex() {        // soft blond kiri wood with long flowing grain and darker flame figure (texture u = along)
  return canvasTex(1024, 256, (g, w, h) => {
    const bg = g.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, '#c99a62'); bg.addColorStop(0.5, '#ddb47a'); bg.addColorStop(1, '#c4935a');
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 170; i++) {
      const y = h * hash(i), amp = 2 + 9 * hash(i + 40), ph = hash(i + 80) * TAU, fr = 1.5 + 3 * hash(i + 120), dark = hash(i + 160) > 0.45;
      g.strokeStyle = dark ? `rgba(110,62,26,${0.08 + 0.2 * hash(i + 200)})` : `rgba(255,226,170,${0.06 + 0.12 * hash(i + 240)})`;
      g.lineWidth = 0.6 + 2.2 * hash(i + 280); g.beginPath();
      for (let x = 0; x <= w; x += 8) { const yy = y + Math.sin((x / w) * TAU * fr + ph) * amp + Math.sin((x / w) * TAU * 7 + ph * 2) * amp * 0.2; x ? g.lineTo(x, yy) : g.moveTo(x, yy); }
      g.stroke();
    }
    for (let i = 0; i < 9; i++) {                                                        // flame figure: broad darker drifts
      const x = w * hash(i + 400), y = h * hash(i + 440), r = 60 + 120 * hash(i + 480);
      const rg = g.createRadialGradient(x, y, 4, x, y, r); rg.addColorStop(0, 'rgba(120,70,30,0.16)'); rg.addColorStop(1, 'rgba(120,70,30,0)');
      g.save(); g.scale(1, 0.35); g.fillStyle = rg; g.fillRect(x - r, y / 0.35 - r, r * 2, r * 2); g.restore();
    }
  }, { repeat: [1, 1] });
}
function lacquerTex() {          // black-brown lacquer with a gold seigaiha (wave) pattern, for the koto's end panels
  return canvasTex(256, 256, (g, w, h) => {
    const bg = g.createLinearGradient(0, 0, w, h); bg.addColorStop(0, '#1c0f0a'); bg.addColorStop(0.5, '#2e1912'); bg.addColorStop(1, '#170c08');
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    const R = 32;
    for (let r = 0, y = -R; y < h + R; r++, y += R * 0.5) for (let x = -(r % 2) * R; x < w + R; x += R * 2) {
      g.fillStyle = r % 2 ? '#24130d' : '#22120c'; g.beginPath(); g.arc(x + R, y + R, R, Math.PI, TAU); g.fill();
      for (let k = 0; k < 4; k++) { g.strokeStyle = `rgba(232,190,100,${0.55 - k * 0.1})`; g.lineWidth = 2.2; g.beginPath(); g.arc(x + R, y + R, R * (1 - k * 0.22), Math.PI, TAU); g.stroke(); }
    }
  }, { repeat: [1, 1] });
}
function tatamiTex() {           // one tatami mat (90 x 180 cm): tight straw weave and a dark cloth border (heri) along the long sides
  return canvasTex(512, 1024, (g, w, h) => {
    g.fillStyle = '#a8a160'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 4) { g.fillStyle = `rgba(${y % 8 ? '70,72,30' : '210,205,140'},${0.18 + 0.12 * hash(y)})`; g.fillRect(0, y, w, 2); }
    for (let i = 0; i < 1400; i++) { g.fillStyle = `rgba(60,58,20,${0.05 + 0.08 * hash(i)})`; g.fillRect(w * hash(i + 3), h * hash(i + 7), 2 + 30 * hash(i + 9), 1.5); }
    const sh = g.createLinearGradient(0, 0, w, 0); sh.addColorStop(0, 'rgba(255,250,200,0.08)'); sh.addColorStop(0.5, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(255,250,200,0.06)');
    g.fillStyle = sh; g.fillRect(0, 0, w, h);
    const bw = 30;
    for (const x of [0, w - bw]) {
      g.fillStyle = '#1b1d24'; g.fillRect(x, 0, bw, h);
      g.strokeStyle = 'rgba(160,140,90,0.35)'; g.lineWidth = 1.5;
      for (let y = 10; y < h; y += 26) { g.beginPath(); g.moveTo(x + 6, y); g.lineTo(x + bw / 2, y + 8); g.lineTo(x + bw - 6, y); g.stroke(); }
    }
    g.fillStyle = 'rgba(20,20,10,0.6)'; g.fillRect(0, 0, w, 3); g.fillRect(0, h - 3, w, 3);
  });
}
function shojiTex() {            // one shoji panel lit from outside: paper, kumiko lattice, a bamboo shadow
  return canvasTex(256, 512, (g, w, h) => {
    const pg = g.createLinearGradient(0, 0, 0, h); pg.addColorStop(0, '#fff1cf'); pg.addColorStop(0.6, '#ffd9a0'); pg.addColorStop(1, '#f4c486');
    g.fillStyle = pg; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(70,60,30,0.22)'; g.lineWidth = 7; g.lineCap = 'round';
    g.beginPath(); g.moveTo(w * 0.7, h); g.lineTo(w * 0.74, 0); g.stroke();
    for (let k = 0; k < 10; k++) {
      const ly = h * (0.06 + 0.09 * k), side = k % 2 ? 1 : -1;
      g.save(); g.translate(w * 0.72, ly); g.rotate(side > 0 ? -0.45 : Math.PI + 0.45); g.fillStyle = 'rgba(60,60,30,0.2)';
      g.beginPath(); g.ellipse(34, 0, 38, 6, 0, 0, TAU); g.fill(); g.restore();
    }
    g.fillStyle = '#2a1a10';
    const cols = 3, rows = 6;
    for (let c = 1; c < cols; c++) g.fillRect((w * c) / cols - 2, 0, 4, h * 0.82);
    for (let r = 1; r <= rows; r++) g.fillRect(0, (h * 0.82 * r) / (rows + 0.001) - 2, w, 4);
    g.fillStyle = '#3a2416'; g.fillRect(0, h * 0.82, w, h * 0.18);                        // koshi-ita: the wooden lower panel
    g.fillStyle = 'rgba(255,220,160,0.08)'; g.fillRect(0, h * 0.82, w, 3);
    g.strokeStyle = '#1d120b'; g.lineWidth = 14; g.strokeRect(0, 0, w, h);
  });
}
function plasterTex() {
  return canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#5a4634'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 1600; i++) { g.fillStyle = `rgba(${hash(i) > 0.5 ? '255,230,190' : '30,18,10'},${0.04 * hash(i + 5)})`; g.fillRect(w * hash(i + 1), h * hash(i + 2), 2, 2); }
  }, { repeat: [3, 2] });
}
function andonTex() {
  return canvasTex(128, 256, (g, w, h) => {
    const pg = g.createRadialGradient(w / 2, h * 0.55, 10, w / 2, h * 0.55, h * 0.6); pg.addColorStop(0, '#fff6dc'); pg.addColorStop(1, '#f2b765');
    g.fillStyle = pg; g.fillRect(0, 0, w, h);
    g.fillStyle = '#2a170d'; g.fillRect(0, 0, w, 6); g.fillRect(0, h - 6, w, 6); g.fillRect(0, h / 2 - 2, w, 4); g.fillRect(0, 0, 5, h); g.fillRect(w - 5, 0, 5, h);
  });
}

// ---------------------------------------------------------------- materials
export function materials() {
  const wood = paulowniaTex();
  const woodSide = wood.clone(); woodSide.needsUpdate = true; woodSide.repeat.set(1, 0.4);
  return {
    top: new THREE.MeshPhysicalMaterial({ map: wood, roughness: 0.42, clearcoat: 0.6, clearcoatRoughness: 0.28, color: 0xb98c60 }),
    side: new THREE.MeshPhysicalMaterial({ map: woodSide, roughness: 0.5, clearcoat: 0.4, clearcoatRoughness: 0.4, color: 0xd8b892 }),
    lacquer: new THREE.MeshPhysicalMaterial({ map: lacquerTex(), roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.12, color: 0xffffff }),
    ebony: new THREE.MeshPhysicalMaterial({ color: 0x24140d, roughness: 0.3, clearcoat: 0.9, clearcoatRoughness: 0.15 }),
    gold: new THREE.MeshStandardMaterial({ color: 0xd9a94e, metalness: 1, roughness: 0.3 }),
    ivory: new THREE.MeshPhysicalMaterial({ color: 0xfff3dc, roughness: 0.34, clearcoat: 0.6, clearcoatRoughness: 0.2, sheen: 0.3, sheenColor: new THREE.Color(0xffffff) }),
    ivoryHot: new THREE.MeshPhysicalMaterial({ color: 0xfff3dc, roughness: 0.34, clearcoat: 0.6, emissive: 0xffc860, emissiveIntensity: 0.55 }),
    silk: new THREE.MeshStandardMaterial({ color: 0xfff1cf, roughness: 0.38, metalness: 0.05, emissive: 0x3a2a10, emissiveIntensity: 0.25 }),
    tatami: new THREE.MeshStandardMaterial({ map: tatamiTex(), roughness: 0.9, color: 0x8f8a64 }),
    shoji: new THREE.MeshStandardMaterial({ map: shojiTex(), emissive: 0xffffff, emissiveMap: null, emissiveIntensity: 0, roughness: 0.9 }),
    shojiGlow: new THREE.MeshBasicMaterial({ map: null, toneMapped: true }),
    beam: new THREE.MeshStandardMaterial({ color: 0x2f1d12, roughness: 0.6 }),
    plaster: new THREE.MeshStandardMaterial({ map: plasterTex(), roughness: 0.95 }),
    alcove: new THREE.MeshStandardMaterial({ color: 0x3b2618, roughness: 0.45, metalness: 0 }),
    vase: new THREE.MeshPhysicalMaterial({ color: 0x1f3a3a, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.1 }),
    branch: new THREE.MeshStandardMaterial({ color: 0x3a2a1c, roughness: 0.8 }),
    blossom: new THREE.MeshStandardMaterial({ color: 0xffd3dc, roughness: 0.6, emissive: 0x401820, emissiveIntensity: 0.25 }),
    leaf: new THREE.MeshStandardMaterial({ color: 0x3f5a2a, roughness: 0.7, side: THREE.DoubleSide }),
    andon: new THREE.MeshBasicMaterial({ map: andonTex() }),
    cushion: new THREE.MeshStandardMaterial({ color: 0x5b1d24, roughness: 0.85 }),
    tsumeBand: new THREE.MeshStandardMaterial({ color: 0x8b1f22, roughness: 0.7 }),
  };
}

// ---------------------------------------------------------------- the koto
// P = { len, sp, m, hS (string height above the body top at the edges), bodyH, k (units per cm, for small parts), detail (1 or 0.6) }
export function buildKoto(P, M) {
  const { len, sp, m, hS, bodyH } = P, W = NSTR * sp, k = P.k;
  const g = new THREE.Group();
  const x0 = BODY.a0 * len, x1 = BODY.a1 * len, xf = GEO.uFar * len, xn = GEO.uNear * len;
  const z0 = m, z1 = -(W + m), zc = (z0 + z1) / 2, hw = (z0 - z1) / 2;
  const yTop = -hS, arch = hS * 0.32;
  const topY = (z) => yTop + arch * (1 - Math.pow((z - zc) / hw, 2)) - 0.0;
  // body: a box whose top is arched across, its long sides slightly rounded into the top
  const nx = 6, nz = 26;
  const body = new THREE.BoxGeometry(x1 - x0, bodyH, z0 - z1, nx, 1, nz);
  const p = body.attributes.position, uv = body.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) + (x0 + x1) / 2, y = p.getY(i), z = p.getZ(i) + zc;
    const yy = y > 0 ? topY(z) : yTop - bodyH + arch * 0.3;
    p.setXYZ(i, x, yy, z);
  }
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i), uv.getY(i));
  body.computeVertexNormals();
  // material groups of a BoxGeometry: +x, -x, +y, -y, +z, -z
  const bodyMesh = new THREE.Mesh(body, [M.lacquer, M.lacquer, M.top, M.side, M.side, M.side]);
  bodyMesh.castShadow = true; bodyMesh.receiveShadow = true; g.add(bodyMesh);
  // the lacquered end caps over the top (far end and player's end), a thin raised skin following the arch, with gold edges
  const cap = (a, b, lift) => {
    const geo = new THREE.PlaneGeometry(b - a, z0 - z1 + 0.2, 1, 16); geo.rotateX(-Math.PI / 2);
    const q = geo.attributes.position;
    for (let i = 0; i < q.count; i++) { const z = q.getZ(i) + zc; q.setXYZ(i, q.getX(i) + (a + b) / 2, topY(z) + lift, z); }
    geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, M.lacquer); mesh.receiveShadow = true; g.add(mesh);
    for (const x of [a + 0.6 * k, b - 0.6 * k]) {
      const line = new THREE.Mesh(new THREE.BoxGeometry(0.5 * k, 0.4 * k, z0 - z1), M.gold); line.position.set(x, topY(zc) + lift + 0.1 * k, zc); line.scale.y = 0.5; g.add(line);
    }
    return mesh;
  };
  cap(x0, xf - 1.2 * k, 0.15 * k);
  cap(xn + 1.2 * k, x1, 0.15 * k);
  // raised nuts the strings run over (the strings rest on them at y = 0): dark wood with an ivory top strip
  for (const x of [xf, xn]) {
    const nh = -topY(z0) + 0.1, nw = Math.max(1.4 * k, sp * 0.3);
    const nut = new THREE.Mesh(new THREE.BoxGeometry(nw, nh, W + m * 0.6), M.ebony); nut.position.set(x, -nh / 2 - 0.5 * k * 0.2, -W / 2); nut.castShadow = true; nut.receiveShadow = true; g.add(nut);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(nw * 0.42, Math.max(1, 0.35 * k), W + m * 0.4), M.ivory); strip.position.set(x, -Math.max(1, 0.35 * k) / 2, -W / 2); g.add(strip);
  }
  // small feet at the player's end (the koto rests on the mats there and on its own tail)
  const footH = bodyH * 0.45;
  for (const z of [z0 - hw * 0.25, z1 + hw * 0.25]) {
    const f = new THREE.Mesh(new THREE.BoxGeometry(6 * k, footH, 5 * k), M.ebony); f.position.set(x1 - 10 * k, yTop - bodyH - footH / 2 + arch * 0.3, z); f.castShadow = true; g.add(f);
  }
  // strings: tubes built once, vertices moved on the CPU when a string vibrates or is pressed
  const strings = [];
  const segs = Math.round(40 * (P.detail ?? 1)), rad = clamp(sp * 0.08, 0.12 * k, 5.5), radial = 6;
  for (let s = 0; s < NSTR; s++) {
    const geo = new THREE.CylinderGeometry(1, 1, 1, radial, segs, true); geo.rotateZ(-Math.PI / 2);            // axis along x, from -0.5 to 0.5
    const base = Float32Array.from(geo.attributes.position.array);
    const r = rad * (1.18 - 0.36 * s / (NSTR - 1));
    const mesh = new THREE.Mesh(geo, M.silk); mesh.castShadow = true; mesh.frustumCulled = false; g.add(mesh);
    strings.push({ mesh, base, r, z: -(s + 0.5) * sp, key: '' });
  }
  // kotoji bridges: an arched two-legged ivory bridge, wide across the string, with a notch at the top
  const bw = Math.min(sp * 0.92, 3.6 * k * 1.6), bd = clamp(sp * 0.3, 0.9 * k, 14);
  const shape = new THREE.Shape();
  const hgt = hS - arch * 0.15;
  shape.moveTo(-bw / 2, 0); shape.lineTo(-bw * 0.3, 0); shape.quadraticCurveTo(0, hgt * 0.55, bw * 0.3, 0); shape.lineTo(bw / 2, 0);
  shape.lineTo(bw * 0.14, hgt * 0.94); shape.quadraticCurveTo(0, hgt * 1.04, -bw * 0.14, hgt * 0.94); shape.lineTo(-bw / 2, 0);
  const bgeo = new THREE.ExtrudeGeometry(shape, { depth: bd, bevelEnabled: true, bevelThickness: bd * 0.18, bevelSize: Math.min(bw, hgt) * 0.04, bevelSegments: 2, curveSegments: 8 });
  bgeo.translate(0, 0, -bd / 2); bgeo.rotateY(Math.PI / 2);                                                       // shape plane = across x height; depth = along the string
  const bridges = [];
  for (let s = 0; s < NSTR; s++) {
    const b = new THREE.Mesh(bgeo, M.ivory); b.castShadow = true; b.receiveShadow = true; g.add(b);
    bridges.push(b);
  }
  const placeBridge = (s, u) => { const z = -(s + 0.5) * sp, b = bridges[s]; b.position.set(u * len, topY(z) - 0.2, z); b.scale.y = (0 - topY(z) + 0.2) / hgt; };
  return { group: g, strings, bridges, placeBridge, topY, len, sp, W, m, hS, bodyH, x0, x1, xf, xn, z0, z1, footBottom: yTop - bodyH - footH + arch * 0.3 };
}

// Move string s: rest from the far nut over its bridge to the near nut; amp vibrates the part in front of the bridge (across the
// string, decaying wave), press lowers the part behind the bridge (oshide). All in instrument units.
export function poseString(K, s, bu, amp, ph, press) {
  const st = K.strings[s], geo = st.mesh.geometry, pos = geo.attributes.position, b = st.base;
  const key = `${bu.toFixed(4)}|${amp.toFixed(3)}|${ph.toFixed(2)}|${press.toFixed(2)}`;
  if (key === st.key) return; st.key = key;
  const xa = GEO.uFar * K.len, xb = bu * K.len, xn = GEO.uNear * K.len, r = st.r;
  for (let i = 0; i < pos.count; i++) {
    const t = b[i * 3] + 0.5, cy = b[i * 3 + 1], cz = b[i * 3 + 2];
    const x = xa + (xn - xa) * t;
    let dy = 0, dz = 0;
    if (x > xb && amp > 0) { const kk = (x - xb) / Math.max(1, xn - xb); dz = Math.sin(Math.PI * kk) * amp * Math.cos(ph); dy = Math.sin(Math.PI * kk) * amp * 0.25 * Math.sin(ph); }
    if (x < xb && press > 0) { const kk = (x - xa) / Math.max(1, xb - xa); dy = -Math.sin(Math.PI * Math.pow(kk, 1.6)) * K.hS * 0.12 * press; }
    pos.setXYZ(i, x, r + cy * r + dy, st.z + cz * r + dz);
  }
  pos.needsUpdate = true; geo.computeVertexNormals();
}

// ---------------------------------------------------------------- tsume (pick): a red cloth band and an ivory blade, in cm
export function buildTsume(M) {
  const g = new THREE.Group();
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 1.1, 20, 1, true), M.tsumeBand); band.material.side = THREE.DoubleSide; band.rotation.x = Math.PI / 2; band.castShadow = true; g.add(band);
  const sh = new THREE.Shape(); sh.moveTo(-0.55, 0); sh.quadraticCurveTo(-0.5, 1.4, 0, 2.2); sh.quadraticCurveTo(0.5, 1.4, 0.55, 0); sh.lineTo(-0.55, 0);
  const blade = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.18, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 2, curveSegments: 8 }), M.ivory);
  blade.rotation.x = -Math.PI / 2; blade.position.set(0, -0.95, 0.35); blade.castShadow = true; g.add(blade);    // blade lies along -z from the band, under the finger pad
  return g;
}

// ---------------------------------------------------------------- the room (cm). Origin: floor centre; the shoji wall runs along x at z = wallZ.
export function buildRoom(M, o = {}) {
  const g = new THREE.Group();
  const matW = 90, matL = 180;
  const mats = new THREE.Group(); g.add(mats);
  const mgeo = new THREE.PlaneGeometry(matW, matL); mgeo.rotateX(-Math.PI / 2);
  // bands 180 cm deep: even bands have mats running along z; odd bands two rows of turned mats, offset so borders never cross
  const wallZ0 = o.wallZ ?? -260;
  for (let b = 0; b < 8; b++) {
    const zb = wallZ0 + b * matL;
    if (b % 2 === 0) for (let c = -9; c < 9; c++) { const m = new THREE.Mesh(mgeo, M.tatami); m.receiveShadow = true; m.position.set(c * matW + matW / 2, 0, zb + matL / 2); mats.add(m); }
    else for (let r = 0; r < 2; r++) for (let c = -5; c < 5; c++) { const m = new THREE.Mesh(mgeo, M.tatami); m.receiveShadow = true; m.rotation.y = Math.PI / 2; m.position.set(c * matL + (r ? matW : 0), 0, zb + r * matW + matW / 2); mats.add(m); }
  }
  // the wall: shoji panels between dark posts, a plaster band above, beams
  const wallZ = o.wallZ ?? -260, wallW = 1400, panelW = 92, panelH = 180;
  const wall = new THREE.Group(); wall.position.z = wallZ; g.add(wall);
  const sgeo = new THREE.PlaneGeometry(panelW, panelH);
  const shojiMat = new THREE.MeshBasicMaterial({ map: M.shoji.map, color: 0xffffff });
  M.shojiBasic = shojiMat;
  for (let i = -7; i <= 7; i++) {
    if (i >= -1 && i <= 0 && o.tokonoma !== false) continue;                                     // the alcove takes two bays
    const p = new THREE.Mesh(sgeo, shojiMat); p.position.set(i * panelW + panelW / 2, panelH / 2 + 4, 0); wall.add(p);
  }
  const post = new THREE.BoxGeometry(9, 260, 9);
  for (let i = -7; i <= 8; i += 2) { const m = new THREE.Mesh(post, M.beam); m.position.set(i * panelW, 130, 3); wall.add(m); }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(wallW * 2, 12, 12), M.beam); beam.position.set(0, panelH + 10, 4); wall.add(beam);
  const sill = new THREE.Mesh(new THREE.BoxGeometry(wallW * 2, 5, 14), M.beam); sill.position.set(0, 2.5, 4); wall.add(sill);
  const plaster = new THREE.Mesh(new THREE.PlaneGeometry(wallW * 2, 120), M.plaster); plaster.position.set(0, panelH + 76, 0); wall.add(plaster);
  // tokonoma alcove: a raised dark-wood platform with a hanging scroll and the ikebana
  const alcove = new THREE.Group(); alcove.position.set(-panelW, 0, 0); wall.add(alcove);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(panelW * 2, 250), M.plaster); back.position.set(0, 125, -60); alcove.add(back);
  const side1 = new THREE.Mesh(new THREE.BoxGeometry(6, 250, 60), M.beam); side1.position.set(-panelW, 125, -30); alcove.add(side1);
  const side2 = side1.clone(); side2.position.x = panelW; alcove.add(side2);
  const plat = new THREE.Mesh(new THREE.BoxGeometry(panelW * 2, 12, 60), M.alcove); plat.position.set(0, 6, -30); plat.receiveShadow = true; plat.castShadow = true; alcove.add(plat);
  const scroll = new THREE.Mesh(new THREE.PlaneGeometry(38, 120), new THREE.MeshStandardMaterial({ map: scrollTex(), roughness: 0.9 })); scroll.position.set(-30, 128, -59); alcove.add(scroll);
  const ike = buildIkebana(M); ike.position.set(28, 12, -30); alcove.add(ike);
  // andon lamp on the floor in front of the shoji
  const andon = buildAndon(M); g.add(andon); andon.position.set(o.andonX ?? 190, 0, wallZ + 60);
  const lamp = new THREE.PointLight(0xffb060, 1, 0, 2); lamp.position.set(0, 52, 0); andon.add(lamp);
  // a floor cushion (zabuton) where the player sits
  const cushion = new THREE.Mesh(new THREE.BoxGeometry(55, 7, 60, 4, 1, 4), M.cushion); cushion.geometry.attributes.position.array.forEach(() => {}); cushion.position.set(o.cushionX ?? 150, 3.5, o.cushionZ ?? 70); cushion.castShadow = true; cushion.receiveShadow = true; g.add(cushion);
  return { group: g, wall, andon, lamp, cushion, ikebana: ike };
}
function scrollTex() {
  return canvasTex(128, 400, (g, w, h) => {
    g.fillStyle = '#2b3a33'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#efe4c8'; g.fillRect(12, 40, w - 24, h - 90);
    g.strokeStyle = 'rgba(30,20,10,0.75)'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(30, 230); g.quadraticCurveTo(60, 150, 100, 120); g.stroke();                      // a single ink branch
    for (let i = 0; i < 5; i++) { g.fillStyle = 'rgba(180,40,40,0.75)'; g.beginPath(); g.arc(50 + i * 11, 190 - i * 15, 3.5, 0, TAU); g.fill(); }
    g.fillStyle = '#7b2b22'; g.fillRect(w - 34, h - 110, 12, 12);
    g.fillStyle = '#5a3a20'; g.fillRect(0, h - 14, w, 14); g.fillRect(0, 0, w, 10);
  });
}
function buildIkebana(M) {
  const g = new THREE.Group();
  const pts = []; for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push(new THREE.Vector2(6 + 9 * Math.sin(Math.PI * Math.min(1, t * 1.15)) * (1 - t * 0.5) + (t > 0.85 ? 3 : 0), t * 22)); }
  const vase = new THREE.Mesh(new THREE.LatheGeometry(pts, 28), M.vase); vase.castShadow = true; vase.receiveShadow = true; g.add(vase);
  const branch = (from, dirs, r) => {
    let p = from.clone();
    for (const d of dirs) {
      const q = p.clone().add(d);
      const c = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.75, r, d.length(), 6), M.branch);
      c.position.copy(p).add(q).multiplyScalar(0.5); c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.clone().normalize()); c.castShadow = true; g.add(c);
      p = q; r *= 0.75;
    }
    return p;
  };
  const tipA = branch(new THREE.Vector3(0, 20, 0), [new THREE.Vector3(-4, 22, 2), new THREE.Vector3(-10, 20, 0), new THREE.Vector3(-14, 10, -2)], 1.3);
  const tipB = branch(new THREE.Vector3(1, 20, 0), [new THREE.Vector3(6, 16, 1), new THREE.Vector3(12, 8, 2)], 1.0);
  const tipC = branch(new THREE.Vector3(0, 20, 1), [new THREE.Vector3(2, 9, 4), new THREE.Vector3(5, 3, 6)], 0.8);
  const bl = new THREE.SphereGeometry(1, 8, 6);
  const at = [tipA, tipB, tipC, new THREE.Vector3(-8, 50, 1), new THREE.Vector3(-12, 58, 2), new THREE.Vector3(-20, 62, 0), new THREE.Vector3(4, 33, 1), new THREE.Vector3(10, 40, 2), new THREE.Vector3(-3, 44, 2)];
  at.forEach((p, i) => { for (let k = 0; k < 4; k++) { const b = new THREE.Mesh(bl, M.blossom); b.scale.setScalar(1.6 + hash(i * 7 + k) * 0.9); b.position.copy(p).add(new THREE.Vector3((hash(i + k * 3) - 0.5) * 5, (hash(i * 2 + k) - 0.5) * 4, (hash(i * 5 + k) - 0.5) * 4)); g.add(b); } });
  const lg = new THREE.PlaneGeometry(3, 7);
  for (let i = 0; i < 8; i++) { const l = new THREE.Mesh(lg, M.leaf); l.position.set(-3 + 6 * hash(i), 22 + 4 * hash(i + 1), -2 + 4 * hash(i + 2)); l.rotation.set(hash(i + 3) * 1.4, hash(i + 4) * 6, 0.6 + hash(i + 5)); g.add(l); }
  return g;
}
function buildAndon(M) {
  const g = new THREE.Group();
  const frame = new THREE.BoxGeometry(2.2, 70, 2.2);
  for (const [x, z] of [[-14, -14], [14, -14], [-14, 14], [14, 14]]) { const m = new THREE.Mesh(frame, M.beam); m.position.set(x, 35, z); m.castShadow = true; g.add(m); }
  const paper = new THREE.Mesh(new THREE.BoxGeometry(26, 44, 26), M.andon); paper.position.set(0, 46, 0); g.add(paper);
  const base = new THREE.Mesh(new THREE.BoxGeometry(32, 3, 32), M.beam); base.position.set(0, 1.5, 0); g.add(base);
  const top = new THREE.Mesh(new THREE.BoxGeometry(32, 2, 32), M.beam); top.position.set(0, 70, 0); g.add(top);
  return g;
}

// ---------------------------------------------------------------- lights
export function buildLights(scene) {
  const hemi = new THREE.HemisphereLight(0xffe2b8, 0x2a1f18, 0.55); scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffd6a0, 2.4); key.castShadow = true; scene.add(key); scene.add(key.target);
  key.shadow.bias = -0.0004; key.shadow.normalBias = 0.6;
  const rim = new THREE.DirectionalLight(0xa8c4ff, 0.5); scene.add(rim); scene.add(rim.target);
  const fill = new THREE.DirectionalLight(0xffc890, 0.35); scene.add(fill); scene.add(fill.target);
  return { hemi, key, rim, fill };
}

// dust motes in the lamp light (cm, around the origin)
export function buildMotes(n = 70, spread = 220) {
  const geo = new THREE.BufferGeometry(), a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { a[i * 3] = (hash(i) - 0.5) * spread; a[i * 3 + 1] = 10 + hash(i + 9) * 120; a[i * 3 + 2] = (hash(i + 17) - 0.5) * spread; }
  geo.setAttribute('position', new THREE.BufferAttribute(a.slice(), 3));
  const dot = canvasTex(32, 32, (g) => { const r = g.createRadialGradient(16, 16, 0, 16, 16, 16); r.addColorStop(0, 'rgba(255,230,180,1)'); r.addColorStop(1, 'rgba(255,230,180,0)'); g.fillStyle = r; g.fillRect(0, 0, 32, 32); });
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 1.6, map: dot, transparent: true, depthWrite: false, opacity: 0.55, blending: THREE.AdditiveBlending }));
  pts.userData.base = a; return pts;
}

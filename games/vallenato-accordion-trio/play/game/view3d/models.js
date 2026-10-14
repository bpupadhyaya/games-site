// Sculpted models for Vallenato Accordion Trio: a diatonic accordion (lacquer end boxes, chrome guards, pearl buttons, real pleated
// bellows), a caja vallenata (tapered wooden shell, rope lugs, skin head) and a guacharaca (ridged cane tube + steel fork).
// Everything is built in the unit it is asked for (the play page uses virtual screen units, the icon uses metres-ish), faces +Z.
import * as THREE from '../vendor3d/three.js';
import * as B from '../vendor3d/board3d.js';

const TAU = Math.PI * 2;
function cv(w, h = w) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function tex(c, rep) { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); } return t; }
export function rngOf(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

let M = null;
export function mats() {
  if (M) return M;
  const phys = (color, o = {}) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.1, ...o });
  // drum skin: warm cream with fibre grain
  const sk = cv(512), x = sk.getContext('2d'), r = rngOf(5);
  const g = x.createRadialGradient(200, 190, 20, 256, 256, 300); g.addColorStop(0, '#fff6e0'); g.addColorStop(0.7, '#ecd29c'); g.addColorStop(1, '#b8934f'); x.fillStyle = g; x.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 2600; i++) { x.strokeStyle = r() < 0.5 ? 'rgba(120,84,30,0.07)' : 'rgba(255,250,235,0.1)'; x.lineWidth = 1; x.beginPath(); const a = r() * 512, b = r() * 512, l = 6 + r() * 26, an = r() * TAU; x.moveTo(a, b); x.lineTo(a + Math.cos(an) * l, b + Math.sin(an) * l); x.stroke(); }
  // painted bands on the shell
  const sh = cv(256, 512), sx = sh.getContext('2d');
  const sg = sx.createLinearGradient(0, 0, 0, 512); sg.addColorStop(0, '#c98a46'); sg.addColorStop(1, '#8e5424'); sx.fillStyle = sg; sx.fillRect(0, 0, 256, 512);
  for (let i = 0; i < 40; i++) { sx.fillStyle = `rgba(${r() < 0.5 ? '60,28,8' : '255,220,160'},${0.04 + r() * 0.08})`; sx.fillRect(0, r() * 512, 256, 1 + r() * 3); }
  sx.fillStyle = '#ff6b57'; sx.fillRect(0, 205, 256, 30); sx.fillStyle = '#fff1d6'; sx.fillRect(0, 248, 256, 14); sx.fillStyle = '#35d6c6'; sx.fillRect(0, 276, 256, 36);
  sx.fillStyle = 'rgba(40,16,4,0.5)'; for (let i = 0; i < 16; i++) sx.fillRect(i * 16, 0, 2, 512);
  // cane for the guacharaca
  const cn = cv(512, 256), cx2 = cn.getContext('2d');
  const cg = cx2.createLinearGradient(0, 0, 0, 256); cg.addColorStop(0, '#9c6a2a'); cg.addColorStop(0.5, '#d8a95a'); cg.addColorStop(1, '#8a5a22'); cx2.fillStyle = cg; cx2.fillRect(0, 0, 512, 256);
  for (let i = 0; i < 260; i++) { cx2.fillStyle = `rgba(${r() < 0.5 ? '70,38,8' : '255,226,160'},${0.05 + r() * 0.1})`; cx2.fillRect(r() * 512, 0, 1 + r() * 2, 256); }
  for (const nx of [90, 400]) { cx2.fillStyle = 'rgba(60,34,8,0.55)'; cx2.fillRect(nx, 0, 5, 256); }
  M = {
    lacquer: phys('#a8152f', { roughness: 0.26 }),
    lacquerDark: phys('#4a0a18', { roughness: 0.3 }),
    chrome: new THREE.MeshStandardMaterial({ color: '#eef2f4', metalness: 1, roughness: 0.14 }),
    brass: new THREE.MeshStandardMaterial({ color: '#d9a640', metalness: 0.95, roughness: 0.28 }),
    pearl: phys('#efe2c8', { roughness: 0.18, sheen: 1, sheenColor: new THREE.Color('#ffd7e6'), sheenRoughness: 0.4 }),
    pearlLit: phys('#ffe9a8', { roughness: 0.2, emissive: '#ffb830', emissiveIntensity: 0.55 }),
    cream: new THREE.MeshStandardMaterial({ color: '#f1e2bd', roughness: 0.5, side: THREE.DoubleSide, flatShading: true }),
    bellowsA: new THREE.MeshStandardMaterial({ color: '#c0243f', roughness: 0.62, side: THREE.DoubleSide, flatShading: true }),
    bellowsB: new THREE.MeshStandardMaterial({ color: '#7a1029', roughness: 0.6, side: THREE.DoubleSide, flatShading: true }),
    leather: new THREE.MeshStandardMaterial({ color: '#2a1a12', roughness: 0.7 }),
    felt: new THREE.MeshStandardMaterial({ color: '#12090c', roughness: 0.95 }),
    skin: new THREE.MeshStandardMaterial({ map: tex(sk), roughness: 0.62, bumpMap: tex(sk), bumpScale: 0.6 }),
    shell: new THREE.MeshStandardMaterial({ map: tex(sh), roughness: 0.5 }),
    rope: new THREE.MeshStandardMaterial({ color: '#f2dfb2', roughness: 0.8 }),
    cane: new THREE.MeshStandardMaterial({ map: tex(cn), roughness: 0.42 }),
    steel: new THREE.MeshStandardMaterial({ color: '#d5dbe0', metalness: 1, roughness: 0.22 }),
    handle: new THREE.MeshStandardMaterial({ color: '#7a3f16', roughness: 0.5 }),
    wood: B.material('darkWood', { color: '#3a2112', color2: '#5e3a1c', repeat: [3, 1], seed: 13 }),
    woodLight: B.material('wood', { color: '#8a5528', color2: '#c28a46', repeat: [3, 1], seed: 41 }),
  };
  return M;
}

// ---- pleated bellows --------------------------------------------------------------------------------------------------------------
// A rectangular tube along x whose cross-section pulses in and out at every fold, like the real thing: the top and bottom outlines
// zig-zag, and the front facets tilt alternately so they catch the light in turn. Faces +Z. setOpen(0..1): 0 = squeezed (deep folds).
export function makeBellows({ w, h, n = 12, depth = 0.8, matA } = {}) {
  const m = mats(), g = new THREE.Group(), A = matA ?? m.bellowsA;
  const geo = new THREE.BufferGeometry(), faces = 4, quads = n * faces, pos = new Float32Array(quads * 6 * 3);
  const col = new Float32Array(quads * 6 * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = A.clone(); mat.vertexColors = true; mat.flatShading = false;
  const mesh = new THREE.Mesh(geo, mat); g.add(mesh);
  const pitch = w / n, hd = h * depth * 0.5;
  const ring = (i, f) => { const k = i % 2 ? 1 : 1 - f; return [-w / 2 + i * pitch, (h / 2) * k, hd * k]; };
  g.userData.setOpen = (open) => {
    const f = 0.34 - 0.18 * open;
    let o = 0, oc = 0;
    const put = (x, y, z, k = 1) => { pos[o++] = x; pos[o++] = y; pos[o++] = z; col[oc++] = k; col[oc++] = k; col[oc++] = k; };
    for (let i = 0; i < n; i++) {
      const [x0, y0, z0] = ring(i, f), [x1, y1, z1] = ring(i + 1, f);
      // corners: [sy, sz] around the tube; each pair of neighbours is one side
      const C = [[-1, 1], [1, 1], [1, -1], [-1, -1]];     // front-bottom, front-top, back-top, back-bottom
      for (let c = 0; c < 4; c++) {
        const [ay, az] = C[c], [by, bz] = C[(c + 1) % 4];
        const p00 = [x0, ay * y0, az * z0], p01 = [x0, by * y0, bz * z0], p10 = [x1, ay * y1, az * z1], p11 = [x1, by * y1, bz * z1];
        const k0 = i % 2 ? 1.0 : 0.42, k1 = i % 2 ? 0.42 : 1.0;      // crests lit, valleys in shadow
        put(...p00, k0); put(...p10, k1); put(...p01, k0); put(...p01, k0); put(...p10, k1); put(...p11, k1);
      }
    }
    geo.attributes.position.needsUpdate = true; geo.computeVertexNormals(); geo.computeBoundingSphere();
  };
  g.userData.setOpen(0.5);
  g.userData.width = w; g.userData.height = h;
  return g;
}

// ---- pearl button (domed, in a chrome seat) -----------------------------------------------------------------------------------
export function makePearlButton(r) {
  const m = mats(), g = new THREE.Group();
  const dome = new THREE.Mesh(B.lathe([[0, 0], [r, 0], [r, r * 0.1], [r * 0.97, r * 0.2], [r * 0.78, r * 0.32], [r * 0.4, r * 0.4], [0, r * 0.42]], 28), m.pearl);
  dome.rotation.x = Math.PI / 2;
  const seat = new THREE.Mesh(new THREE.TorusGeometry(r * 1.06, r * 0.1, 10, 36), m.chrome); seat.position.z = r * 0.03;
  const well = new THREE.Mesh(new THREE.CircleGeometry(r * 1.12, 28), m.felt); well.position.z = -r * 0.02;
  g.add(well, seat, dome);
  g.userData = { dome, seat, r };
  return g;
}

// ---- the treble keyboard panel for the play page (units = screen units) ------------------------------------------------------
export function makeKeyboard(w, h) {
  const m = mats(), g = new THREE.Group();
  const rad = 30;
  const body = new THREE.Mesh(B.slab(w, h, 26, rad, 9, { seg: 4, per: 6 }), m.lacquer); body.rotation.x = Math.PI / 2; body.position.z = 0; g.add(body);
  // the chrome inlaid frame and fine brass line
  const frame = new THREE.Mesh(B.slab(w - 22, h - 22, 29, rad - 8, 2.5), m.chrome); frame.rotation.x = Math.PI / 2; g.add(frame);
  const inner = new THREE.Mesh(B.slab(w - 30, h - 30, 31, rad - 12, 4, { seg: 3 }), m.lacquer); inner.rotation.x = Math.PI / 2; g.add(inner);
  const line = new THREE.Mesh(B.slab(w - 54, h - 54, 32, rad - 22, 0.8), m.brass); line.rotation.x = Math.PI / 2; g.add(line);
  const core = new THREE.Mesh(B.slab(w - 58, h - 58, 33, rad - 24, 3, { seg: 3 }), m.lacquerDark); core.rotation.x = Math.PI / 2; g.add(core);
  g.userData.top = 33;
  return g;
}

// ---- caja (head circle in the xy plane facing +Z; the caller tilts it) --------------------------------------------------------
export function makeCaja(rx, len) {
  const m = mats(), g = new THREE.Group(), local = new THREE.Group(); g.add(local);
  const bot = rx * 0.68;
  const prof = [[bot, -len], [bot * 1.02, -len * 0.96], [bot * 1.05, -len * 0.7], [(bot + rx) / 2 * 1.04, -len * 0.4], [rx * 1.0, -len * 0.06], [rx * 1.02, -len * 0.02], [rx * 1.0, 0]];
  const shell = new THREE.Mesh(B.lathe(prof, 40), m.shell); shell.rotation.x = Math.PI / 2; shell.castShadow = true; local.add(shell);
  // lathe axis is Y; rotating +90deg about X sends +Y to +Z (head toward the viewer), -Y (the foot) to -Z
  const head = new THREE.Mesh(new THREE.CylinderGeometry(rx * 0.97, rx * 0.97, rx * 0.06, 48), m.skin); head.rotation.x = Math.PI / 2; head.position.z = rx * 0.02; local.add(head);
  const hoop = new THREE.Mesh(new THREE.TorusGeometry(rx * 1.0, rx * 0.055, 12, 56), m.chrome); hoop.position.z = rx * 0.05; local.add(hoop);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(rx * 1.03, rx * 0.04, 10, 56), m.wood); rim.position.z = -rx * 0.01; local.add(rim);
  // seam of the two playing zones
  const seam = new THREE.Mesh(new THREE.BoxGeometry(rx * 0.012, rx * 1.9, rx * 0.01), new THREE.MeshStandardMaterial({ color: '#7a5420', roughness: 0.8 })); seam.position.z = rx * 0.052; local.add(seam);
  // rope lugs
  const ropes = new THREE.Group();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU, c = Math.cos(a), s = Math.sin(a);
    const cur = new THREE.CatmullRomCurve3([new THREE.Vector3(c * rx * 1.03, s * rx * 1.03, rx * 0.05), new THREE.Vector3(c * rx * 1.07, s * rx * 1.07, -len * 0.12), new THREE.Vector3(c * bot * 1.1, s * bot * 1.1, -len * 0.78)]);
    const t = new THREE.Mesh(new THREE.TubeGeometry(cur, 14, rx * 0.028, 6), m.rope); ropes.add(t);
    const knot = new THREE.Mesh(new THREE.SphereGeometry(rx * 0.05, 10, 8), m.rope); knot.position.copy(cur.getPoint(0)); ropes.add(knot);
  }
  local.add(ropes);
  // the two playing-zone flashes (additive half discs)
  const half = (flip, col) => {
    const geo = new THREE.CircleGeometry(rx * 0.92, 32, flip ? Math.PI / 2 : -Math.PI / 2, Math.PI);
    const mat = new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    const mesh = new THREE.Mesh(geo, mat); mesh.position.z = rx * 0.058; mesh.renderOrder = 4; return mesh;
  };
  const tumFx = half(true, '#ffb02e'), takFx = half(false, '#ff6b57'); local.add(tumFx, takFx);
  g.userData = { tumFx, takFx, head, local, rx, len };
  return g;
}

// ---- guacharaca ----------------------------------------------------------------------------------------------------------------
export function makeGuacharaca(len, rad) {
  const m = mats(), g = new THREE.Group();
  const tube = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad * 0.95, len, 36, 1), m.cane); tube.rotation.z = Math.PI / 2; g.add(tube);
  // raised ridges (instanced rings): what the fork actually scrapes
  const n = Math.max(12, Math.floor(len / (rad * 0.34)));
  const ridge = new THREE.InstancedMesh(new THREE.TorusGeometry(rad * 1.0, rad * 0.045, 6, 28), new THREE.MeshStandardMaterial({ color: '#7a4c1a', roughness: 0.5 }), n);
  const d = new THREE.Object3D();
  for (let i = 0; i < n; i++) { d.position.set(-len * 0.4 + (i / (n - 1)) * len * 0.8, 0, 0); d.rotation.set(0, Math.PI / 2, 0); d.updateMatrix(); ridge.setMatrixAt(i, d.matrix); }
  g.add(ridge);
  for (const sx of [-1, 1]) {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(rad * 1.02, 20, 14, 0, TAU, 0, Math.PI / 2), m.wood); cap.rotation.z = sx * -Math.PI / 2; cap.position.x = sx * len / 2; g.add(cap);
  }
  // fork: handle + three prongs, pivoting at the tube surface
  const fork = new THREE.Group();
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(rad * 0.13, rad * 0.16, rad * 2.0, 12), m.handle); handle.position.y = rad * 1.9; fork.add(handle);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(rad * 0.06, rad * 0.06, rad * 1.2, 8), m.steel); shaft.position.y = rad * 0.6; fork.add(shaft);
  const bar = new THREE.Mesh(new THREE.BoxGeometry(rad * 0.62, rad * 0.06, rad * 0.06), m.steel); bar.position.y = rad * 0.02; fork.add(bar);
  for (const dx of [-0.26, 0, 0.26]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(rad * 0.025, rad * 0.025, rad * 0.7, 6), m.steel); p.position.set(dx * rad, -rad * 0.3, 0); fork.add(p); }
  fork.position.set(0, 0, rad * 1.0);
  g.add(fork);
  g.userData = { fork, len, rad };
  return g;
}

// ---- accordion hero (title + icon): lacquer end boxes, chrome guards, pearl buttons, breathing bellows ------------------------
export function makeAccordion(w) {
  const m = mats(), g = new THREE.Group();
  const bh = w * 0.34, bd = bh * 0.82, boxW = w * 0.2;
  const boxGeo = B.roundedBox(boxW, bh, bd, boxW * 0.12, 6);
  const mkBox = (sx) => {
    const box = new THREE.Group(), body = new THREE.Mesh(boxGeo, m.lacquer); box.add(body);
    for (const cx of [-1, 1]) for (const cy of [-1, 1]) {
      const c = new THREE.Mesh(B.roundedBox(boxW * 0.2, boxW * 0.2, bd * 1.02, boxW * 0.06, 3), m.chrome);
      c.position.set(cx * (boxW / 2 - boxW * 0.1), cy * (bh / 2 - boxW * 0.1), 0); box.add(c);
    }
    // brass trim line on the front face
    const trim = new THREE.Mesh(B.roundedBox(boxW * 0.76, bh * 0.86, 0.01, boxW * 0.08, 3), m.brass); trim.position.z = bd / 2 + 0.002; box.add(trim);
    const face = new THREE.Mesh(B.roundedBox(boxW * 0.72, bh * 0.82, 0.012, boxW * 0.07, 3), m.lacquerDark); face.position.z = bd / 2 + 0.005; box.add(face);
    return box;
  };
  const L = mkBox(-1), R = mkBox(1);
  L.position.x = -w / 2 + boxW / 2; R.position.x = w / 2 - boxW / 2; g.add(L, R);
  // grille (bass side): brass rosette holes
  for (let i = 0; i < 3; i++) for (let j = 0; j < 4; j++) {
    const h = new THREE.Mesh(new THREE.TorusGeometry(boxW * 0.07, boxW * 0.018, 8, 20), m.brass); h.position.set(L.position.x + (i - 1) * boxW * 0.2, (j - 1.5) * bh * 0.18, bd / 2 + 0.012); g.add(h);
  }
  // pearl buttons (treble side), three rows of five
  const pr = boxW * 0.062;
  for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) {
    const b = makePearlButton(pr); b.position.set(R.position.x + (c - 1.5) * boxW * 0.17, (r - 1) * bh * 0.26 + (c % 2 ? bh * 0.04 : -bh * 0.04), bd / 2 + 0.012); g.add(b);
  }
  // straps
  const strap = new THREE.Mesh(B.roundedBox(boxW * 0.12, bh * 1.04, bd * 1.06, boxW * 0.03, 3), m.leather); strap.position.set(R.position.x + boxW * 0.38, 0, 0); g.add(strap);
  const strap2 = strap.clone(); strap2.position.x = L.position.x - boxW * 0.38; g.add(strap2);
  const bell = makeBellows({ w: w - boxW * 1.8, h: bh * 0.9, n: 13, depth: 0.8 }); bell.position.set(0, 0, -bd * 0.05); g.add(bell);
  g.userData = { bell, boxW, bh, bd, setOpen: bell.userData.setOpen };
  return g;
}

// ---- patio set pieces -------------------------------------------------------------------------------------------------------------
export function makeLantern(s) {
  const m = mats(), g = new THREE.Group();
  const body = new THREE.Mesh(B.lathe([[0, -1], [0.55, -1], [0.62, -0.9], [0.8, -0.2], [0.85, 0.3], [0.7, 0.85], [0.25, 1.0], [0, 1.02]].map(([r, y]) => [r * s * 0.5, y * s * 0.5]), 20), new THREE.MeshStandardMaterial({ color: '#ffcf80', emissive: '#ff9a3a', emissiveIntensity: 1.1, roughness: 0.4, transparent: true, opacity: 0.95 }));
  g.add(body);
  for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; const rib = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.016, s * 0.016, s, 5), m.brass); rib.position.set(Math.cos(a) * s * 0.4, 0, Math.sin(a) * s * 0.4); g.add(rib); }
  const capT = new THREE.Mesh(new THREE.CylinderGeometry(0, s * 0.34, s * 0.3, 14), m.brass); capT.position.y = s * 0.62; g.add(capT);
  const capB = new THREE.Mesh(new THREE.CylinderGeometry(s * 0.2, s * 0.26, s * 0.14, 14), m.brass); capB.position.y = -s * 0.56; g.add(capB);
  g.userData.body = body;
  return g;
}

// a palm frond: a tapered, drooping ribbon of leaflets
export function makeFrond(len, wid, seed = 1) {
  const r = rngOf(seed), segs = 12, pos = [], idx = [];
  const spine = (t) => ({ x: t * len, y: Math.sin(t * Math.PI * 0.8) * len * 0.22 - t * t * len * 0.35 });
  for (let i = 0; i <= segs; i++) {
    const t = i / segs, p = spine(t), w2 = wid * Math.sin(Math.min(1, t * 1.15) * Math.PI) * (1 - t * 0.2) * (0.85 + r() * 0.3);
    pos.push(p.x, p.y, -w2 * 0.5, p.x, p.y + w2 * 0.1, w2 * 0.5);
  }
  for (let i = 0; i < segs; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 2, a + 1, a + 3); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
  return new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: '#0f5a3e', roughness: 0.65, side: THREE.DoubleSide }));
}
export function makePalm(h, seed = 4) {
  const g = new THREE.Group(), r = rngOf(seed);
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(h * 0.014, h * 0.024, h, 10), new THREE.MeshStandardMaterial({ color: '#2b1c10', roughness: 0.9 }));
  trunk.position.y = h / 2; g.add(trunk);
  const crown = new THREE.Group(); crown.position.y = h; g.add(crown);
  for (let i = 0; i < 9; i++) {
    const f = makeFrond(h * (0.42 + r() * 0.12), h * 0.07, seed + i); f.rotation.y = (i / 9) * TAU + r() * 0.3; f.rotation.z = (r() - 0.3) * 0.5; crown.add(f);
  }
  g.userData.crown = crown;
  return g;
}

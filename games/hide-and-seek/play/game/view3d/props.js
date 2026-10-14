// The sixteen hiding places as lit 3D props at REAL size (metres): an arch 2.8 m high, a barrel 0.95 m, a washing line 2.4 m wide.
// Each builder returns { group, top (height in metres), update(t) } and is built once per place. Heights matter: a crouching child
// (0.75 m) hides behind a barrel stack or a cart, a standing one (1.25 m) does not.
import { THREE, B, mat, wood, darkWood, stoneM, clayM, clothM, canvasTex, cv, put, box, rbox, cyl, sph, lathe, plane, tube, rock, clothPlane, rnd, rngSeed, TAU, lerp } from './kit.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const group = () => new THREE.Group();

function sway(list) { return (t) => { for (const f of list) f(t); }; }

// ---------------------------------------------------------------------------------------------------------- stone arch
function arch(T) {
  const g = group(), S = stoneM('#a99a82', '#d3c7ae', { repeat: [2, 2], seed: 12 });
  const W = 2.3, Hh = 2.8, D = 0.8, ow = 1.15, oh = 2.0;
  const sh = new THREE.Shape();
  sh.moveTo(-W / 2, 0); sh.lineTo(W / 2, 0); sh.lineTo(W / 2, Hh - 0.5);
  sh.quadraticCurveTo(W / 2, Hh, W / 2 - 0.5, Hh); sh.lineTo(-W / 2 + 0.5, Hh); sh.quadraticCurveTo(-W / 2, Hh, -W / 2, Hh - 0.5); sh.lineTo(-W / 2, 0);
  const hole = new THREE.Path();
  hole.moveTo(-ow / 2, 0); hole.lineTo(-ow / 2, oh - ow / 2); hole.absarc(0, oh - ow / 2, ow / 2, Math.PI, 0, true); hole.lineTo(ow / 2, 0); hole.lineTo(-ow / 2, 0);
  sh.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(sh, { depth: D, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 2, curveSegments: 14 });
  geo.translate(0, 0, -D / 2);
  // stone course lines: bake as texture via mesh uv is skipped; add ridge strips instead
  put(g, new THREE.Mesh(geo, S), 0, 0, 0);
  // dark passage behind the opening
  put(g, box(ow + 0.04, oh, 0.1, mat('#150f1a', { rough: 1 })), 0, oh / 2 - 0.02, -D / 2 + 0.2);
  put(g, new THREE.Mesh(new THREE.CircleGeometry(ow / 2, 18, 0, Math.PI), mat('#150f1a', { rough: 1 })), 0, oh - ow / 2, -D / 2 + 0.2);
  // keystone, plinth and cornice
  put(g, rbox(0.34, 0.5, D + 0.16, 0.04, stoneM('#bdb097', '#e0d6bf', { seed: 4 })), 0, oh + 0.12, 0);
  put(g, rbox(W + 0.3, 0.2, D + 0.3, 0.05, S), 0, 0.1, 0);
  put(g, rbox(W + 0.24, 0.22, D + 0.24, 0.05, S), 0, Hh + 0.02, 0);
  // an iron lantern hung in the opening
  const lan = group();
  put(lan, cyl(0.005, 0.005, 0.4, mat('#222', { metal: 0.8 }), 6), 0, 0.2, 0);
  put(lan, rbox(0.2, 0.26, 0.2, 0.03, mat('#ffe2a0', { emissive: '#ffb64a', ei: 1.6, rough: 0.4 })), 0, -0.05, 0);
  put(lan, cyl(0.0, 0.16, 0.1, mat('#2a2a2e', { metal: 0.7 }), 8), 0, 0.14, 0);
  lan.position.set(0.0, oh + 0.18, D / 2 + 0.1);
  lan.position.y = Hh - 0.2; lan.position.x = 0; lan.position.z = D / 2 + 0.12; lan.children.forEach((c) => { c.position.y -= 0.0; });
  // lantern hangs in front of the keystone, to the left of the opening
  lan.position.set(-W / 2 + 0.18, 2.3, D / 2 + 0.1);
  g.add(lan);
  const glow = new THREE.PointLight('#ffb862', 0.0, 4.5, 2); glow.position.set(-W / 2 + 0.2, 2.1, D / 2 + 0.4); g.add(glow);
  return { group: g, top: Hh, w: W, update: (t) => { lan.rotation.z = Math.sin(t * 1.3) * 0.04; }, lightOn: (k) => { glow.intensity = k * 6; } };
}

// ---------------------------------------------------------------------------------------------------------- fountain
function fountain(T) {
  const g = group(), S = stoneM('#b3ab98', '#dcd5c2', { seed: 22 });
  const water = mat('#5fb4d6', { rough: 0.08, metal: 0.1, opacity: 0.82, emissive: '#2a6c8c', ei: 0.35 });
  put(g, lathe([[0, 0], [1.28, 0], [1.34, 0.06], [1.36, 0.44], [1.26, 0.5], [1.18, 0.46], [1.14, 0.1], [0, 0.1]], S, 36), 0, 0, 0);
  const wtr = put(g, new THREE.Mesh(new THREE.CircleGeometry(1.15, 32), water), 0, 0.4, 0); wtr.rotation.x = -Math.PI / 2; wtr.castShadow = false;
  put(g, lathe([[0, 0.1], [0.2, 0.1], [0.14, 0.5], [0.12, 1.0], [0.18, 1.1], [0.34, 1.15], [0.62, 1.22], [0.64, 1.32], [0.56, 1.3], [0.36, 1.22], [0, 1.22]], S, 28), 0, 0, 0);
  const wtr2 = put(g, new THREE.Mesh(new THREE.CircleGeometry(0.56, 24), water), 0, 1.27, 0); wtr2.rotation.x = -Math.PI / 2; wtr2.castShadow = false;
  put(g, lathe([[0, 1.22], [0.07, 1.3], [0.05, 1.6], [0.1, 1.72], [0.0, 1.86]], S, 16), 0, 0, 0);
  // droplets: arcs falling from the top bowl into the basin
  const N = 36, pts = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ color: '#d8f2ff', size: 0.055, transparent: true, opacity: 0.85, depthWrite: false }));
  pts.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3)); g.add(pts);
  const drop = (t) => {
    const a = pts.geometry.attributes.position.array;
    for (let i = 0; i < N; i++) {
      const ph = ((t * 0.9 + i / N) % 1), ang = (i * 2.399) % TAU, r = 0.1 + ph * 0.5;
      a[i * 3] = Math.cos(ang) * r; a[i * 3 + 2] = Math.sin(ang) * r; a[i * 3 + 1] = 1.7 - 1.3 * ph * ph + (1 - ph) * 0.15;
      if (i % 3 === 0) { const rr = 0.5 + ph * 0.55; a[i * 3] = Math.cos(ang) * rr; a[i * 3 + 2] = Math.sin(ang) * rr; a[i * 3 + 1] = 1.25 - 0.85 * ph * ph; }
    }
    pts.geometry.attributes.position.needsUpdate = true;
  };
  // ripple rings on the basin
  const rings = [];
  for (let i = 0; i < 3; i++) { const r = new THREE.Mesh(new THREE.RingGeometry(0.9, 0.94, 40), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.4, depthWrite: false })); r.rotation.x = -Math.PI / 2; r.position.y = 0.42; g.add(r); rings.push(r); }
  return { group: g, top: 1.9, w: 2.7, update: (t) => { drop(t); rings.forEach((r, i) => { const ph = (t * 0.45 + i / 3) % 1; r.scale.setScalar(0.25 + ph * 1.0); r.material.opacity = 0.45 * (1 - ph); }); wtr.position.y = 0.4 + Math.sin(t * 1.7) * 0.004; } };
}

// ---------------------------------------------------------------------------------------------------------- curtain (doorway) / noren
function curtain(T, v) {
  const g = group(), noren = v === 'noren';
  const frame = noren ? darkWood('#3b2412', '#5a3a1e', { seed: 8 }) : wood('#8a5a34', '#b07a48', { seed: 6 });
  const W = noren ? 2.1 : 2.0, Hh = noren ? 2.3 : 2.5;
  put(g, box(0.16, Hh, 0.2, frame), -W / 2 - 0.08, Hh / 2, 0); put(g, box(0.16, Hh, 0.2, frame), W / 2 + 0.08, Hh / 2, 0);
  put(g, box(W + 0.5, 0.2, 0.26, frame), 0, Hh + 0.1, 0);
  put(g, box(W, 0.06, 0.34, mat('#2c2018', { rough: 0.9 })), 0, 0.03, 0);
  // the doorway interior: a dim lit room
  put(g, box(W, Hh, 0.06, mat(noren ? '#f1d8a0' : '#3a2a26', { emissive: noren ? '#ffbf6a' : '#6a3a28', ei: noren ? 0.7 : 0.35, rough: 1 })), 0, Hh / 2, -0.14);
  const cloths = [];
  if (!noren) {
    // a heavy red velvet curtain: two drapes tied back, folds from a vertical sine
    const red = mat('#b3262c', { rough: 0.85, side: 1 });
    const mk = (side) => {
      const m = clothPlane(W * 0.62, Hh - 0.1, red, { sx: 16, sy: 8 });
      m.position.set(side * (W * 0.19), Hh - 0.05, 0.06);
      m.scale.x = 1; g.add(m); cloths.push({ m, side });
    };
    mk(-1); mk(1);
    put(g, cyl(0.035, 0.035, W + 0.2, mat('#c8a24a', { metal: 0.9, rough: 0.3 }), 10), 0, Hh - 0.02, 0.1).rotation.z = Math.PI / 2;
    for (const s of [-1, 1]) put(g, sph(0.06, mat('#c8a24a', { metal: 0.9, rough: 0.3 })), s * (W / 2 + 0.12), Hh - 0.02, 0.1);
  } else {
    // noren: a short split cloth in indigo with a white band, hung from a pole, three slits; sways in the breeze
    const indigo = clothM('#1f3358', '#2b4678', { repeat: [3, 3] });
    const bar = put(g, cyl(0.03, 0.03, W + 0.1, darkWood('#2a1a0e', '#3a2412'), 10), 0, Hh - 0.04, 0.12); bar.rotation.z = Math.PI / 2;
    for (let i = 0; i < 3; i++) {
      const m = clothPlane(W / 3 - 0.04, 1.05, indigo, { sx: 4, sy: 6 });
      m.position.set(-W / 3 + i * (W / 3), Hh - 0.1, 0.14); g.add(m); cloths.push({ m, i, side: 0 });
      const band = new THREE.Mesh(new THREE.PlaneGeometry(W / 3 - 0.06, 0.12), mat('#f0ead8', { rough: 0.9, side: 1 })); band.position.set(0, -0.3, 0.004); m.add(band);
    }
    // a wooden bench + lantern beside
    put(g, rbox(0.9, 0.08, 0.34, 0.02, wood('#9a6a3a', '#c28f58')), W / 2 + 0.7, 0.42, 0.3);
    put(g, box(0.06, 0.4, 0.28, darkWood()), W / 2 + 0.35, 0.2, 0.3); put(g, box(0.06, 0.4, 0.28, darkWood()), W / 2 + 1.05, 0.2, 0.3);
  }
  return { group: g, top: Hh + 0.2, w: W + 0.6, update: (t) => { cloths.forEach((c, i) => c.m.userData.sway(t, noren ? 0.07 : 0.045, i * 1.3, noren ? 2.0 : 1.2)); } };
}

// ---------------------------------------------------------------------------------------------------------- cart
function wheel(r, W, m, iron) {
  const g = group();
  const rim = new THREE.Mesh(new THREE.TorusGeometry(r, 0.035, 8, 28), m); rim.rotation.y = Math.PI / 2; g.add(rim);
  const hub = cyl(0.07, 0.07, W, m, 12); hub.rotation.z = Math.PI / 2; g.add(hub);
  for (let i = 0; i < 8; i++) { const sp = box(0.035, r * 2 - 0.06, 0.035, m); sp.rotation.x = (i / 8) * Math.PI; g.add(sp); }
  const tire = new THREE.Mesh(new THREE.TorusGeometry(r + 0.02, 0.012, 6, 28), iron); tire.rotation.y = Math.PI / 2; g.add(tire);
  g.children.forEach((c) => { c.castShadow = true; });
  return g;
}
function cart(T, v) {
  const g = group(), hand = v === 'hand';
  const w1 = wood('#9a6a3a', '#c28f58', { seed: 11 }), w2 = darkWood('#5a3a1e', '#7a5232');
  const iron = mat('#2a2a2e', { metal: 0.7, rough: 0.5 });
  const r = hand ? 0.5 : 0.46;
  const bed = put(g, rbox(hand ? 1.7 : 1.9, 0.12, 1.0, 0.03, w1), 0, r + 0.1, 0);
  for (const s of [-1, 1]) put(g, rbox(hand ? 1.7 : 1.9, 0.42, 0.06, 0.02, w1), 0, r + 0.32, s * 0.5);
  put(g, rbox(0.06, 0.42, 1.0, 0.02, w1), -(hand ? 0.82 : 0.92), r + 0.32, 0); put(g, rbox(0.06, 0.42, 1.0, 0.02, w1), hand ? 0.82 : 0.92, r + 0.32, 0);
  for (const s of [-1, 1]) { const wh = wheel(r, 0.08, w2, iron); wh.position.set(0, r, s * 0.58); g.add(wh); }
  const ax = cyl(0.04, 0.04, 1.3, iron, 8); ax.rotation.x = Math.PI / 2; put(g, ax, 0, r, 0);
  // shafts and a prop leg
  for (const s of [-1, 1]) { const sh = put(g, box(1.0, 0.06, 0.06, w2), (hand ? 1.15 : 1.3), r - 0.04, s * 0.4); sh.rotation.z = 0.12; }
  put(g, cyl(0.03, 0.03, 0.5, w2, 8), hand ? 1.6 : 1.75, 0.24, 0);
  if (!hand) {
    // a red canvas canopy over hoops, open front
    const red = mat('#c8372b', { rough: 0.9, side: 1 }), cream = mat('#f1e6c8', { rough: 0.9, side: 1 });
    for (const x of [-0.75, 0, 0.75]) { const hp = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.025, 6, 18, Math.PI), w2); hp.position.set(x, r + 0.36, 0); hp.rotation.z = 0; hp.castShadow = true; g.add(hp); }
    const can = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 1.7, 22, 1, true, 0, Math.PI), red);
    can.rotation.z = Math.PI / 2; can.rotation.y = 0; can.position.set(0, r + 0.36, 0); can.rotation.order = 'YXZ'; can.rotation.set(0, 0, Math.PI / 2); can.castShadow = true; g.add(can);
    // stripes: thin cream planes
    for (let i = -2; i <= 2; i++) { const st = new THREE.Mesh(new THREE.CylinderGeometry(0.625, 0.625, 0.14, 22, 1, true, 0, Math.PI), cream); st.rotation.z = Math.PI / 2; st.position.set(i * 0.34, r + 0.36, 0); g.add(st); }
    // fruit crates on the bed
    for (let i = 0; i < 6; i++) put(g, sph(0.09, mat(i % 2 ? '#e8b92a' : '#e98a2a', { rough: 0.5 })), -0.5 + (i % 3) * 0.3, r + 0.2, -0.2 + Math.floor(i / 3) * 0.4);
  } else {
    // handcart: baskets and a bundle
    for (let i = 0; i < 3; i++) { const b = put(g, cyl(0.26, 0.2, 0.34, mat('#b8904e', { rough: 0.9 }), 14), -0.5 + i * 0.5, r + 0.34, 0.0 + (i % 2) * 0.1); b.rotation.y = i; }
    put(g, rbox(0.7, 0.3, 0.5, 0.1, mat('#d6c08a', { rough: 1 })), 0.2, r + 0.64, 0.05);
  }
  return { group: g, top: hand ? 1.3 : 1.65, w: hand ? 2.2 : 2.3, update: () => {} };
}

// ---------------------------------------------------------------------------------------------------------- barrels
function barrel(r, h, m, iron) {
  const g = group();
  const prof = [[0, 0], [r * 0.82, 0], [r * 0.9, h * 0.08], [r, h * 0.5], [r * 0.9, h * 0.92], [r * 0.82, h], [0, h]];
  g.add(lathe(prof, m, 20));
  for (const y of [0.1, 0.32, 0.68, 0.9]) { const k = 1 - Math.abs(y - 0.5) * 0.35; const b = new THREE.Mesh(new THREE.TorusGeometry(r * (k * 0.99 + 0.02), 0.014, 5, 26), iron); b.rotation.x = Math.PI / 2; b.position.y = h * y; g.add(b); }
  const lid = cyl(r * 0.8, r * 0.8, 0.03, mat('#6b4a26', { rough: 0.8 }), 20); lid.position.y = h; g.add(lid);
  g.children.forEach((c) => { c.castShadow = true; c.receiveShadow = true; });
  return g;
}
function barrels(T) {
  const g = group();
  const w = wood('#7a4f28', '#a8703f', { seed: 14, repeat: [2, 1] }), iron = mat('#2a2a2e', { metal: 0.8, rough: 0.45 });
  const pos = [[-0.42, 0, 0.1], [0.42, 0, 0.05], [0, 0, -0.5]];
  for (const [x, y, z] of pos) { const b = barrel(0.36, 0.95, w, iron); b.position.set(x, y, z); g.add(b); }
  const top = barrel(0.34, 0.9, w, iron); top.position.set(0, 0.95, -0.15); top.rotation.y = 0.4; g.add(top);
  // a ladle and a rope coil on the front barrel
  const rope = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.025, 6, 16), mat('#b89a64', { rough: 1 })); rope.rotation.x = Math.PI / 2; rope.position.set(0.5, 0.97, 0.12); rope.castShadow = true; g.add(rope);
  return { group: g, top: 1.85, w: 1.6, update: () => {} };
}

// ---------------------------------------------------------------------------------------------------------- plants
function foliageBlob(r, c0, c1, seed) {
  rngSeed(seed);
  const g = new THREE.SphereGeometry(r, 12, 9), p = g.attributes.position, col = [];
  const A = new THREE.Color(c0), Bc = new THREE.Color(c1), tmp = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const k = 0.8 + rnd() * 0.4; p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 0.9, p.getZ(i) * k);
    tmp.copy(A).lerp(Bc, clamp01((p.getY(i) / r + 1) / 2 + (rnd() - 0.5) * 0.4)); col.push(tmp.r, tmp.g, tmp.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals();
  return new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, flatShading: true }));
}
const clamp01 = (v) => Math.max(0, Math.min(1, v));
function leafCard(w, h, c0, c1) {
  const t = canvasTex(64, 128, (c, W, H) => {
    const gr = c.createLinearGradient(0, 0, W, 0); gr.addColorStop(0, c0); gr.addColorStop(0.5, c1); gr.addColorStop(1, c0);
    c.fillStyle = gr; c.beginPath(); c.moveTo(W / 2, 0); c.bezierCurveTo(W * 1.1, H * 0.25, W * 0.95, H * 0.75, W / 2, H); c.bezierCurveTo(W * 0.05, H * 0.75, -W * 0.1, H * 0.25, W / 2, 0); c.fill();
    c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(W / 2, 4); c.lineTo(W / 2, H - 4); c.stroke();
  });
  const m = new THREE.MeshStandardMaterial({ map: t, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.8 });
  const g = new THREE.PlaneGeometry(w, h); g.translate(0, h / 2, 0);
  return new THREE.Mesh(g, m);
}
function plant(T, v) {
  const g = group(), swayers = [];
  if (v === 'lemon' || !v) {
    const pot = lathe([[0, 0], [0.26, 0], [0.34, 0.06], [0.4, 0.46], [0.44, 0.5], [0.4, 0.54], [0.3, 0.52], [0, 0.5]], clayM('#a8573a', '#c97c55', { seed: 7 }), 24);
    put(g, pot, 0, 0, 0);
    const soil = put(g, new THREE.Mesh(new THREE.CircleGeometry(0.31, 18), mat('#3a2a1c', { rough: 1 })), 0, 0.52, 0); soil.rotation.x = -Math.PI / 2;
    put(g, tube([[0, 0.5, 0], [0.04, 1.0, 0.02], [-0.03, 1.5, 0]], 0.06, darkWood('#4a3020', '#6b4a2c'), 10, 7), 0, 0, 0);
    const crown = group(); crown.position.set(0, 1.9, 0); g.add(crown);
    const blobs = [[0, 0, 0, 0.75], [0.5, -0.2, 0.1, 0.5], [-0.5, -0.25, 0, 0.52], [0.1, 0.4, -0.2, 0.5], [0.05, -0.1, 0.5, 0.48]];
    blobs.forEach(([x, y, z, r], i) => { const b = foliageBlob(r, '#2f6a2a', '#78b84a', 31 + i); b.position.set(x, y, z); b.castShadow = true; b.receiveShadow = true; crown.add(b); });
    rngSeed(77);
    for (let i = 0; i < 9; i++) { const a = rnd() * TAU, rr = 0.55 + rnd() * 0.25; put(crown, sph(0.075, mat('#f3d531', { rough: 0.45 }), 10, 8), Math.cos(a) * rr, -0.4 + rnd() * 0.9, Math.sin(a) * rr).scale.set(1, 1.25, 1); }
    swayers.push((t) => { crown.rotation.z = Math.sin(t * 0.9) * 0.025; crown.rotation.x = Math.sin(t * 0.7 + 1) * 0.02; });
    return { group: g, top: 2.9, w: 1.8, update: sway(swayers) };
  }
  if (v === 'bamboo') {
    const stalk = mat('#9bb257', { rough: 0.55 }), node = mat('#6f8a3a', { rough: 0.6 });
    rngSeed(5);
    const stalks = [];
    for (let i = 0; i < 12; i++) {
      const a = rnd() * TAU, rr = rnd() * 0.5, hgt = 3.0 + rnd() * 1.4, lean = (rnd() - 0.5) * 0.12;
      const s = group(); s.position.set(Math.cos(a) * rr, 0, Math.sin(a) * rr); s.rotation.z = lean; s.rotation.x = (rnd() - 0.5) * 0.1;
      const rad = 0.035 + rnd() * 0.02;
      put(s, cyl(rad * 0.8, rad, hgt, stalk, 8), 0, hgt / 2, 0);
      for (let n = 1; n < 9; n++) put(s, cyl(rad * 1.18, rad * 1.18, 0.03, node, 8), 0, (n / 9) * hgt, 0);
      for (let k = 0; k < 3; k++) { const lf = leafCard(0.34, 0.9, '#3f7a2a', '#8cc255'); lf.position.set(0, hgt - 0.1 - k * 0.45, 0); lf.rotation.set(1.0 + rnd() * 0.4, rnd() * TAU, 0); lf.castShadow = true; s.add(lf); }
      g.add(s); stalks.push({ s, ph: rnd() * 6, lean });
    }
    swayers.push((t) => { for (const o of stalks) { o.s.rotation.z = o.lean + Math.sin(t * 0.8 + o.ph) * 0.03; } });
    return { group: g, top: 4.0, w: 1.6, update: sway(swayers) };
  }
  if (v === 'banana') {
    put(g, cyl(0.15, 0.2, 2.2, mat('#7aa04a', { rough: 0.7 }), 10), 0, 1.1, 0);
    put(g, cyl(0.11, 0.15, 1.6, mat('#86ad52', { rough: 0.7 }), 10), 0.55, 0.8, 0.1).rotation.z = -0.12;
    const leaves = [];
    for (let i = 0; i < 7; i++) {
      const lf = leafCard(0.7, 2.2, '#2f7a2a', '#7ac252'); const pivot = group(); pivot.position.set(0, 2.15, 0); pivot.rotation.y = (i / 7) * TAU; lf.rotation.x = 1.15 - (i % 3) * 0.12; lf.castShadow = true; pivot.add(lf); g.add(pivot); leaves.push({ lf, ph: i * 1.1, b: lf.rotation.x });
    }
    // a hanging bunch
    const bunch = group(); bunch.position.set(0.3, 1.7, 0.25);
    for (let i = 0; i < 9; i++) put(bunch, new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.2, 4, 8), mat('#d9c23a', { rough: 0.5 })), (i % 3) * 0.07 - 0.07, -0.18 - (i % 2) * 0.03, Math.floor(i / 3) * 0.07).rotation.z = 0.2;
    g.add(bunch);
    swayers.push((t) => { for (const o of leaves) o.lf.rotation.x = o.b + Math.sin(t * 1.1 + o.ph) * 0.05; });
    return { group: g, top: 3.4, w: 2.2, update: sway(swayers) };
  }
  // pine (garden pine): a leaning trunk and cloud-pruned pads
  const trunk = darkWood('#4a3226', '#6a4a36', { seed: 17 });
  put(g, tube([[0, 0, 0], [0.12, 0.7, 0.05], [-0.1, 1.4, 0.0], [0.2, 2.1, -0.05]], 0.14, trunk, 20, 8), 0, 0, 0);
  const pads = group(); g.add(pads);
  const spec = [[0.35, 2.15, 0, 0.8, 0.28], [-0.5, 1.55, 0.1, 0.65, 0.22], [0.15, 2.75, -0.1, 0.55, 0.2], [0.75, 1.3, 0.2, 0.5, 0.18]];
  spec.forEach(([x, y, z, r, th], i) => { const pad = foliageBlob(r, '#1f4a2a', '#4a8a45', 51 + i); pad.scale.set(1.25, th / r * 1.2, 1.1); pad.position.set(x, y, z); pad.castShadow = true; pads.add(pad); });
  put(g, rock(0.34, mat('#7a7a72', { rough: 0.95, flat: true }), 9), 0.6, 0.12, 0.5);
  swayers.push((t) => { pads.rotation.z = Math.sin(t * 0.7) * 0.012; });
  return { group: g, top: 3.1, w: 2.0, update: sway(swayers) };
}

// ---------------------------------------------------------------------------------------------------------- washing line / drying rack
function laundry(T, v) {
  const g = group(), rack = v === 'rack';
  const post = rack ? mat('#a8864a', { rough: 0.7 }) : darkWood('#5a3a1e', '#7a5232');
  const cl = [];
  const cols = rack ? ['#e8dcb8', '#3a6a9a', '#d8b050', '#f1ece0'] : ['#f1ece0', '#c8453a', '#3a6a9a', '#e8c24a', '#7bbf7a'];
  if (!rack) {
    const W = 2.3;
    for (const s of [-1, 1]) put(g, cyl(0.05, 0.07, 2.1, post, 8), s * W / 2, 1.05, 0);
    // sagging line
    const pts = []; for (let i = 0; i <= 12; i++) { const x = -W / 2 + (i / 12) * W; pts.push([x, 1.95 - Math.sin((i / 12) * Math.PI) * 0.12, 0]); }
    put(g, tube(pts, 0.008, mat('#c9b88a', { rough: 1 }), 24, 4), 0, 0, 0);
    const items = [[-0.8, 0.55, 0.8, 0], [-0.2, 0.45, 0.95, 1], [0.38, 0.6, 0.75, 2], [0.88, 0.4, 0.6, 3]];
    items.forEach(([x, w, h, ci], i) => {
      const m = clothPlane(w, h, clothM(cols[ci % cols.length], '#ffffff', { repeat: [2, 2] }), { sx: 6, sy: 6 });
      m.material.side = THREE.DoubleSide;
      const sag = 1.95 - Math.sin(((x + W / 2) / W) * Math.PI) * 0.12;
      m.position.set(x, sag - 0.02, 0); g.add(m); cl.push({ m, i });
    });
    // a child's small shirt and socks
    const sock = clothPlane(0.14, 0.3, clothM('#d8453a', '#ffffff'), { sx: 2, sy: 3 }); sock.material.side = THREE.DoubleSide; sock.position.set(1.0, 1.95 - 0.1, 0); g.add(sock); cl.push({ m: sock, i: 7 });
    // a woven basket below
    put(g, cyl(0.3, 0.24, 0.3, mat('#b8904e', { rough: 0.95 }), 14), -0.9, 0.15, 0.4);
    put(g, cyl(0.28, 0.28, 0.02, mat('#f1ece0', { rough: 1 }), 14), -0.9, 0.3, 0.4);
    return { group: g, top: 2.1, w: 3.0, update: (t) => cl.forEach((c) => c.m.userData.sway(t, 0.07, c.i * 1.7, 2.4)) };
  }
  // bamboo drying rack: two A-frames and two poles with sheets
  for (const s of [-1, 1]) { for (const d of [-1, 1]) { const leg = put(g, cyl(0.035, 0.04, 1.9, post, 8), s * 0.95, 0.9, d * 0.28); leg.rotation.x = -d * 0.13; } }
  for (const y of [1.78, 1.38]) { const p = put(g, cyl(0.03, 0.03, 2.2, post, 8), 0, y, 0); p.rotation.z = Math.PI / 2; }
  [[-0.5, 1.78, 0.9, 0.9, 0], [0.45, 1.78, 0.8, 1.0, 1], [0.0, 1.38, 1.6, 0.55, 3]].forEach(([x, y, w, h, ci], i) => {
    const m = clothPlane(w, h, clothM(cols[ci], '#ffffff', { repeat: [2, 2] }), { sx: 6, sy: 6 }); m.material.side = THREE.DoubleSide; m.position.set(x, y, 0.03); g.add(m); cl.push({ m, i });
  });
  return { group: g, top: 2.0, w: 2.4, update: (t) => cl.forEach((c) => c.m.userData.sway(t, 0.05, c.i * 1.3, 2.0)) };
}

// ---------------------------------------------------------------------------------------------------------- crates
function crates(T) {
  const g = group(), w1 = wood('#a8783e', '#cf9c5a', { seed: 21 }), w2 = wood('#8a5c2c', '#b88444', { seed: 22 });
  const crate = (s, m) => {
    const c = group();
    for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) put(c, box(0.06, s, 0.06, m), sx * (s / 2 - 0.03), s / 2, sz * (s / 2 - 0.03));
    for (let i = 0; i < 4; i++) { const y = 0.07 + i * (s - 0.14) / 3.3; for (const sg of [-1, 1]) { put(c, box(s, 0.1, 0.03, m), 0, y + 0.03, sg * (s / 2 - 0.015)); put(c, box(0.03, 0.1, s, m), sg * (s / 2 - 0.015), y + 0.03, 0); } }
    put(c, box(s - 0.04, 0.03, s - 0.04, m), 0, 0.02, 0);
    return c;
  };
  const place = [[-0.35, 0, 0.0, 0.62, 0.05, w1], [0.35, 0, 0.1, 0.6, -0.1, w2], [0, 0.62, 0.02, 0.58, 0.3, w1], [-0.1, 0, -0.6, 0.6, 0.15, w2], [0.6, 0.6, -0.5, 0.5, -0.2, w1]];
  place.forEach(([x, y, z, s, ry, m]) => { const c = crate(s, m); c.position.set(x, y, z); c.rotation.y = ry; g.add(c); });
  for (let i = 0; i < 5; i++) put(g, sph(0.085, mat(['#d8452c', '#e8a92a', '#6aaa3a'][i % 3], { rough: 0.5 })), -0.3 + i * 0.13, 1.18, 0.0 + (i % 2) * 0.1);
  return { group: g, top: 1.25, w: 1.7, update: () => {} };
}

// ---------------------------------------------------------------------------------------------------------- big water jar
function jar(T) {
  const g = group(), c = clayM('#9a5a3a', '#c07c50', { seed: 31, repeat: [2, 2] });
  const prof = [[0, 0], [0.3, 0], [0.45, 0.12], [0.58, 0.5], [0.6, 0.72], [0.48, 1.0], [0.34, 1.12], [0.36, 1.18], [0.3, 1.2], [0.0, 1.2]];
  put(g, lathe(prof, c, 28), 0, 0, 0);
  // a woven rope band and a glaze stripe
  for (const [y, r] of [[0.58, 0.595], [0.64, 0.598]]) { const b = new THREE.Mesh(new THREE.TorusGeometry(r, 0.02, 6, 36), mat('#d8b878', { rough: 0.9 })); b.rotation.x = Math.PI / 2; b.position.y = y; b.castShadow = true; g.add(b); }
  // a wooden lid with a ladle
  put(g, cyl(0.38, 0.4, 0.05, wood('#a8783e', '#cf9c5a'), 22), 0, 1.22, 0);
  put(g, sph(0.05, wood('#8a5c2c', '#a8703f')), 0, 1.27, 0);
  const ladle = group(); put(ladle, cyl(0.012, 0.012, 0.7, mat('#7a5a30', { rough: 0.8 }), 6), 0, 0, 0).rotation.z = 1.2; put(ladle, new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8, 0, TAU, 0, Math.PI / 2), mat('#8a6a3a', { rough: 0.7 })), 0.3, 0.1, 0);
  ladle.position.set(-0.05, 1.28, 0.05); ladle.rotation.y = 0.6; g.add(ladle);
  // a second small jar beside
  put(g, lathe([[0, 0], [0.14, 0], [0.24, 0.2], [0.18, 0.46], [0.12, 0.52], [0, 0.52]], c, 20), 0.85, 0, 0.25);
  return { group: g, top: 1.3, w: 1.5, update: () => {} };
}

// ---------------------------------------------------------------------------------------------------------- rice sacks
function sacks(T) {
  const g = group(), c = ['#d8c08a', '#c8ae76', '#e0cb98'];
  const sack = (i, rx = 0) => {
    const s = group();
    const body = lathe([[0, 0], [0.28, 0.0], [0.34, 0.12], [0.36, 0.34], [0.3, 0.62], [0.16, 0.72], [0.09, 0.78], [0.12, 0.84], [0.05, 0.9], [0, 0.9]], clothM(c[i % 3], '#9a8450', { repeat: [4, 4], seed: i }), 18);
    body.scale.set(1, 1, 0.78); s.add(body); body.castShadow = true; body.receiveShadow = true;
    return s;
  };
  const arr = [[-0.5, 0, 0.1, 0.4], [0.2, 0, 0.2, 2.2], [0.78, 0, -0.1, 0.8], [-0.1, 0, -0.5, 1.3], [0.55, 0, -0.55, 3.1], [-0.15, 0.62, -0.02, 0.2], [0.35, 0.58, -0.3, 2.6]];
  arr.forEach(([x, y, z, ry], i) => { const s = sack(i); s.position.set(x, y, z); s.rotation.y = ry; s.scale.setScalar(0.95); g.add(s); });
  // spilled grain
  rngSeed(9); const gm = mat('#f3ecd2', { rough: 0.9 });
  for (let i = 0; i < 26; i++) put(g, sph(0.012, gm, 5, 4), 0.2 + (rnd() - 0.4) * 0.5, 0.012, 0.55 + rnd() * 0.3);
  return { group: g, top: 1.5, w: 1.9, update: () => {} };
}

// ---------------------------------------------------------------------------------------------------------- shelter bench / low table
function table(T, v) {
  const g = group();
  if (v === 'low') {
    const lac = darkWood('#3a2216', '#5a3a22', { seed: 41 });
    put(g, rbox(1.5, 0.08, 0.9, 0.025, lac), 0, 0.42, 0);
    for (const [x, z] of [[-0.62, -0.34], [0.62, -0.34], [-0.62, 0.34], [0.62, 0.34]]) put(g, box(0.08, 0.4, 0.08, lac), x, 0.2, z);
    // cushions (zabuton), tea set, a plate of rice balls
    const cush = [['#9b2c2c', -0.45, 0.78, 0.05], ['#2c4a8a', 0.5, 0.78, -0.1], ['#d8b050', -0.1, -0.78, 0.1]];
    cush.forEach(([c, x, z, ry]) => put(g, rbox(0.62, 0.1, 0.62, 0.04, clothM(c, '#ffffff', { repeat: [3, 3] })), x, 0.06, z, ry));
    put(g, lathe([[0, 0], [0.08, 0], [0.12, 0.08], [0.1, 0.16], [0.03, 0.16], [0.04, 0.18], [0, 0.18]], mat('#2f5a7a', { rough: 0.3 }), 16), -0.45, 0.46, 0.05);
    for (const dx of [0.0, 0.18]) put(g, lathe([[0, 0], [0.04, 0], [0.06, 0.03], [0.06, 0.05], [0, 0.05]], mat('#f1ece0', { rough: 0.3 }), 12), 0.1 + dx, 0.46, -0.15);
    put(g, cyl(0.15, 0.15, 0.02, mat('#d8452c', { rough: 0.4 }), 18), 0.45, 0.47, 0.1);
    for (let i = 0; i < 3; i++) put(g, sph(0.055, mat('#f6f2e4', { rough: 0.8 }), 10, 8), 0.4 + i * 0.07, 0.52, 0.1 + (i % 2) * 0.05).scale.set(1, 0.85, 1);
    return { group: g, top: 0.6, w: 2.0, update: () => {} };
  }
  // a small open shelter with a thatched roof and a bench
  const post = mat('#a8864a', { rough: 0.7 });
  for (const [x, z] of [[-1.0, -0.6], [1.0, -0.6], [-1.0, 0.6], [1.0, 0.6]]) put(g, cyl(0.06, 0.07, 2.0, post, 8), x, 1.0, z);
  for (const z of [-0.6, 0.6]) { const b = put(g, cyl(0.04, 0.04, 2.2, post, 8), 0, 1.95, z); b.rotation.z = Math.PI / 2; }
  const th = mat('#b79a58', { rough: 1, side: 1 });
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 2.6, 4, 1, true, Math.PI / 4, Math.PI / 2), th);
  roof.rotation.z = Math.PI / 2; roof.scale.set(0.35, 1, 1.0); roof.position.set(0, 2.15, 0); roof.castShadow = true; g.add(roof);
  // simpler: two sloped thatch planes
  roof.visible = false;
  for (const s of [-1, 1]) { const p = put(g, box(2.8, 0.1, 0.95, th), 0, 2.2, s * 0.46); p.rotation.x = -s * 0.5; }
  put(g, box(2.8, 0.08, 0.12, mat('#8a6e3a', { rough: 1 })), 0, 2.46, 0);
  put(g, rbox(1.7, 0.08, 0.5, 0.02, wood('#9a6a3a', '#c28f58')), 0, 0.48, 0.15);
  for (const x of [-0.7, 0.7]) put(g, box(0.07, 0.46, 0.4, darkWood()), x, 0.23, 0.15);
  // hay bale beside
  put(g, rbox(0.7, 0.4, 0.45, 0.05, mat('#c8aa52', { rough: 1 })), 1.35, 0.2, 0.25, 0.3);
  return { group: g, top: 2.5, w: 2.8, update: () => {} };
}

// ---------------------------------------------------------------------------------------------------------- gate / veranda
function gate(T, v) {
  const g = group();
  if (v === 'veranda') {
    const w = wood('#9a6a3a', '#c8975a', { seed: 51, repeat: [3, 1] }), dk = darkWood('#3a2412', '#563620', { seed: 52 });
    put(g, rbox(2.9, 0.12, 1.3, 0.02, w), 0, 0.5, 0);
    for (const [x, z] of [[-1.35, -0.55], [1.35, -0.55], [-1.35, 0.55], [1.35, 0.55], [0, -0.55], [0, 0.55]]) put(g, box(0.1, 0.5, 0.1, dk), x, 0.25, z);
    for (const x of [-1.35, 1.35]) put(g, box(0.12, 2.1, 0.12, dk), x, 1.55, -0.55);
    put(g, box(3.1, 0.14, 0.2, dk), 0, 2.64, -0.55);
    // tiled eave
    const tile = mat('#3c3e4c', { rough: 0.6 });
    const eave = put(g, box(3.4, 0.1, 1.6, tile), 0, 2.78, -0.15); eave.rotation.x = -0.18;
    // a step stone and a wind chime
    put(g, rock(0.35, mat('#8c8578', { rough: 0.95, flat: true }), 4, 0.4), 0.2, 0.13, 1.0);
    const chime = group(); chime.position.set(0.9, 2.55, 0.0);
    put(chime, cyl(0.004, 0.004, 0.3, mat('#ddd', { metal: 0.9 }), 4), 0, -0.15, 0);
    put(chime, cyl(0.03, 0.03, 0.16, mat('#c9b36a', { metal: 0.9, rough: 0.3 }), 8), 0, -0.4, 0);
    g.add(chime);
    // shoji panel on the back
    put(g, box(2.5, 1.7, 0.05, mat('#f4efdc', { emissive: '#ffd89a', ei: 0.5, rough: 1 })), 0, 1.45, -0.62);
    for (let i = 1; i < 4; i++) put(g, box(0.03, 1.7, 0.07, dk), -1.25 + i * 0.625, 1.45, -0.6);
    for (let j = 1; j < 4; j++) put(g, box(2.5, 0.03, 0.07, dk), 0, 0.6 + j * 0.42, -0.6);
    return { group: g, top: 2.8, w: 3.4, update: (t) => { chime.rotation.z = Math.sin(t * 1.9) * 0.1; } };
  }
  // woven bamboo gate in a fence
  const bam = mat('#b0a25a', { rough: 0.6 }), bamD = mat('#7a8a3a', { rough: 0.6 });
  for (const x of [-1.15, 1.15]) put(g, cyl(0.07, 0.08, 2.0, bamD, 10), x, 1.0, 0);
  for (const y of [0.4, 0.95, 1.5]) { const b = put(g, cyl(0.04, 0.04, 2.1, bam, 8), 0, y, 0.02); b.rotation.z = Math.PI / 2; }
  for (let i = 0; i < 9; i++) put(g, cyl(0.03, 0.03, 1.6, bam, 6), -0.9 + i * 0.225, 0.9, 0.0);
  for (const s of [-1, 1]) for (let i = 0; i < 3; i++) put(g, cyl(0.03, 0.03, 1.2 + (i % 2) * 0.12, bam, 6), s * (1.5 + i * 0.22), 0.6 + (i % 2) * 0.06, 0);
  for (const s of [-1, 1]) { const b = put(g, cyl(0.035, 0.035, 0.8, bam, 6), s * 1.8, 0.9, 0); b.rotation.z = Math.PI / 2; }
  put(g, new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.02, 6, 14), mat('#2a2a2e', { metal: 0.8 })), 0.0, 1.0, 0.07);
  return { group: g, top: 2.0, w: 4.4, update: () => {} };
}

// ---------------------------------------------------------------------------------------------------------- folding screen
function screen(T) {
  const g = group();
  const panels = 4, pw = 0.55, ph = 1.85;
  const t = canvasTex(256, 512, (c, W, H) => {
    const gr = c.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#f1e0b0'); gr.addColorStop(1, '#e8cc88'); c.fillStyle = gr; c.fillRect(0, 0, W, H);
    c.strokeStyle = 'rgba(70,50,28,0.75)'; c.lineCap = 'round';
    c.lineWidth = 8; c.beginPath(); c.moveTo(W * 0.3, H); c.bezierCurveTo(W * 0.35, H * 0.7, W * 0.25, H * 0.5, W * 0.4, H * 0.2); c.stroke();
    c.lineWidth = 4; for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(W * 0.38, H * (0.28 + i * 0.1)); c.quadraticCurveTo(W * 0.7, H * (0.22 + i * 0.1), W * 0.85, H * (0.3 + i * 0.1)); c.stroke(); }
    c.fillStyle = 'rgba(180,60,40,0.8)'; c.beginPath(); c.arc(W * 0.78, H * 0.12, 22, 0, TAU); c.fill();
    c.fillStyle = 'rgba(90,110,70,0.35)'; c.beginPath(); c.moveTo(0, H * 0.75); c.quadraticCurveTo(W * 0.5, H * 0.6, W, H * 0.78); c.lineTo(W, H); c.lineTo(0, H); c.fill();
  });
  const paper = new THREE.MeshStandardMaterial({ map: t, roughness: 0.9, side: THREE.DoubleSide });
  const fr = darkWood('#1c1410', '#2a1c14', { seed: 61 });
  const ang = 0.55;
  for (let i = 0; i < panels; i++) {
    const p = group();
    const pm = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), paper); pm.position.y = 0.1 + ph / 2; pm.castShadow = true; pm.receiveShadow = true; p.add(pm);
    pm.material = paper.clone(); pm.material.map = t.clone(); pm.material.map.repeat.set(1, 1); pm.material.map.offset.set(0, 0); pm.material.map.needsUpdate = true;
    put(p, box(pw + 0.04, 0.06, 0.04, fr), 0, 0.1, 0); put(p, box(pw + 0.04, 0.08, 0.04, fr), 0, 0.1 + ph, 0);
    put(p, box(0.04, ph, 0.04, fr), -pw / 2, 0.1 + ph / 2, 0); put(p, box(0.04, ph, 0.04, fr), pw / 2, 0.1 + ph / 2, 0);
    put(p, box(pw, 0.05, 0.08, fr), 0, 0.03, 0); // foot
    const x = (i - (panels - 1) / 2) * pw * Math.cos(ang);
    p.position.set(x, 0, (i % 2 ? 1 : -1) * Math.sin(ang) * pw * 0.25);
    p.rotation.y = (i % 2 ? 1 : -1) * ang; g.add(p);
  }
  return { group: g, top: 2.05, w: 2.2, update: () => {} };
}

// ---------------------------------------------------------------------------------------------------------- futon cupboard
function wardrobe(T) {
  const g = group();
  const fr = darkWood('#3a2414', '#563622', { seed: 71 });
  const W = 1.9, Hh = 1.95, D = 0.78;
  put(g, box(W + 0.16, 0.14, D + 0.12, fr), 0, 0.07, 0);
  put(g, box(0.1, Hh, D, fr), -W / 2 - 0.03, Hh / 2 + 0.1, 0); put(g, box(0.1, Hh, D, fr), W / 2 + 0.03, Hh / 2 + 0.1, 0);
  put(g, box(W + 0.16, 0.14, D + 0.1, fr), 0, Hh + 0.12, 0);
  put(g, box(W, Hh, 0.06, mat('#2a1a10', { rough: 1 })), 0, Hh / 2 + 0.1, -D / 2 + 0.05);
  // the folded futons inside, visible through the open door
  const f = [['#9a3a3a', 0.2], ['#f1e8d0', 0.52], ['#3a5a8a', 0.84]];
  f.forEach(([c, y]) => put(g, rbox(W * 0.46, 0.3, D * 0.8, 0.08, clothM(c, '#ffffff', { repeat: [2, 2] })), W * 0.22, y + 0.2, 0.0));
  // four sliding paper panels with gold-leaf cloud shapes
  const t = canvasTex(256, 512, (c, w, h) => {
    c.fillStyle = '#efe3c2'; c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(214,176,70,0.85)'; for (let i = 0; i < 5; i++) { c.beginPath(); c.ellipse(w * (0.2 + (i % 3) * 0.3), h * (0.18 + i * 0.17), 60, 14, 0, 0, TAU); c.fill(); }
    c.strokeStyle = 'rgba(60,40,20,0.55)'; c.lineWidth = 3; c.strokeRect(6, 6, w - 12, h - 12);
  });
  const pm = new THREE.MeshStandardMaterial({ map: t, roughness: 0.85 });
  const doors = [];
  for (let i = 0; i < 4; i++) {
    const d = group();
    put(d, box(W / 4 + 0.02, Hh - 0.02, 0.04, pm), 0, 0, 0);
    put(d, new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.02, 14), mat('#a8863a', { metal: 0.9, rough: 0.3 })), 0, 0, 0.03).rotation.x = Math.PI / 2;
    d.position.set(-W * 3 / 8 + i * W / 4, Hh / 2 + 0.1, D / 2 - 0.02 + (i % 2) * 0.05); g.add(d); doors.push(d);
  }
  doors[0].position.x = -W * 3 / 8 + 0.0; doors[1].position.x = -W / 8 - 0.0;
  doors[2].position.x = W / 8 + 0.52; doors[3].position.x = W * 3 / 8 + 0.0;   // one panel slid across: the futons show
  return { group: g, top: 2.2, w: 2.1, update: () => {} };
}

// ---------------------------------------------------------------------------------------------------------- tansu chest
function chest(T) {
  const g = group();
  const w = wood('#7a4b28', '#a8703f', { seed: 81, repeat: [2, 1] }), iron = mat('#2a2a2e', { metal: 0.85, rough: 0.35 });
  const W = 1.1, Hh = 0.95, D = 0.55;
  put(g, rbox(W, Hh, D, 0.02, w), 0, Hh / 2 + 0.1, 0);
  put(g, box(W + 0.08, 0.1, D + 0.08, darkWood()), 0, 0.05, 0);
  // drawers with iron pulls and corner plates
  for (let r = 0; r < 3; r++) for (let c = 0; c < 2; c++) {
    const x = -W / 4 + c * W / 2, y = 0.3 + r * 0.3;
    put(g, rbox(W / 2 - 0.05, 0.25, 0.03, 0.01, darkWood('#5a3a1e', '#7a5232', { seed: 82 + r })), x, y + 0.08, D / 2);
    put(g, new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.008, 6, 12), iron), x, y + 0.08, D / 2 + 0.03);
    put(g, box(0.1, 0.12, 0.012, iron), x, y + 0.08, D / 2 + 0.02);
  }
  for (const sx of [-1, 1]) { put(g, box(0.1, 0.1, D + 0.02, iron), sx * (W / 2 - 0.05), Hh + 0.05, 0); put(g, box(0.04, 0.16, D + 0.02, iron), sx * (W / 2), 0.2, 0); }
  put(g, rbox(0.5, 0.06, 0.4, 0.02, mat('#d8452c', { rough: 0.4 })), 0, Hh + 0.13, 0).rotation.y = 0.2;   // a folded cloth on top
  // iron carrying handles
  for (const s of [-1, 1]) { const h = put(g, new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.01, 6, 12, Math.PI), iron), s * (W / 2 + 0.01), 0.7, 0); h.rotation.y = Math.PI / 2; }
  return { group: g, top: 1.2, w: 1.4, update: () => {} };
}

// ---------------------------------------------------------------------------------------------------------- garden rocks
function rocks(T) {
  const g = group();
  const st = mat('#7a7a72', { rough: 0.95, flat: true }), moss = mat('#5a7a3a', { rough: 1, flat: true });
  const gravel = canvasTex(256, 256, (c, w, h) => {
    c.fillStyle = '#d8d0bc'; c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(120,110,90,0.5)'; c.lineWidth = 2;
    for (let r = 20; r < 130; r += 12) { c.beginPath(); c.arc(w / 2, h / 2, r, 0, TAU); c.stroke(); }
    for (let i = 0; i < 700; i++) { c.fillStyle = `rgba(${120 + (i % 7) * 12},${112 + (i % 5) * 10},96,0.25)`; c.fillRect((i * 37) % w, (i * 91) % h, 2, 2); }
  });
  const bed = put(g, new THREE.Mesh(new THREE.CircleGeometry(1.5, 36), new THREE.MeshStandardMaterial({ map: gravel, roughness: 1 })), 0, 0.012, 0); bed.rotation.x = -Math.PI / 2; bed.castShadow = false;
  const a = rock(0.75, st, 3, 0.95); put(g, a, -0.1, 0.5, -0.1);
  const b = rock(0.5, st, 5, 0.8); put(g, b, 0.75, 0.3, 0.2);
  const c = rock(0.38, st, 8, 0.75); put(g, c, -0.8, 0.22, 0.35);
  const m = rock(0.6, moss, 3, 0.4); put(g, m, -0.1, 0.9, -0.1).scale.set(0.85, 0.5, 0.85);
  // a small azalea shrub and a bamboo dipper stand
  put(g, foliageBlob(0.4, '#2a5a2a', '#6aa84a', 91), 0.6, 0.45, -0.5);
  for (let i = 0; i < 5; i++) put(g, sph(0.05, mat('#e86a8a', { rough: 0.6 }), 8, 6), 0.4 + (i % 3) * 0.17, 0.62 + (i % 2) * 0.1, -0.35 - (i % 2) * 0.2);
  return { group: g, top: 1.4, w: 2.4, update: () => {} };
}

const BUILDERS = { arch, fountain, curtain, cart, barrels, plant, laundry, crates, jar, sacks, table, gate, screen, wardrobe, chest, rocks };
export function buildProp(kind, v, T) {
  const b = BUILDERS[kind] || crates;
  const out = b(T, v);
  out.kind = kind;
  return out;
}
export { lerp };

// The glen: terrain with hills and a loch, the mown games field with its chalk clock face, rope, spectators, tents, pines, walls, sheep, bunting.
// Everything is generated from a fixed seed with small canvas textures: no image files. Returns handles the presenter animates and shows or hides per event.
const rnd = (seed) => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };

export const FIELD_R = 33;
// terrain height: flat games field, rolling slopes, ridges and far mountains. (x, z) in metres, field centred on the origin.
export function groundH(x, z) {
  const r = Math.hypot(x, z);
  if (r < FIELD_R + 4) return 0;
  const t = Math.min(1, (r - FIELD_R - 4) / 40);
  const a = Math.atan2(z, x);
  const ridge = 0.5 + 0.5 * Math.sin(a * 3 + 0.7) * Math.cos(a * 2 - 0.3);
  const n = Math.sin(x * 0.045 + 1.3) * Math.cos(z * 0.05 + 0.4) + 0.5 * Math.sin(x * 0.11 + z * 0.09) + 0.25 * Math.sin(x * 0.27 - z * 0.23);
  let h = t * t * (6 + 9 * ridge) + n * 1.3 * t;
  // far hills: a smooth rise (no cliff walls) to rounded Highland ridges
  const far = Math.max(0, (r - 78) / 85);
  h += Math.pow(far, 1.6) * (24 + 20 * (0.55 + 0.45 * Math.sin(a * 4 + 1.1) * Math.cos(a * 7)) + 6 * Math.sin(x * 0.02) * Math.cos(z * 0.025));
  // the loch: a hollow to the left of the field (x > 0 is the athlete's left)
  const lx = x - 62, lz = z - 38, ld = Math.hypot(lx / 26, lz / 17);
  if (ld < 1.9) { const u = Math.min(1, Math.max(0, (ld - 0.95) / 0.95)), w = u * u * (3 - 2 * u); h = -0.6 * (1 - w) + h * w; }   // gentle banks, no cliff
  return h;
}

let GRID = null;
// the terrain surface exactly as the mesh draws it (bilinear over the grid), so things placed on it never float or sink
export function terrainH(x, z) {
  if (!GRID) return groundH(x, z);
  const { N, size, h } = GRID;
  const u = (x / size + 0.5) * N, v = (z / size + 0.5) * N;
  if (u < 0 || v < 0 || u >= N || v >= N) return groundH(x, z);
  const i = Math.floor(u), j = Math.floor(v), a = u - i, b = v - j, W = N + 1;
  return h[j * W + i] * (1 - a) * (1 - b) + h[j * W + i + 1] * a * (1 - b) + h[(j + 1) * W + i] * (1 - a) * b + h[(j + 1) * W + i + 1] * a * b;
}
function texCanvas(doc, w, h, draw) { const c = doc.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); return c; }

export function buildGlen(V3, stage, opts = {}) {
  const { THREE } = V3;
  const doc = globalThis.document;
  const R = rnd(20261007);
  const root = new THREE.Group(); root.name = 'glen';
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const lambert = (c, o = {}) => new THREE.MeshLambertMaterial({ color: c, ...o });
  const std = (c, r = 0.85, m = 0, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m, ...o });
  const out = { root, spectators: null, flags: [], clock: null, trig: null, bar: null, markers: null, sheep: null };

  // ---- sky: a deep Highland blue to a pale warm horizon with a sun glow, and banks of shaded cumulus (lit tops, grey bellies)
  const skyTex = new THREE.CanvasTexture(texCanvas(doc, 8, 512, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#3f78c4'); gr.addColorStop(0.35, '#77a8dc'); gr.addColorStop(0.62, '#b7d2e8'); gr.addColorStop(0.82, '#e3e7e2'); gr.addColorStop(1, '#f2ead8'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }));
  skyTex.colorSpace = THREE.SRGBColorSpace;
  stage.scene.background = skyTex;
  stage.scene.fog = new THREE.Fog(0xcfdbe2, 45, 230);
  const cloudTex = (seed) => { const r2 = rnd(seed); const t = new THREE.CanvasTexture(texCanvas(doc, 256, 128, (g, w, h) => {
    const puffs = []; for (let i = 0; i < 22; i++) { const u = r2(); puffs.push({ x: w * (0.12 + 0.76 * r2()), y: h * (0.62 - 0.38 * Math.sin(Math.PI * u) * r2()), r: h * (0.14 + 0.2 * r2()) }); }
    for (const p of puffs) { const gr = g.createRadialGradient(p.x, p.y + p.r * 0.35, 0, p.x, p.y + p.r * 0.35, p.r * 1.1); gr.addColorStop(0, 'rgba(150,162,178,0.75)'); gr.addColorStop(1, 'rgba(150,162,178,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }
    for (const p of puffs) { const gr = g.createRadialGradient(p.x - p.r * 0.2, p.y - p.r * 0.3, 0, p.x, p.y, p.r); gr.addColorStop(0, 'rgba(255,255,252,0.95)'); gr.addColorStop(0.6, 'rgba(244,246,248,0.7)'); gr.addColorStop(1, 'rgba(230,236,242,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }
    g.globalCompositeOperation = 'destination-in'; const fade = g.createLinearGradient(0, 0, 0, h); fade.addColorStop(0, 'rgba(0,0,0,1)'); fade.addColorStop(0.8, 'rgba(0,0,0,1)'); fade.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = fade; g.fillRect(0, 0, w, h);
  })); t.colorSpace = THREE.SRGBColorSpace; return t; };
  const cloudTexs = [cloudTex(11), cloudTex(23), cloudTex(37)];
  out.clouds = [];
  for (let i = 0; i < 16; i++) {
    const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTexs[i % 3], transparent: true, depthWrite: false, fog: false, opacity: 0.85 }));
    const a = R() * Math.PI * 2, d = 200 + R() * 40;
    m.position.set(Math.cos(a) * d, 60 + R() * 70, Math.sin(a) * d); const s = 46 + R() * 50; m.scale.set(s, s * 0.5, 1); root.add(m); out.clouds.push({ m, a, d, y: m.position.y });
  }
  // ---- terrain
  {
    const N = 190, size = 330;
    const geo = new THREE.PlaneGeometry(size, size, N, N);
    const pos = geo.attributes.position, col = new Float32Array(pos.count * 3);
    geo.rotateX(-Math.PI / 2);
    const p2 = geo.attributes.position;
    const heights = new Float32Array(p2.count);
    for (let i = 0; i < p2.count; i++) { const x = p2.getX(i), z = p2.getZ(i); heights[i] = groundH(x, z); p2.setY(i, heights[i]); }
    GRID = { N, size, h: heights };
    geo.computeVertexNormals();
    const nrm = geo.attributes.normal;
    const c = new THREE.Color();
    for (let i = 0; i < p2.count; i++) {
      const x = p2.getX(i), z = p2.getZ(i), h = heights[i], r = Math.hypot(x, z);
      const slope = 1 - nrm.getY(i);
      const patch = Math.sin(x * 0.19 + 2) * Math.cos(z * 0.23 - 1) + Math.sin(x * 0.07 - z * 0.11) * 0.8;
      if (h < -0.2) c.set('#1f3b47');
      else if (r < FIELD_R + 1.5) c.set('#467f37');
      else if ((slope > 0.45 && patch > -0.2) || h > 46) c.set(h > 56 ? '#8a8c8e' : patch > 0.6 ? '#6e5f6e' : '#6a6656');
      else if (patch > 1.0 && h > 3) c.set('#715a78');          // heather
      else if (patch < -0.7 && h > 3) c.set('#6f6840');          // bracken
      else c.set(h > 30 ? '#62724a' : patch > 0.3 ? '#4d7438' : '#46703a');
      const shade = 0.9 + 0.1 * Math.sin(x * 0.9) * Math.sin(z * 0.8);
      col[i * 3] = c.r * shade; col[i * 3 + 1] = c.g * shade; col[i * 3 + 2] = c.b * shade;
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    const mesh = new THREE.Mesh(geo, std(0xffffff, 0.95, 0, { vertexColors: true }));
    mesh.receiveShadow = true; root.add(mesh);
    // the loch
    const water = new THREE.Mesh(new THREE.PlaneGeometry(90, 60), std(0x2d6b8f, 0.12, 0.25, { transparent: true, opacity: 0.9 }));
    water.rotation.x = -Math.PI / 2; water.position.set(62, -0.35, 38); root.add(water);
  }

  // ---- the games field: mown stripes
  {
    const tex = new THREE.CanvasTexture(texCanvas(doc, 512, 512, (g, w, h) => {
      for (let i = 0; i < 16; i++) { g.fillStyle = i % 2 ? '#4f8c3c' : '#5c9a46'; g.fillRect(0, (i * h) / 16, w, h / 16 + 1); }
      const img = g.getImageData(0, 0, w, h); let s = 99;
      for (let i = 0; i < img.data.length; i += 4) { s = (s * 1664525 + 1013904223) >>> 0; const n = ((s >>> 24) - 128) * 0.1; img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n * 0.7; }
      g.putImageData(img, 0, 0);
      // clover and darker tufts: large soft blotches so the lawn is not one flat colour
      let r2 = 7; const rr = () => { r2 = (r2 * 1664525 + 1013904223) >>> 0; return r2 / 4294967296; };
      for (let i = 0; i < 70; i++) { const x = rr() * w, y = rr() * h, r = 8 + rr() * 40; const gr = g.createRadialGradient(x, y, 0, x, y, r); const dk = rr() < 0.6; gr.addColorStop(0, dk ? 'rgba(40,80,30,0.16)' : 'rgba(150,170,80,0.12)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, 2 * r, 2 * r); }
    }));
    tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(3, 3); tex.anisotropy = 4;
    const f = new THREE.Mesh(new THREE.CircleGeometry(FIELD_R, 72), std(0xe2e8dc, 0.95, 0, { map: tex }));
    f.rotation.x = -Math.PI / 2; f.position.y = 0.012; f.receiveShadow = true; root.add(f);
    out.field = f;
  }

  // ---- chalk: the clock face (12 o'clock straight ahead, +Z) centred on the plant spot; moved by the presenter
  {
    const clock = new THREE.Group(); clock.name = 'clock';
    const chalk = new THREE.MeshBasicMaterial({ color: 0xf4f1e6, transparent: true, opacity: 1, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
    const Rr = 13.5;
    const ring = new THREE.Mesh(new THREE.RingGeometry(Rr - 0.16, Rr + 0.16, 128), chalk); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03; clock.add(ring);
    const ring2 = new THREE.Mesh(new THREE.RingGeometry(Rr * 0.5 - 0.09, Rr * 0.5 + 0.09, 96), chalk); ring2.rotation.x = -Math.PI / 2; ring2.position.y = 0.03; ring2.material = chalk; clock.add(ring2);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;                       // clockwise from +Z (12), toward -X (3 o'clock)
      const len = i % 3 === 0 ? 2.6 : 1.5, wd = i === 0 ? 0.5 : i % 3 === 0 ? 0.34 : 0.22;
      const q = new THREE.Mesh(new THREE.PlaneGeometry(wd, len), chalk); q.rotation.x = -Math.PI / 2;
      const rr = Rr - len / 2;
      q.position.set(-Math.sin(a) * rr, 0.031, Math.cos(a) * rr); q.rotation.z = a; clock.add(q);
    }
    // the 12 o'clock line, dashed, from the plant spot
    for (let k = 0; k < 20; k++) { const d = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.55), chalk); d.rotation.x = -Math.PI / 2; d.position.set(0, 0.031, 0.8 + k * 0.62); clock.add(d); }
    // numerals 12, 3, 6, 9 drawn on the ground
    const numTex = (t) => { const tx = new THREE.CanvasTexture(texCanvas(doc, 128, 128, (g, w, h) => { g.fillStyle = 'rgba(0,0,0,0)'; g.clearRect(0, 0, w, h); g.font = '900 96px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = '#f4f1e6'; g.fillText(t, w / 2, h / 2 + 6); })); tx.colorSpace = THREE.SRGBColorSpace; return tx; };
    [['12', 0], ['3', 3], ['6', 6], ['9', 9]].forEach(([t, h]) => {
      const a = (h / 12) * Math.PI * 2;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), new THREE.MeshBasicMaterial({ map: numTex(t), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
      m.rotation.x = -Math.PI / 2; m.rotation.z = -a + Math.PI; m.rotation.z = 0;
      const rr = Rr + 1.5;
      m.position.set(-Math.sin(a) * rr, 0.032, Math.cos(a) * rr); m.rotation.z = a; clock.add(m);
    });
    // the reading wedge (lit at judging): a thin triangle from the centre along the pole's direction, hidden until then
    const wedge = new THREE.Mesh(new THREE.PlaneGeometry(0.5, Rr), new THREE.MeshBasicMaterial({ color: 0xf0c455, transparent: true, opacity: 0.8, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
    wedge.rotation.x = -Math.PI / 2; wedge.position.set(0, 0.034, Rr / 2); wedge.visible = false;
    const wrap = new THREE.Group(); wrap.add(wedge); clock.add(wrap);
    out.clock = clock; out.wedge = wedge; out.wedgeRoot = wrap; root.add(clock);
  }

  // ---- stone put: toe board and distance pegs
  {
    const g = new THREE.Group(); g.name = 'stoneRange';
    const board = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.11, 0.12), std(0xe9e4d4, 0.6)); board.position.set(0, 0.055, 0.5); board.castShadow = true; g.add(board);
    const pegGeo = new THREE.BoxGeometry(0.06, 0.55, 0.06), tabGeo = new THREE.BoxGeometry(0.5, 0.2, 0.025);
    const pegM = std(0xe8e0c8, 0.7), tabM = std(0xb9892f, 0.6);
    const lineM = new THREE.MeshBasicMaterial({ color: 0xf4f1e6, transparent: true, opacity: 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    for (let m = 2; m <= 14; m += 1) {
      const z = 0.5 + m;
      const line = new THREE.Mesh(new THREE.PlaneGeometry(m % 2 ? 3.2 : 6, m % 2 ? 0.05 : 0.09), lineM); line.rotation.x = -Math.PI / 2; line.position.set(0, 0.03, z); g.add(line);
      if (m % 2 === 0) for (const sx of [-1, 1]) {
        const peg = new THREE.Mesh(pegGeo, pegM); peg.position.set(sx * 3.4, 0.27, z); g.add(peg);
        const tab = new THREE.Mesh(tabGeo, tabM); tab.position.set(sx * 3.4, 0.5, z); g.add(tab);
      }
    }
    // the sector lines
    for (const sx of [-1, 1]) { const l = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 16), lineM); l.rotation.x = -Math.PI / 2; l.position.set(sx * 3.4, 0.03, 8.5); g.add(l); }
    out.range = g; root.add(g);
  }

  // ---- weight over the bar: two posts and the bar (height set by the presenter)
  {
    const g = new THREE.Group(); g.name = 'barRig';
    const post = (x) => { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 7.2, 10), std(0x8a6a44, 0.8)); p.position.set(x, 3.6, 0); p.castShadow = true; return p; };
    g.add(post(-2.6), post(2.6));
    const pegs = [];
    for (let i = 0; i < 8; i++) { const pg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.28, 6), std(0xd8d0b8, 0.6)); pg.rotation.z = Math.PI / 2; g.add(pg); pegs.push(pg); }
    const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 5.2, 10), std(0xe9e2cd, 0.5)); bar.rotation.z = Math.PI / 2; bar.castShadow = true; g.add(bar);
    // thin ribbon on the bar to read it from far away
    const rib = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.5, 8), std(0xc0504a, 0.6)); rib.rotation.z = Math.PI / 2; g.add(rib);
    g.userData = { bar, rib, pegs };
    out.barRig = g; root.add(g);
  }

  // ---- spectators: the shared realistic crowd (view3d crowd3d): a Scottish village audience three deep behind the rope, cheering at good throws
  {
    const q = opts.quality === 'high' ? 'high' : opts.quality === 'low' ? 'low' : 'medium';
    const crowd = V3.createCrowd3d(stage, {
      ring: { center: [0, 0, 0], radius: FIELD_R + 1.6, rows: 3, rowGap: 0.85, count: q === 'low' ? 220 : 560, arc: [0.25, Math.PI * 2 - 0.25], face: 'in' },
      seed: 1007, culture: ['european_village', 'nordic'], quality: q, props: { flag: 0.03, phone: 0.06, child: 0.05 }, flagColors: ['#1f4a9a', '#ffffff'], excitement: 0.25,
    });
    let cheerLast = 0;
    out.crowd = crowd;
    out.spectators = {
      update(dt, cheer) {
        if (cheer > 0.5 && cheerLast <= 0.5) crowd.react('cheer', { origin: [0, 0, 8], radius: 80, intensity: 1 });
        cheerLast = cheer; crowd.setExcitement(0.2 + 0.6 * cheer); crowd.update(dt, stage.camera);
      },
    };
    // the rope: a ring of posts and one thin torus
    const mtx = new THREE.Matrix4(), q4 = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3();
    const rope = new THREE.Mesh(new THREE.TorusGeometry(FIELD_R, 0.022, 5, 200), std(0xe8e0c8, 0.7)); rope.rotation.x = Math.PI / 2; rope.position.y = 0.92; root.add(rope);
    const posts = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.045, 0.055, 1.0, 8), std(0x7a5a3a, 0.8), 64); posts.frustumCulled = false; posts.castShadow = true;
    for (let i = 0; i < 64; i++) { const a = (i / 64) * Math.PI * 2; mtx.compose(ps.set(Math.cos(a) * FIELD_R, 0.5, Math.sin(a) * FIELD_R), q4.identity(), sc.set(1, 1, 1)); posts.setMatrixAt(i, mtx); }
    root.add(posts);
  }

  // ---- trees: Caledonian forest. Sitka/Norway spruce (layered drooping tiers), Scots pine (tall orange trunk, flat clumped crown) and
  // broadleaf rowan/birch clumps near the field. Each species is ONE merged, vertex-coloured geometry drawn instanced.
  {
    const noise3 = (x, y, z) => Math.sin(x * 3.1 + y * 1.7) * 0.5 + Math.sin(y * 4.3 - z * 2.9) * 0.3 + Math.sin(z * 5.7 + x * 2.3) * 0.2;
    const paint = (geo, top, bot, y0, y1) => { const p = geo.attributes.position, col = new Float32Array(p.count * 3), a = new THREE.Color(top), b = new THREE.Color(bot), c = new THREE.Color(); for (let i = 0; i < p.count; i++) { const t = Math.min(1, Math.max(0, (p.getY(i) - y0) / Math.max(1e-3, y1 - y0))); c.copy(b).lerp(a, t); const n = 0.88 + 0.12 * noise3(p.getX(i) * 2, p.getY(i) * 2, p.getZ(i) * 2); col[i * 3] = c.r * n; col[i * 3 + 1] = c.g * n; col[i * 3 + 2] = c.b * n; } geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); return geo; };
    const merge = (geos) => { const parts = geos.map((g) => (g.index ? g.toNonIndexed() : g)); let n = 0; for (const g of parts) n += g.attributes.position.count; const P = new Float32Array(n * 3), N = new Float32Array(n * 3), C = new Float32Array(n * 3); let o = 0; for (const g of parts) { P.set(g.attributes.position.array, o * 3); N.set(g.attributes.normal.array, o * 3); C.set(g.attributes.color.array, o * 3); o += g.attributes.position.count; } const m = new THREE.BufferGeometry(); m.setAttribute('position', new THREE.BufferAttribute(P, 3)); m.setAttribute('normal', new THREE.BufferAttribute(N, 3)); m.setAttribute('color', new THREE.BufferAttribute(C, 3)); return m; };
    const blob = (r, sx, sy, sz, x, y, z, seed, top, bot) => { const g = new THREE.SphereGeometry(r, 10, 7); const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const vx = p.getX(i), vy = p.getY(i), vz = p.getZ(i); const k = 1 + 0.28 * noise3(vx * 2.2 + seed, vy * 2.2, vz * 2.2 - seed); p.setXYZ(i, vx * k * sx + x, vy * k * sy + y, vz * k * sz + z); } g.computeVertexNormals(); return paint(g, top, bot, y - r * sy, y + r * sy); };
    // spruce: trunk + 8 tiers, each a cone whose rim droops and is ragged
    const spruceParts = [paint(new THREE.CylinderGeometry(0.1, 0.2, 2.2, 7).translate(0, 1.1, 0), '#4a3626', '#3a2a1e', 0, 2.2)];
    for (let i = 0; i < 8; i++) {
      const u = i / 7, r = 2.3 * (1 - u) + 0.35, y = 1.4 + u * 7.4, hh = 1.7 - u * 0.5;
      const g = new THREE.CylinderGeometry(0.05, r, hh, 11, 2, false); const p = g.attributes.position;
      for (let k = 0; k < p.count; k++) { const vx = p.getX(k), vy = p.getY(k), vz = p.getZ(k); const rim = vy < 0 ? 1 : vy < 0.01 ? 0.5 : 0; const ang = Math.atan2(vz, vx); const j = 1 + 0.22 * Math.sin(ang * 5 + i * 1.3) * rim + 0.12 * Math.sin(ang * 11 + i) * rim; p.setXYZ(k, vx * j, vy - rim * 0.25 * (0.6 + 0.4 * Math.sin(ang * 3 + i)) + y, vz * j); }
      g.computeVertexNormals(); spruceParts.push(paint(g, '#1d3a26', '#3c6a40', y - hh / 2 - 0.3, y + hh / 2));
    }
    const spruceGeo = merge(spruceParts);
    // Scots pine: tall, slightly leaning orange-brown trunk, a few flat clumps at the top
    const pineParts = [paint(new THREE.CylinderGeometry(0.13, 0.24, 8.4, 7).translate(0, 4.2, 0), '#b0683c', '#5a4030', 2, 8.4)];
    [[0, 8.6, 0, 1.9], [1.3, 8.0, 0.5, 1.4], [-1.2, 8.2, -0.4, 1.5], [0.3, 9.4, -0.8, 1.3], [-0.5, 7.6, 1.1, 1.2]].forEach(([x, y, z, r], i) => pineParts.push(blob(r, 1.25, 0.55, 1.25, x, y, z, i * 3.1, '#3c6440', '#1c3424')));
    const pineGeo = merge(pineParts);
    // broadleaf (rowan / birch clump): pale trunk, three lumpy crowns
    const broadParts = [paint(new THREE.CylinderGeometry(0.08, 0.13, 4.0, 7).translate(0, 2.0, 0), '#e4ded0', '#8f8a80', 0, 4)];
    [[0, 4.6, 0, 1.6], [1.0, 4.0, 0.6, 1.2], [-0.9, 4.2, -0.5, 1.25], [0.2, 5.5, -0.3, 1.1]].forEach(([x, y, z, r], i) => broadParts.push(blob(r, 1, 0.9, 1, x, y, z, i * 2.3 + 7, '#8fb35a', '#3f6430')));
    const broadGeo = merge(broadParts);
    const treeMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 });
    const place = (n, minR, maxR, hmin, hmax, f) => { let k = 0, tries = 0; while (k < n && tries++ < n * 40) { const a = R() * Math.PI * 2, r = minR + R() * (maxR - minR), x = Math.cos(a) * r, z = Math.sin(a) * r, h = terrainH(x, z); if (h < hmin || h > hmax) continue; if (Math.hypot(x - 62, z - 38) < 30) continue; f(x, h, z, k++); } };
    const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), ps = new THREE.Vector3(), c = new THREE.Color();
    const forest = (geo, n, minR, maxR, hmin, hmax, s0, s1, tint) => {
      const m = new THREE.InstancedMesh(geo, treeMat, n); let used = 0;
      place(n, minR, maxR, hmin, hmax, (x, h, z, k) => { const s = s0 + R() * (s1 - s0); e.set((R() - 0.5) * 0.06, R() * 6.28, (R() - 0.5) * 0.06); q.setFromEuler(e); mtx.compose(ps.set(x, h - 0.1, z), q, sc.set(s * (0.9 + R() * 0.2), s, s * (0.9 + R() * 0.2))); m.setMatrixAt(k, mtx); const g = tint[0] + R() * tint[1]; m.setColorAt(k, c.setRGB(g, g * (0.97 + R() * 0.06), g)); used = k + 1; });
      m.count = used; m.castShadow = false; m.receiveShadow = false; m.frustumCulled = false; root.add(m); return m;
    };
    forest(spruceGeo, 230, FIELD_R + 9, 135, 0.5, 52, 0.75, 1.5, [0.8, 0.3]);
    forest(pineGeo, 70, FIELD_R + 8, 110, 0.3, 40, 0.8, 1.15, [0.85, 0.25]);
    forest(broadGeo, 28, FIELD_R + 5, 58, 0, 8, 0.8, 1.2, [0.85, 0.25]);
    // boulders
    const rockGeo = new THREE.SphereGeometry(1, 9, 7); { const p = rockGeo.attributes.position; for (let i = 0; i < p.count; i++) { const k = 1 + 0.22 * noise3(p.getX(i) * 1.7, p.getY(i) * 1.7, p.getZ(i) * 1.7); p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k); } rockGeo.computeVertexNormals(); paint(rockGeo, '#a29f95', '#6c6a62', -1, 1); }
    const NR = 90, rocks = new THREE.InstancedMesh(rockGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }), NR);
    let ru = 0;
    place(NR, FIELD_R + 3, 120, 0, 60, (x, h, z, k) => { const s = 0.4 + R() * 1.6; e.set(R() * 3, R() * 3, R() * 3); q.setFromEuler(e); mtx.compose(ps.set(x, h + s * 0.2, z), q, sc.set(s * (1 + R() * 0.5), s * 0.6, s)); rocks.setMatrixAt(k, mtx); ru = k + 1; });
    rocks.count = ru; rocks.frustumCulled = false; root.add(rocks);
    // dry stone wall: stacked boxes along an arc outside the field
    const NW = 140, wall = new THREE.InstancedMesh(new THREE.BoxGeometry(1.1, 0.55, 0.5), std(0x8f8b80, 0.95), NW);
    for (let i = 0; i < NW; i++) { const a = Math.PI * (0.15 + 0.9 * (i / NW)) * 1.0 + 0.9, r = FIELD_R + 9 + Math.sin(a * 3) * 1.5; const x = Math.cos(a) * r, z = Math.sin(a) * r; e.set(0, -a + Math.PI / 2, 0); q.setFromEuler(e); mtx.compose(ps.set(x, terrainH(x, z) + 0.28 + (i % 2) * 0.5, z), q, sc.set(1, 1, 1)); wall.setMatrixAt(i, mtx); }
    wall.frustumCulled = false; root.add(wall);
  }
  // ---- tents and a judges' gazebo
  {
    const tent = (x, z, ry, stripe) => {
      const g = new THREE.Group();
      const tex = new THREE.CanvasTexture(texCanvas(doc, 128, 32, (c, w, h) => { for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? '#f1ede0' : stripe; c.fillRect((i * w) / 8, 0, w / 8 + 1, h); } })); tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = THREE.RepeatWrapping;
      const walls = new THREE.Mesh(new THREE.BoxGeometry(9, 2.6, 5), std(0xf1ede0, 0.95)); walls.position.y = 1.3; g.add(walls);
      const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 3.4, 2.0, 4, 1), std(0xffffff, 0.9, 0, { map: tex })); roof.rotation.y = Math.PI / 4; roof.scale.set(1.9, 1, 1.05); roof.position.y = 3.6; g.add(roof);
      g.position.set(x, terrainH(x, z), z); g.rotation.y = ry; return g;
    };
    root.add(tent(-34, 30, 0.6, '#3d7a4c'), tent(40, -26, -0.5, '#b9892f'), tent(-8, 50, 0.1, '#4a6fa5'));
    const gz = new THREE.Group();
    for (const [dx, dz] of [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.4, 6), std(0x8a6a44, 0.8)); p.position.set(dx, 1.2, dz); gz.add(p); }
    const gr = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 2.1, 0.9, 4), std(0xf1ede0, 0.9)); gr.rotation.y = Math.PI / 4; gr.position.y = 2.85; gz.add(gr);
    const dk = new THREE.Mesh(new THREE.BoxGeometry(3, 0.25, 3), std(0x9a7b50, 0.9)); dk.position.y = 0.12; gz.add(dk);
    gz.position.set(-20, 0, 24); gz.rotation.y = 0.5; root.add(gz);
  }

  // ---- bunting between poles on the far side
  {
    const colors = [0x3d7a4c, 0xf0c455, 0xc0504a, 0xe9e4d4, 0x4a6fa5];
    const tri = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.0, 0.2, 0.4, 3, 1), std(0xffffff, 0.9, 0, { side: THREE.DoubleSide }), 90);
    const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(1, 1, 0.15), ps = new THREE.Vector3(), c = new THREE.Color();
    let k = 0;
    const span = (a0, a1, rad) => {
      const p = (a, hh) => new THREE.Vector3(Math.cos(a) * rad, hh, Math.sin(a) * rad);
      for (const a of [a0, a1]) { const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 6, 6), std(0x8a6a44, 0.8)); pole.position.copy(p(a, 3)); root.add(pole); }
      const A = p(a0, 5.6), B = p(a1, 5.6);
      const pts = []; for (let i = 0; i <= 30; i++) { const t = i / 30, v = A.clone().lerp(B, t); v.y -= Math.sin(t * Math.PI) * 0.9; pts.push(v); }
      const line = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.012, 4, false), std(0x3a3228, 0.9)); root.add(line);
      for (let i = 1; i < 30 && k < 90; i++) { const v = pts[i]; e.set(Math.PI, -(a0 + a1) / 2 + Math.PI / 2, 0); q.setFromEuler(e); mtx.compose(ps.copy(v).add(new THREE.Vector3(0, -0.2, 0)), q, sc); tri.setMatrixAt(k, mtx); tri.setColorAt(k, c.setHex(colors[k % colors.length])); k++; }
    };
    span(0.2, 0.75, FIELD_R + 5); span(2.3, 2.9, FIELD_R + 5); span(4.0, 4.6, FIELD_R + 5);
    tri.count = k; tri.frustumCulled = false; root.add(tri);
  }

  // ---- lying cabers at the edge, as the spares
  {
    for (let i = 0; i < 3; i++) {
      const L = 5.2 + i * 0.6, m = new THREE.Mesh(new THREE.CylinderGeometry(0.17 + i * 0.01, 0.1, L, 10), std(0x8a6a44, 0.85)); m.rotation.z = Math.PI / 2; m.rotation.y = 0.2 + i * 0.06; m.position.set(20 + i * 0.55, 0.19, -10 + i * 0.9 - 6 * 0); m.rotation.order = 'YZX'; m.castShadow = true; root.add(m);
      m.position.set(-24, 0.18, 6 + i * 0.55); m.rotation.set(0, 1.3 + i * 0.05, Math.PI / 2, 'YZX');
    }
  }
  stage.add(root);
  return out;
}

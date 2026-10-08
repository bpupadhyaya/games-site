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
  const far = Math.max(0, (r - 80) / 60);
  h += far * far * (14 + 15 * (0.55 + 0.45 * Math.sin(a * 4 + 1.1) * Math.cos(a * 7)) + 5 * Math.sin(x * 0.02) * Math.cos(z * 0.025));
  // the loch: a hollow to the left of the field (x > 0 is the athlete's left)
  const lx = x - 62, lz = z - 38, ld = Math.hypot(lx / 26, lz / 17);
  if (ld < 1.3) h = Math.min(h, -0.6 + Math.max(0, ld - 0.95) * 14);
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

export function buildGlen(V3, stage) {
  const { THREE } = V3;
  const doc = globalThis.document;
  const R = rnd(20261007);
  const root = new THREE.Group(); root.name = 'glen';
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const lambert = (c, o = {}) => new THREE.MeshLambertMaterial({ color: c, ...o });
  const std = (c, r = 0.85, m = 0, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m, ...o });
  const out = { root, spectators: null, flags: [], clock: null, trig: null, bar: null, markers: null, sheep: null };

  // ---- sky: a gradient that follows the screen, plus sun glow and soft clouds
  const skyTex = new THREE.CanvasTexture(texCanvas(doc, 4, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#5f9be0'); gr.addColorStop(0.45, '#9cc6ee'); gr.addColorStop(0.8, '#d7e6ef'); gr.addColorStop(1, '#eef0e6'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }));
  skyTex.colorSpace = THREE.SRGBColorSpace;
  stage.scene.background = skyTex;
  stage.scene.fog = new THREE.Fog(0xc9d9e4, 40, 190);
  const cloudTex = new THREE.CanvasTexture(texCanvas(doc, 128, 64, (g, w, h) => { for (let i = 0; i < 9; i++) { const x = w * (0.2 + 0.6 * R()), y = h * (0.35 + 0.3 * R()), r = h * (0.25 + 0.25 * R()); const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,0.85)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); } }));
  cloudTex.colorSpace = THREE.SRGBColorSpace;
  for (let i = 0; i < 14; i++) {
    const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, transparent: true, depthWrite: false, fog: false, opacity: 0.85 }));
    const a = R() * Math.PI * 2, d = 190 + R() * 40;
    m.position.set(Math.cos(a) * d, 70 + R() * 50, Math.sin(a) * d); m.scale.set(90 + R() * 70, 34 + R() * 20, 1); root.add(m);
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
      else if (r < FIELD_R + 1.5) c.set('#4c8a3d');
      else if (slope > 0.4 || h > 40) c.set(h > 52 ? '#8f8f90' : '#76705f');
      else if (patch > 1.0 && h > 3) c.set('#7b5a86');          // heather
      else if (patch < -0.7 && h > 3) c.set('#8f7440');          // bracken
      else c.set(h > 30 ? '#6d7f4d' : '#547f3f');
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
      for (let i = 0; i < 16; i++) { g.fillStyle = i % 2 ? '#5e9d49' : '#68a851'; g.fillRect(0, (i * h) / 16, w, h / 16 + 1); }
      const img = g.getImageData(0, 0, w, h); let s = 99;
      for (let i = 0; i < img.data.length; i += 4) { s = (s * 1664525 + 1013904223) >>> 0; const n = ((s >>> 24) - 128) * 0.1; img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n * 0.7; }
      g.putImageData(img, 0, 0);
    }));
    tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(3, 3); tex.anisotropy = 4;
    const f = new THREE.Mesh(new THREE.CircleGeometry(FIELD_R, 72), std(0xffffff, 0.95, 0, { map: tex }));
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

  // ---- spectators: two instanced meshes (bodies, heads) on arcs outside the rope; gentle cheering bob
  {
    const bodyGeo = new THREE.CylinderGeometry(0.24, 0.2, 0.72, 8); bodyGeo.translate(0, 1.0, 0);
    const legGeo = new THREE.CylinderGeometry(0.19, 0.17, 0.66, 8); legGeo.translate(0, 0.33, 0);
    const headGeo = new THREE.SphereGeometry(0.15, 8, 6); headGeo.translate(0, 1.5, 0);
    const N = 190;
    const armGeo = new THREE.CylinderGeometry(0.055, 0.05, 0.62, 6); armGeo.translate(0, -0.31, 0);
    const arms = new THREE.InstancedMesh(armGeo, std(0xffffff, 0.8), N * 2);
    const legs = new THREE.InstancedMesh(legGeo, std(0x2a2d36, 0.9), N), bodies = new THREE.InstancedMesh(bodyGeo, std(0xffffff, 0.9), N), heads = new THREE.InstancedMesh(headGeo, std(0xffffff, 0.8), N);
    const cols = ['#5d6a8f', '#a85a4c', '#4f7d5e', '#c9a85c', '#7a4f7c', '#3d5a73', '#b8b4a4', '#8c4a32', '#2f4f46', '#d0c6b0'];
    const skin = ['#e8c3a2', '#d9a982', '#b98563', '#8f5f43', '#f1d3b8'];
    const c = new THREE.Color();
    const base = [];
    for (let i = 0; i < N; i++) {
      // three arcs: behind the thrower, to the sides, and a thin row far ahead
      const arc = R();
      const ang = arc < 0.45 ? Math.PI * (1.05 + 0.9 * R()) : arc < 0.85 ? (R() < 0.5 ? 1 : -1) * (0.55 + 0.9 * R()) * 1.2 + (R() < 0.5 ? 0 : Math.PI * 0) : Math.PI * 0.5 + (R() - 0.5) * 1.0;
      const rad = FIELD_R + 1.3 + R() * 2.6;
      const x = Math.cos(ang) * rad, z = Math.sin(ang) * rad;
      base.push({ x, z, ph: R() * 6.28, sc: 0.9 + R() * 0.2, rot: Math.atan2(-x, -z) });
      bodies.setColorAt(i, c.set(cols[(R() * cols.length) | 0])); heads.setColorAt(i, c.set(skin[(R() * skin.length) | 0]));
    }
    for (const m of [legs, bodies, heads, arms]) { m.frustumCulled = false; m.castShadow = false; root.add(m); }
    for (let i = 0; i < N; i++) { arms.setColorAt(i * 2, c.set(skin[(i * 3) % skin.length])); arms.setColorAt(i * 2 + 1, c.set(skin[(i * 3) % skin.length])); }
    const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), ps = new THREE.Vector3(), ps2 = new THREE.Vector3();
    out.spectators = {
      cheer: 0, t: 0,
      update(dt, cheer) {
        this.t += dt; this.cheer += (cheer - this.cheer) * Math.min(1, dt * 4);
        for (let i = 0; i < N; i++) {
          const b = base[i];
          const bob = Math.abs(Math.sin(this.t * (2.2 + (i % 5) * 0.2) + b.ph)) * (0.03 + 0.28 * this.cheer);
          e.set(0, b.rot, 0); q.setFromEuler(e); sc.set(b.sc, b.sc * (1 + this.cheer * 0.03), b.sc); ps.set(b.x, terrainH(b.x, b.z) + bob, b.z);
          mtx.compose(ps, q, sc); bodies.setMatrixAt(i, mtx); heads.setMatrixAt(i, mtx); legs.setMatrixAt(i, mtx);
          // arms: hang down, or go up and wave while the crowd cheers
          for (let k2 = 0; k2 < 2; k2++) {
            const side = k2 ? 1 : -1, lift = this.cheer * (2.2 + Math.sin(this.t * 7 + b.ph + k2) * 0.5);
            e.set(0, b.rot, side * (0.12 + lift)); q.setFromEuler(e); e.set(0, b.rot, 0);
            const off = new THREE.Vector3(side * 0.27 * b.sc, 1.3 * b.sc, 0).applyEuler(e);
            mtx.compose(ps2.set(ps.x + off.x, ps.y + off.y, ps.z + off.z), q, sc); arms.setMatrixAt(i * 2 + k2, mtx);
          }
        }
        bodies.instanceMatrix.needsUpdate = true; heads.instanceMatrix.needsUpdate = true; legs.instanceMatrix.needsUpdate = true; arms.instanceMatrix.needsUpdate = true;
      },
    };
    out.spectators.update(0, 0);
    // the rope: a ring of posts and one thin torus
    const rope = new THREE.Mesh(new THREE.TorusGeometry(FIELD_R, 0.025, 4, 160), std(0xe8e0c8, 0.7)); rope.rotation.x = Math.PI / 2; rope.position.y = 0.95; root.add(rope);
    const posts = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.05, 0.06, 1.0, 6), std(0x8a6a44, 0.8), 64); posts.frustumCulled = false;
    for (let i = 0; i < 64; i++) { const a = (i / 64) * Math.PI * 2; mtx.compose(ps.set(Math.cos(a) * FIELD_R, 0.5, Math.sin(a) * FIELD_R), q.identity(), sc.set(1, 1, 1)); posts.setMatrixAt(i, mtx); }
    root.add(posts);
  }

  // ---- trees (pines: three stacked cones on a trunk), boulders, sheep, a dry stone wall
  {
    const place = (n, minR, maxR, hmin, hmax, f) => { let k = 0, tries = 0; while (k < n && tries++ < n * 40) { const a = R() * Math.PI * 2, r = minR + R() * (maxR - minR), x = Math.cos(a) * r, z = Math.sin(a) * r, h = terrainH(x, z); if (h < hmin || h > hmax) continue; if (Math.hypot(x - 62, z - 38) < 30) continue; f(x, h, z, k++); } };
    const mtx = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), ps = new THREE.Vector3(), c = new THREE.Color();
    const NT = 260;
    const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.18, 0.28, 3, 6), std(0x4a3828, 0.9), NT);
    const cone = (r, h, y) => { const g = new THREE.CylinderGeometry(0.02, r, h, 8); g.translate(0, y, 0); return g; };
    const crowns = [new THREE.InstancedMesh(cone(2.0, 3.2, 3.6), std(0xffffff, 0.9), NT), new THREE.InstancedMesh(cone(1.6, 2.8, 5.2), std(0xffffff, 0.9), NT), new THREE.InstancedMesh(cone(1.1, 2.4, 6.7), std(0xffffff, 0.9), NT)];
    let used = 0;
    place(NT, FIELD_R + 6, 130, 0.5, 52, (x, h, z, k) => {
      const s = 0.7 + R() * 0.9; e.set(0, R() * 6, 0); q.setFromEuler(e); mtx.compose(ps.set(x, h, z), q, sc.set(s, s, s));
      trunk.setMatrixAt(k, mtx); const g = 0.75 + R() * 0.25; c.setRGB(0.1 * g, 0.28 * g, 0.16 * g);
      for (const m of crowns) { m.setMatrixAt(k, mtx); m.setColorAt(k, c); } used = k + 1;
    });
    for (const m of [trunk, ...crowns]) { m.count = used; m.castShadow = false; m.frustumCulled = false; root.add(m); }
    // a few birches near the field edge (white trunks, round light crowns)
    const NB = 24;
    const bt = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.07, 0.1, 4.2, 6), std(0xe6e2d6, 0.8), NB), bc = new THREE.InstancedMesh(new THREE.SphereGeometry(1.5, 8, 6), std(0x7fa24a, 0.9), NB);
    place(NB, FIELD_R + 4, 60, 0, 8, (x, h, z, k) => { const s = 0.8 + R() * 0.6; mtx.compose(ps.set(x, h + 2.1 * s, z), q.identity(), sc.set(s, s, s)); bt.setMatrixAt(k, mtx); mtx.compose(ps.set(x, h + 4.6 * s, z), q.identity(), sc.set(s, s * 0.85, s)); bc.setMatrixAt(k, mtx); });
    for (const m of [bt, bc]) { m.frustumCulled = false; root.add(m); }
    // boulders
    const NR = 90, rocks = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 6, 5), std(0x8a877d, 0.95), NR);
    let ru = 0;
    place(NR, FIELD_R + 3, 120, 0, 60, (x, h, z, k) => { const s = 0.4 + R() * 1.6; e.set(R() * 3, R() * 3, R() * 3); q.setFromEuler(e); mtx.compose(ps.set(x, h + s * 0.3, z), q, sc.set(s * (1 + R() * 0.5), s * 0.6, s)); rocks.setMatrixAt(k, mtx); ru = k + 1; });
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

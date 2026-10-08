// The fjord world: sky, mountains, water, the cleared ski hill cut into a forested slope, the in-run tower, boards, flags, a crowd and a few houses.
// Coordinates: the take-off lip is the origin; +Z is down the hill (the jumper's facing), +Y is up, X is across the hill (the jumper's left is +X).
// Everything is generated from fixed seeds with small canvas textures: no image files. buildWorld(...).setHill(hill) rebuilds the per-hill parts.
import { groundY, inrunPath } from '../src/hills.js';

const rnd = (seed) => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
const ss = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

// ---- the shape of the land for one hill ---------------------------------------------------------------------------------------
export function shapeFor(h) {
  const K = h.k;
  const ip = inrunPath(h);
  const top = ip.pts[0];                                      // in-run start (behind and above the lip)
  const zEnd = K * 2.3, yEnd = groundY(h, zEnd);
  const water = yEnd - 3.2;
  const cw = (z) => (z < 0 ? 9 : 11 + 17 * ss(0, K * 0.95, z) - 4 * ss(K * 1.3, K * 2.2, z));    // half width of the cleared hill
  // y of the in-run track at world z (z < 0), by interpolation of the path
  const runY = (z) => {
    if (z >= 0) return 0;
    const pts = ip.pts;
    if (z <= pts[0].x) return pts[0].y;
    for (let i = 0; i < pts.length - 1; i++) if (z >= pts[i].x && z <= pts[i + 1].x) return lerp(pts[i].y, pts[i + 1].y, (z - pts[i].x) / Math.max(1e-6, pts[i + 1].x - pts[i].x));
    return 0;
  };
  const noise = (x, z) => Math.sin(x * 0.021 + 1.3) * Math.cos(z * 0.017 + 0.4) + 0.55 * Math.sin(x * 0.047 + z * 0.039) + 0.3 * Math.sin(x * 0.11 - z * 0.09) + 0.14 * Math.sin(x * 0.27 + z * 0.31);
  const base = (z) => {
    if (z < 0) { const zz = Math.max(z, top.x); return runY(zz) - (0.3 + 6.2 * ss(-6, -40, z)) + (z < top.x ? (top.x - z) * 0.2 : 0); }
    if (z <= zEnd) return groundY(h, z) - 0.28;
    return yEnd - 0.28 - 14 * ss(zEnd + 25, zEnd + 70, z);
  };
  const terrain = (x, z) => {
    const ax = Math.abs(x), c = cw(z), d = Math.max(0, ax - c);
    let y = base(z);
    const shore = ss(zEnd + 10, zEnd + 100, z);
    const wall = lerp(0.62, 0.02, shore);
    y += wall * d * (1 + 0.15 * Math.sin(z * 0.05)) + 3.5 * ss(0, 18, d) * noise(x * 0.7, z * 0.7);
    const far = ss(150, 330, ax) * (25 + 60 * (0.5 + 0.5 * noise(x * 0.4 + 11, z * 0.35)));
    y += far * lerp(1, 0.9, shore);
    if (z < top.x) y += 0.0;
    return y;
  };
  return { K, zEnd, yEnd, water, cw, terrain, base, runY, top };
}

function texCanvas(doc, w, h, draw) { const c = doc.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); return c; }

export function buildWorld(V3, stage) {
  const { THREE } = V3;
  const doc = globalThis.document;
  const root = new THREE.Group(); root.name = 'fjord';
  const hillGroup = new THREE.Group(); hillGroup.name = 'hill';
  root.add(hillGroup);
  const std = (c, r = 0.85, m = 0, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m, ...o });
  const lam = (c, o = {}) => new THREE.MeshLambertMaterial({ color: c, ...o });
  const out = { root, hillGroup, shape: null, flags: [], crowd: null, hillId: '', light: null };
  stage.add(root);

  // ---- sky: gradient dome, warm low sun glow, soft clouds
  const skyTex = new THREE.CanvasTexture(texCanvas(doc, 4, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#1f5fae'); gr.addColorStop(0.35, '#4f93d3'); gr.addColorStop(0.62, '#9cc7e8'); gr.addColorStop(0.85, '#e6eef0'); gr.addColorStop(1, '#f6ecd8');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  }));
  skyTex.colorSpace = THREE.SRGBColorSpace;
  stage.scene.background = skyTex;
  stage.scene.fog = new THREE.Fog(0xcfe2f0, 420, 2900);
  const R = rnd(20261008);
  const cloudTex = new THREE.CanvasTexture(texCanvas(doc, 128, 64, (g, w, h) => { for (let i = 0; i < 9; i++) { const x = w * (0.2 + 0.6 * R()), y = h * (0.35 + 0.3 * R()), r = h * (0.25 + 0.25 * R()); const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,0.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); } }));
  cloudTex.colorSpace = THREE.SRGBColorSpace;
  for (let i = 0; i < 16; i++) {
    const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, transparent: true, depthWrite: false, fog: false, opacity: 0.8 }));
    const a = R() * Math.PI * 2, d = 1700 + R() * 400;
    m.position.set(Math.cos(a) * d, 320 + R() * 220, Math.sin(a) * d); m.scale.set(520 + R() * 380, 170 + R() * 110, 1); root.add(m);
  }

  // ---- far mountains: a ring of jagged ridges with snow caps, hazed by fog
  {
    // faceted ridges: a gridded wall (rows from the waterline to the crest) with ridged-noise relief, flat-shaded, rock to snow by height
    const seg = 260, rows = 9, ring = (rad, hgt, seed, col, snowLine) => {
      const rr = rnd(seed);
      const ph = [rr() * 6, rr() * 6, rr() * 6, rr() * 6];
      const hash = (i, j) => { const v = Math.sin(i * 127.1 + j * 311.7 + seed * 74.7) * 43758.5453; return v - Math.floor(v); };
      const vn = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
        return hash(xi, yi) * (1 - ux) * (1 - uy) + hash(xi + 1, yi) * ux * (1 - uy) + hash(xi, yi + 1) * (1 - ux) * uy + hash(xi + 1, yi + 1) * ux * uy; };
      const pos = [], idx = [], colA = [];
      const c = new THREE.Color(), rock = new THREE.Color(col), snow = new THREE.Color('#f4f8fc'), dark = new THREE.Color('#9bb4c8');
      for (let i = 0; i <= seg; i++) {
        const a = (i / seg) * Math.PI * 2;
        const n = 0.5 + 0.24 * Math.sin(a * 3 + ph[0]) + 0.16 * Math.sin(a * 7 + ph[1]) + 0.1 * Math.sin(a * 17 + ph[2]) + 0.22 * Math.abs(vn(i * 0.35, 3) - 0.5) * 2;
        const crest = hgt * n;
        for (let j = 0; j <= rows; j++) {
          const t = j / rows;
          const ridge = 1 - Math.abs(vn(i * 0.5 + j * 0.9, j * 1.7) * 2 - 1);              // ridged noise: sharp spurs and gullies
          const y = -40 + (crest + 40) * Math.pow(t, 0.85) * (0.9 + 0.1 * ridge);
          const r = rad * (1 - 0.22 * t) + (ridge - 0.5) * 70 * t;
          pos.push(Math.cos(a) * r, y, Math.sin(a) * r);
          const h01 = Math.max(0, y) / (hgt * 1.1), sn = Math.max(0, Math.min(1, (h01 - snowLine * 0.85) / 0.16 + (ridge - 0.5) * 0.7));
          c.copy(dark).lerp(rock, Math.min(1, t * 2.2)).lerp(snow, sn);
          colA.push(c.r, c.g, c.b);
        }
      }
      for (let i = 0; i < seg; i++) for (let j = 0; j < rows; j++) { const o = i * (rows + 1) + j, q = o + rows + 1; idx.push(o, q, o + 1, o + 1, q, q + 1); }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(colA, 3));
      g.setIndex(new THREE.BufferAttribute(new Uint32Array(idx), 1)); g.computeVertexNormals();
      const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, flatShading: true }));
      m.frustumCulled = false; return m;
    };
    root.add(ring(1250, 330, 11, '#586c80', 0.5), ring(1650, 520, 23, '#6d7f93', 0.42));
  }

  // ---- the fjord water
  const water = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), lam(0x1a6590));
  water.rotation.x = -Math.PI / 2; water.receiveShadow = false; root.add(water); out.water = water;

  // ---- snow texture for the cleared hill: soft grooming stripes and a little sparkle
  const snowTex = new THREE.CanvasTexture(texCanvas(doc, 256, 256, (g, w, h) => {
    g.fillStyle = '#e4eef6'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 16; i++) { g.fillStyle = i % 2 ? 'rgba(170,198,222,0.5)' : 'rgba(255,255,255,0.45)'; g.fillRect((i * w) / 16, 0, w / 16 + 1, h); }
    const img = g.getImageData(0, 0, w, h); let s = 7;
    for (let i = 0; i < img.data.length; i += 4) { s = (s * 1664525 + 1013904223) >>> 0; const n = ((s >>> 24) - 128) * 0.06; img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n; }
    g.putImageData(img, 0, 0);
  }));
  snowTex.colorSpace = THREE.SRGBColorSpace; snowTex.wrapS = snowTex.wrapT = THREE.RepeatWrapping; snowTex.anisotropy = 4;

  const label = (txt, color = '#12202e', bg = '#ffd36a') => {
    const t = new THREE.CanvasTexture(texCanvas(doc, 128, 64, (g, w, h) => { g.fillStyle = bg; g.fillRect(0, 0, w, h); g.fillStyle = color; g.font = '900 44px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, w / 2, h / 2 + 3); g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 4; g.strokeRect(0, 0, w, h); }));
    t.colorSpace = THREE.SRGBColorSpace; return t;
  };

  function disposeGroup(g) {
    g.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; for (const m of ms) { if (m.map && m.map !== snowTex) m.map.dispose(); m.dispose(); } } });
    while (g.children.length) g.remove(g.children[0]);
  }

  out.setHill = (h) => {
    if (out.hillId === h.id) return;
    out.hillId = h.id;
    disposeGroup(hillGroup); out.flags = [];
    const S = shapeFor(h); out.shape = S;
    const Rh = rnd(7 + h.k);
    const K = h.k, zEnd = S.zEnd;
    water.position.y = S.water;

    // ---- terrain
    {
      const x0 = -260, x1 = 260, z0 = Math.min(S.top.x - 130, -170), z1 = zEnd + 230;
      const cell = K > 150 ? 6 : 5;
      const nx = Math.round((x1 - x0) / cell), nz = Math.round((z1 - z0) / cell);
      const pos = new Float32Array((nx + 1) * (nz + 1) * 3), col = new Float32Array((nx + 1) * (nz + 1) * 3);
      const c = new THREE.Color();
      const hAt = new Float32Array((nx + 1) * (nz + 1));
      for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
        const x = x0 + i * cell, z = z0 + j * cell, y = S.terrain(x, z), k = j * (nx + 1) + i;
        pos[k * 3] = x; pos[k * 3 + 1] = y; pos[k * 3 + 2] = z; hAt[k] = y;
      }
      for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
        const k = j * (nx + 1) + i, x = pos[k * 3], z = pos[k * 3 + 2], y = pos[k * 3 + 1];
        const dx = (hAt[j * (nx + 1) + Math.min(nx, i + 1)] - hAt[j * (nx + 1) + Math.max(0, i - 1)]) / (2 * cell), dz = (hAt[Math.min(nz, j + 1) * (nx + 1) + i] - hAt[Math.max(0, j - 1) * (nx + 1) + i]) / (2 * cell);
        const slope = Math.min(1.5, Math.hypot(dx, dz));
        const ax = Math.abs(x), d = ax - S.cw(z);
        const rel = y - S.base(z);
        const patch = Math.sin(x * 0.07 + 2) * Math.cos(z * 0.09 - 1);
        if (y < S.water + 0.4) c.set('#7c8b86');
        else if (d < 7 && z > -40 && z < zEnd + 12) c.set('#e9f0f5');              // groomed snow at the edge of the hill
        else if (y - S.water > 190 + 30 * patch) c.set('#eef3f7');
        else if (slope > 0.95) c.set('#6d6f72');
        else if (slope > 0.62 && patch > 0) c.set('#7a8a86');
        else if (z > zEnd + 12) c.set(patch > 0.3 ? '#9a8d73' : '#5d7653');
        else c.set(patch > 0.2 ? '#cfdfe7' : '#3f6a4a');
        const shade = 0.88 + 0.12 * Math.sin(x * 0.9) * Math.sin(z * 0.8);
        col[k * 3] = c.r * shade; col[k * 3 + 1] = c.g * shade; col[k * 3 + 2] = c.b * shade;
      }
      const idx = new Uint32Array(nx * nz * 6);
      let q = 0;
      for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const a = j * (nx + 1) + i, b = a + 1, c2 = a + nx + 1, d2 = c2 + 1; idx[q++] = a; idx[q++] = c2; idx[q++] = b; idx[q++] = b; idx[q++] = c2; idx[q++] = d2; }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      g.setIndex(new THREE.BufferAttribute(idx, 1)); g.computeVertexNormals();
      const m = new THREE.Mesh(g, std(0xffffff, 0.95, 0, { vertexColors: true }));
      m.receiveShadow = true; hillGroup.add(m);
      out.terrainGrid = { x0, z0, cell, nx, nz, h: hAt };
    }

    // ---- the cleared hill: a snow ribbon over the landing slope and the outrun, lines every 10 m, the K-line
    {
      const zs = [];
      for (let z = 0; z <= zEnd; z += 1.5) zs.push(z);
      const nxs = 8;
      const pos = [], uv = [], idx = [];
      zs.forEach((z, j) => {
        const w = S.cw(z);
        for (let i = 0; i <= nxs; i++) { const x = (i / nxs - 0.5) * 2 * w; pos.push(x, groundY(h, z), z); uv.push(x / 6, z / 6); }
      });
      for (let j = 0; j < zs.length - 1; j++) for (let i = 0; i < nxs; i++) { const a = j * (nxs + 1) + i, b = a + 1, c = a + nxs + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
      g.setIndex(idx); g.computeVertexNormals();
      const m = new THREE.Mesh(g, std(0xffffff, 0.75, 0, { map: snowTex })); m.receiveShadow = true; hillGroup.add(m);
      // lines: merged quads
      const lp = [], lc = [], li = [];
      const quad = (z, w, thick, col, lift = 0.035) => {
        const y = groundY(h, z) + lift, y2 = groundY(h, z + thick) + lift, n = lp.length / 3;
        lp.push(-w, y, z, w, y, z, -w, y2, z + thick, w, y2, z + thick);
        for (let k = 0; k < 4; k++) lc.push(col[0], col[1], col[2]);
        li.push(n, n + 2, n + 1, n + 1, n + 2, n + 3);
      };
      const edge = (z, side) => { const w = S.cw(z); const y = groundY(h, z) + 0.035, z2 = z + 3, y2 = groundY(h, z2) + 0.035, wx = S.cw(z2); const n = lp.length / 3; const a = side * w, b = side * (w - 0.5), a2 = side * wx, b2 = side * (wx - 0.5); lp.push(a, y, z, b, y, z, a2, y2, z2, b2, y2, z2); for (let k = 0; k < 4; k++) lc.push(0.25, 0.5, 0.85); li.push(n, n + 2, n + 1, n + 1, n + 2, n + 3); };
      for (let z = 0; z < zEnd; z += 3) { edge(z, 1); edge(z, -1); }
      for (let z = 10; z < zEnd; z += 10) quad(z, S.cw(z) - 0.2, z % 50 === 0 ? 0.5 : 0.22, z % 50 === 0 ? [0.25, 0.5, 0.9] : [0.55, 0.72, 0.9]);
      quad(K, S.cw(K), 0.8, [0.88, 0.16, 0.12], 0.04);                       // the K-line
      quad(K * 1.18, S.cw(K * 1.18), 0.5, [0.95, 0.65, 0.12], 0.04);         // the hill-size line
      quad(K * 1.5, S.cw(K * 1.5) - 0.2, 0.5, [0.2, 0.2, 0.2], 0.04);        // end of the safe landing area
      const lg = new THREE.BufferGeometry();
      lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3)); lg.setAttribute('color', new THREE.Float32BufferAttribute(lc, 3)); lg.setIndex(li);
      const lm = new THREE.Mesh(lg, new THREE.MeshBasicMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
      hillGroup.add(lm);
      // distance boards on the right side, every 10 or 20 m
      const step = K > 150 ? 20 : 10;
      for (let z = step * 2; z <= K * 1.6; z += step) {
        const sp = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.2), new THREE.MeshBasicMaterial({ map: label(String(Math.round(z)), z === K ? '#fff' : '#12202e', z === K ? '#d81f14' : z > K ? '#ff9a3c' : '#ffd36a'), side: THREE.DoubleSide }));
        const w = S.cw(z) + 1.2, y = groundY(h, z) + 1.0;
        sp.position.set(w, y, z); sp.rotation.y = Math.PI / 2 + 0.25; hillGroup.add(sp);
        const sp2 = sp.clone(); sp2.position.x = -w; sp2.rotation.y = -Math.PI / 2 - 0.25; hillGroup.add(sp2);
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.2, 5), std(0x333b44)); post.position.set(w, y - 0.7, z); hillGroup.add(post);
        const post2 = post.clone(); post2.position.x = -w; hillGroup.add(post2);
      }
    }

    // ---- the in-run: ice track on a trestle, the take-off table, gates, the start tower
    {
      const ip = inrunPath(h), pts = ip.pts;
      const tp = [], tc = [], ti = [];
      const wTrack = 0.9;
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        tp.push(-wTrack, p.y + 0.0, p.x, wTrack, p.y + 0.0, p.x);
        const e = i % 2 ? 0.95 : 0.9;
        tc.push(e, e + 0.03, e + 0.05, e, e + 0.03, e + 0.05);
        if (i < pts.length - 1) { const a = i * 2; ti.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(tp, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(tc, 3)); g.setIndex(ti); g.computeVertexNormals();
      const trackM = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, emissive: 0x2a3a4a })); trackM.receiveShadow = true; hillGroup.add(trackM);
      // side walls of the trestle and the grooves
      const wall = (sx) => {
        const wp = [], wi = [];
        for (let i = 0; i < pts.length; i++) { const p = pts[i]; wp.push(sx * (wTrack + 0.3), p.y - 0.35, p.x, sx * (wTrack + 0.3), p.y + 0.22, p.x); if (i < pts.length - 1) { const a = i * 2; wi.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); } }
        const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(wp, 3)); gg.setIndex(wi); gg.computeVertexNormals();
        return new THREE.Mesh(gg, std(0x6f8aa6, 0.7, 0.1, { side: THREE.DoubleSide }));
      };
      hillGroup.add(wall(1), wall(-1));
      for (const sx of [-0.35, 0.35]) {
        const gp = [], gi = [];
        for (let i = 0; i < pts.length; i++) { const p = pts[i]; gp.push(sx - 0.035, p.y + 0.012, p.x, sx + 0.035, p.y + 0.012, p.x); if (i < pts.length - 1) { const a = i * 2; gi.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); } }
        const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(gp, 3)); gg.setIndex(gi); gg.computeVertexNormals();
        hillGroup.add(new THREE.Mesh(gg, new THREE.MeshBasicMaterial({ color: 0x5a7690 })));
      }
      // pylons under the trestle
      const NP = Math.floor(pts.length / 8);
      const pyl = new THREE.InstancedMesh(new THREE.BoxGeometry(0.5, 1, 0.5), std(0x6a7d8f, 0.6, 0.4), NP * 2);
      const mt = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3();
      let np = 0;
      for (let i = 4; i < pts.length - 4 && np < NP * 2 - 1; i += 8) {
        const p = pts[i], ground = S.terrain(0, p.x), top = p.y - 1.2, hgt = top - ground;
        if (hgt < 0.5) continue;
        for (const sx of [-1.7, 1.7]) { mt.compose(ps.set(sx, ground + hgt / 2, p.x), q.identity(), sc.set(1, hgt, 1)); pyl.setMatrixAt(np++, mt); }
      }
      pyl.count = np; pyl.frustumCulled = false; pyl.castShadow = true; hillGroup.add(pyl);
      // cross braces
      // the take-off table: end of the track, a small ramp lip and side boards
      const lip = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.5, 4.5), std(0x8fa4b6, 0.5, 0.3)); lip.position.set(0, -0.27, -1.6); lip.rotation.x = 0.17; hillGroup.add(lip);
      // the start tower at the top
      const tp0 = pts[0];
      const tower = new THREE.Group();
      const hut = new THREE.Mesh(new THREE.BoxGeometry(7, 3.2, 8), std(0xd9e4ec, 0.6, 0.1)); hut.position.set(14, tp0.y + 2.2, tp0.x - 5.5); tower.add(hut);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(7.6, 0.4, 8.6), std(0x2f4a63)); roof.position.set(14, tp0.y + 4, tp0.x - 5.5); tower.add(roof);
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.1, 5.6), new THREE.MeshBasicMaterial({ color: 0x7fc4e8 })); win.position.set(10.5, tp0.y + 2.5, tp0.x - 5.5); tower.add(win);
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 7, 6), std(0xbdc7d0)); mast.position.set(17, tp0.y + 7.5, tp0.x - 8.5); tower.add(mast);
      hillGroup.add(tower);
      // gate bars: three positions along the start of the in-run, each with a lamp
      out.gates = [];
      for (let g2 = 0; g2 < 3; g2++) {
        const s = h.lin * [0.2, 0.1, 0][g2];
        const p = pts[Math.min(pts.length - 1, Math.round(s / ip.step))];
        const bar = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.08, 0.12), new THREE.MeshBasicMaterial({ color: 0xffc83a })); bar.position.set(0, p.y + 0.42, p.x); hillGroup.add(bar);
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), new THREE.MeshBasicMaterial({ color: 0x555555 })); lamp.position.set(1.4, p.y + 0.5, p.x); hillGroup.add(lamp);
        out.gates.push(lamp);
      }
    }

    // ---- trees (pines with a little snow), instanced, kept off the hill and the water
    {
      const NT = 900;
      const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.16, 0.24, 2.4, 5), lam(0x4a3828), NT);
      const cone = (r, hh, y) => { const gg = new THREE.CylinderGeometry(0.02, r, hh, 7); gg.translate(0, y, 0); return gg; };
      const crowns = [new THREE.InstancedMesh(cone(1.9, 3.2, 3.5), lam(0xffffff), NT), new THREE.InstancedMesh(cone(1.5, 2.8, 5.1), lam(0xffffff), NT), new THREE.InstancedMesh(cone(1.0, 2.4, 6.6), lam(0xffffff), NT)];
      const mt = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), ps = new THREE.Vector3(), c = new THREE.Color();
      let used = 0, tries = 0;
      const g = out.terrainGrid;
      while (used < NT && tries++ < NT * 30) {
        const x = (Rh() - 0.5) * 460, z = g.z0 + 30 + Rh() * (zEnd + 160 - g.z0 - 30);
        const ax = Math.abs(x), cwz = S.cw(z);
        if (ax < cwz + 9 && z > -60 && z < zEnd + 20) continue;
        if (ax < 14 && z < 0 && z > S.top.x - 30) continue;
        const y = S.terrain(x, z);
        if (y < S.water + 1.0) continue;
        if (y - S.base(z) > 60 || y > S.water + 130) continue;
        const dx = S.terrain(x + 4, z) - S.terrain(x - 4, z), dz = S.terrain(x, z + 4) - S.terrain(x, z - 4);
        if (Math.hypot(dx, dz) / 8 > 0.9) continue;
        const s = 0.7 + Rh() * 1.0; e.set(0, Rh() * 6, 0); q.setFromEuler(e); mt.compose(ps.set(x, y, z), q, sc.set(s, s, s));
        trunk.setMatrixAt(used, mt);
        const gg = 0.7 + Rh() * 0.3; c.setRGB(0.03 * gg, 0.13 * gg, 0.085 * gg);
        const snowy = y - S.water > 30 ? 0.5 : 0.12;
        c.lerp(new THREE.Color('#e9f0f4'), snowy * Rh());
        for (const m of crowns) { m.setMatrixAt(used, mt); m.setColorAt(used, c); }
        used++;
      }
      for (const m of [trunk, ...crowns]) { m.count = used; m.frustumCulled = false; hillGroup.add(m); }
    }

    // ---- houses by the water: red and ochre boxes with gable roofs
    {
      const NH = 26;
      const body = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), lam(0xffffff), NH), roof = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.01, 0.8, 0.9, 4, 1), lam(0x39434f), NH);
      const cols = ['#a63a2c', '#b9482f', '#c9a040', '#d8d2c0', '#7d3b2d', '#3d6a8a'];
      const mt = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), ps = new THREE.Vector3(), c = new THREE.Color();
      let used = 0, tries = 0;
      while (used < NH && tries++ < 600) {
        const side = Rh() < 0.5 ? -1 : 1, x = side * (60 + Rh() * 140), z = zEnd + 40 + Rh() * 160;
        const y = S.terrain(x, z);
        if (y < S.water + 0.6 || y > S.water + 14) continue;
        const w = 5 + Rh() * 3, d = 7 + Rh() * 3, hh = 3.2 + Rh() * 1.4, yaw = Rh() * 0.6 - 0.3 + (side > 0 ? 0.5 : -0.5);
        e.set(0, yaw, 0); q.setFromEuler(e);
        mt.compose(ps.set(x, y + hh / 2, z), q, sc.set(w, hh, d)); body.setMatrixAt(used, mt); body.setColorAt(used, c.set(cols[(Rh() * cols.length) | 0]));
        e.set(0, yaw + Math.PI / 4, 0); q.setFromEuler(e);
        mt.compose(ps.set(x, y + hh + 0.45, z), q, sc.set(w * 1.15, 1.0, d * 0.82)); roof.setMatrixAt(used, mt);
        used++;
      }
      body.count = used; roof.count = used; body.frustumCulled = false; roof.frustumCulled = false; hillGroup.add(body, roof);
    }

    // ---- judges' tower beside the K-point, wind flags, a crowd behind a fence
    {
      const jt = new THREE.Group();
      const zK = K * 0.78, x = S.cw(zK) + 7, y = S.terrain(x, zK);
      const box = new THREE.Mesh(new THREE.BoxGeometry(5, 2.6, 8), std(0xe8eef3, 0.5, 0.1)); box.position.set(x, y + 9, zK); jt.add(box);
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.2, 6.6), new THREE.MeshBasicMaterial({ color: 0x1f3a52 })); win.position.set(x - 2.52, y + 9.2, zK); jt.add(win);
      for (const dz of [-3.4, 3.4]) for (const dx of [-2, 2]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.3, 8.4, 0.3), std(0x7b8d9d, 0.6, 0.4)); leg.position.set(x + dx, y + 4, zK + dz); jt.add(leg); }
      hillGroup.add(jt);
      // wind flags: a pole and a flag that points where the wind blows
      for (const [fz, side] of [[K * 0.35, 1], [K * 0.7, -1], [K * 1.05, 1], [K * 1.4, -1]]) {
        const fx = side * (S.cw(fz) + 2.2), fy = groundY(h, fz);
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 9, 6), std(0xcfd8e0)); pole.position.set(fx, fy + 4.5, fz); hillGroup.add(pole);
        const geo = new THREE.PlaneGeometry(2.8, 1.1, 8, 1); geo.translate(1.4, 0, 0);
        const flag = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: side > 0 ? 0xd9402e : 0xf2f2f2, side: THREE.DoubleSide }));
        flag.position.set(fx, fy + 8.3, fz); hillGroup.add(flag); out.flags.push({ flag, base: geo.attributes.position.array.slice() });
      }
      // fence + crowd
      const NC = K > 150 ? 360 : 280;
      const bodyG = new THREE.CylinderGeometry(0.24, 0.2, 0.72, 7); bodyG.translate(0, 1.0, 0);
      const legG = new THREE.CylinderGeometry(0.19, 0.17, 0.66, 7); legG.translate(0, 0.33, 0);
      const headG = new THREE.SphereGeometry(0.15, 8, 6); headG.translate(0, 1.5, 0);
      const armG = new THREE.CylinderGeometry(0.055, 0.05, 0.62, 5); armG.translate(0, -0.31, 0);
      const arms = new THREE.InstancedMesh(armG, std(0xffffff, 0.8), NC * 2);
      const legs = new THREE.InstancedMesh(legG, std(0x2a2d36, 0.9), NC), bodies = new THREE.InstancedMesh(bodyG, std(0xffffff, 0.9), NC), heads = new THREE.InstancedMesh(headG, std(0xffffff, 0.8), NC);
      const cols = ['#c0392b', '#2c5d8f', '#e8e4d8', '#1e3a5f', '#d98a2b', '#4f7d5e', '#7a4f7c', '#b8c4cc', '#a83a3a', '#2f2f3a'];
      const skin = ['#e8c3a2', '#d9a982', '#b98563', '#f1d3b8', '#8f5f43'];
      const c = new THREE.Color(), base = [];
      for (let i = 0; i < NC; i++) {
        const zone = Rh(); let z, side;
        if (zone < 0.55) { z = K * (0.85 + Rh() * 0.9); side = Rh() < 0.5 ? -1 : 1; } else { z = K * (1.5 + Rh() * 0.8); side = Rh() < 0.5 ? -1 : 1; }
        const x2 = side * (S.cw(z) + 3.2 + Rh() * 4.5), y2 = S.terrain(x2, z);
        base.push({ x: x2, y: y2, z, ph: Rh() * 6.28, sc: 0.9 + Rh() * 0.2, rot: Math.atan2(-x2, 0) + (side > 0 ? Math.PI / 2 : -Math.PI / 2) });
        bodies.setColorAt(i, c.set(cols[(Rh() * cols.length) | 0])); heads.setColorAt(i, c.set(skin[(Rh() * skin.length) | 0]));
      }
      for (let i = 0; i < NC; i++) { arms.setColorAt(i * 2, c.set(skin[(i * 3) % skin.length])); arms.setColorAt(i * 2 + 1, c.set(skin[(i * 3) % skin.length])); }
      for (const m of [legs, bodies, heads, arms]) { m.frustumCulled = false; hillGroup.add(m); }
      const mtx = new THREE.Matrix4(), qq = new THREE.Quaternion(), ee = new THREE.Euler(), scl = new THREE.Vector3(), p0 = new THREE.Vector3(), p1 = new THREE.Vector3();
      out.crowd = {
        cheer: 0, t: 0,
        update(dt, cheer) {
          this.t += dt; this.cheer += (cheer - this.cheer) * Math.min(1, dt * 4);
          for (let i = 0; i < NC; i++) {
            const b = base[i];
            const bob = Math.abs(Math.sin(this.t * (2.2 + (i % 5) * 0.2) + b.ph)) * (0.03 + 0.25 * this.cheer);
            ee.set(0, b.rot, 0); qq.setFromEuler(ee); scl.set(b.sc, b.sc * (1 + this.cheer * 0.03), b.sc); p0.set(b.x, b.y + bob, b.z);
            mtx.compose(p0, qq, scl); bodies.setMatrixAt(i, mtx); heads.setMatrixAt(i, mtx); legs.setMatrixAt(i, mtx);
            for (let k = 0; k < 2; k++) {
              const sd = k ? 1 : -1, lift = this.cheer * (2.2 + Math.sin(this.t * 7 + b.ph + k) * 0.5);
              ee.set(0, b.rot, sd * (0.12 + lift)); qq.setFromEuler(ee); ee.set(0, b.rot, 0);
              const off = p1.set(sd * 0.27 * b.sc, 1.3 * b.sc, 0).applyEuler(ee);
              mtx.compose(scl.set(b.sc, b.sc, b.sc), qq, scl); // placeholder replaced below
              mtx.compose(new THREE.Vector3(p0.x + off.x, p0.y + off.y, p0.z + off.z), qq, scl.set(b.sc, b.sc, b.sc)); arms.setMatrixAt(i * 2 + k, mtx);
            }
          }
          bodies.instanceMatrix.needsUpdate = true; heads.instanceMatrix.needsUpdate = true; legs.instanceMatrix.needsUpdate = true; arms.instanceMatrix.needsUpdate = true;
        },
      };
      out.crowd.update(0, 0);
      // fences along both sides of the landing slope
      const fenceM = std(0xd94b3a, 0.6);
      for (const sd of [-1, 1]) {
        const fp = [], fi = [];
        for (let z = K * 0.82; z <= K * 2.2; z += 4) { const w = S.cw(z) + 1.8, y = groundY(h, z); fp.push(sd * w, y + 0.0, z, sd * w, y + 1.05, z); if (z > K * 0.82) { const n = fp.length / 3 - 4; fi.push(n, n + 1, n + 2, n + 1, n + 3, n + 2); } }
        const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.Float32BufferAttribute(fp, 3)); fg.setIndex(fi); fg.computeVertexNormals();
        hillGroup.add(new THREE.Mesh(fg, new THREE.MeshLambertMaterial({ color: 0xd94b3a, side: THREE.DoubleSide })));
      }
    }
  };

  out.setWind = (wind, t) => {
    if (!out.flags.length) return;
    const wx = wind ? wind.cross : 0, wz = wind ? -wind.head : 0;
    const ang = Math.atan2(wx, wz), mag = Math.min(1, Math.hypot(wx, wz) / 2.5);
    for (const f of out.flags) {
      const pa = f.flag.geometry.attributes.position, arr = pa.array;
      for (let i = 0; i < pa.count; i++) {
        const bx = f.base[i * 3], by = f.base[i * 3 + 1];
        arr[i * 3 + 2] = Math.sin(bx * 2.4 - t * (4 + 4 * mag)) * (0.05 + 0.2 * mag) * bx;
        arr[i * 3 + 1] = by - (1 - mag) * 0.9 * bx * 0.45;
      }
      pa.needsUpdate = true;
      f.flag.rotation.y = ang - Math.PI / 2;
    }
  };
  return out;
}

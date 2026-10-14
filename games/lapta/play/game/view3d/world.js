// The village green in 3D: mown meadow with the chalked court, the wooden fence and far-line posts, log farmhouses, haystacks and birch trees.
// Plain three.js geometry and canvas textures (no image files); the scenery is merged into a few vertex-coloured meshes (a handful of draw calls).
// World axes: X = across the green (sim x), Y = height, Z = -(sim y), so the far line is toward -Z and the batter's home line is at Z = 0.
import { K } from '../src/sim.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const hash = (i) => { const v = Math.sin(i * 12.9898 + 4.1) * 43758.5453; return v - Math.floor(v); };
const lcg = (seed) => { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; };
const hex = (c) => [parseInt(c.slice(1, 3), 16) / 255, parseInt(c.slice(3, 5), 16) / 255, parseInt(c.slice(5, 7), 16) / 255].map((v) => Math.pow(v, 2.2));

export const COURT = { x0: -K.W, x1: K.W, y0: -3, y1: K.D + 3.5 };

export function buildWorld(V3, stage, { quality = 'high' } = {}) {
  const { THREE, buildScenery } = V3;
  const doc = globalThis.document;
  const aniso = Math.min(8, stage.renderer.capabilities.getMaxAnisotropy());
  const W = { quality };
  const root = new THREE.Group(); root.name = 'lapta-world';
  stage.scene.add(root);
  W.root = root;
  const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.92, metalness: 0, ...o });
  const canvasTex = (w, h, draw, { repeat = null, srgb = true } = {}) => {
    const c = doc.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = aniso;
    if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
    return t;
  };
  const px = quality === 'low' ? 30 : quality === 'medium' ? 44 : 60;      // court texture pixels per metre

  // ---- the meadow: darker rough grass with wide mowing bands, tiled -------------------------------------------------------------------
  const meadowTex = canvasTex(512, 512, (g, w, h) => {
    const r = lcg(31);
    g.fillStyle = '#4f9a3f'; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(0, 0, w, h / 2);
    g.fillStyle = 'rgba(0,0,0,0.045)'; g.fillRect(0, h / 2, w, h / 2);
    for (let i = 0; i < 1800; i++) {
      const x = r() * w, y = r() * h, l = 4 + r() * 8, a = -Math.PI / 2 + (r() - 0.5) * 0.8;
      g.strokeStyle = r() < 0.5 ? `rgba(150,215,100,${0.18 + r() * 0.2})` : `rgba(30,80,30,${0.15 + r() * 0.2})`;
      g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
    for (let i = 0; i < 24; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '205,200,90' : '240,236,220'},0.5)`; g.beginPath(); g.arc(r() * w, r() * h, 1.4 + r() * 1.2, 0, 7); g.fill(); }   // clover and daisies
  }, { repeat: [40, 40] });
  const meadow = new THREE.Mesh(new THREE.PlaneGeometry(320, 320), std({ map: meadowTex, roughness: 1 }));
  meadow.rotation.x = -Math.PI / 2; meadow.position.set(0, 0, -100); meadow.receiveShadow = true;
  root.add(meadow);

  // ---- the sky and the distant country: the scenery kit (photographic sky, birch and village bands) behind the green ------------------------------
  try {
    const sc = buildScenery({ layers: [
      { t: 'band', id: 'band-hills-green', r: 150, h: 34, arc: [-175, -5] },
      { t: 'band', id: 'band-birch', r: 96, h: 22, arc: [-170, -10] },
    ], timeOfDay: 'day', quality, clouds: true });
    sc.group.position.set(0, -0.2, -10);
    root.add(sc.group);
    W.scenery = sc;
  } catch (e) { console.warn('scenery failed', e); }

  // ---- the court: evenly mown, chalked, with worn earth at home, the server's spot and the far line ------------------------------------
  const CW = COURT.x1 - COURT.x0, CD = COURT.y1 - COURT.y0;
  const courtTex = canvasTex(Math.round(CW * px), Math.round(CD * px), (g, w, h) => {
    const r = lcg(7);
    const X = (x) => (x - COURT.x0) * px, Y = (y) => (COURT.y1 - y) * px;       // sim (x, y) -> texture
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#6bb34c'); gr.addColorStop(1, '#5fa944');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let y = COURT.y0, k = 0; y < COURT.y1; y += 2.2, k++) { g.fillStyle = k & 1 ? 'rgba(255,255,255,0.07)' : 'rgba(0,40,0,0.05)'; g.fillRect(0, Y(y + 2.2), w, 2.2 * px + 1); }
    for (let i = 0; i < 5200; i++) {
      const x = r() * w, y = r() * h, l = 3 + r() * 7, a = -Math.PI / 2 + (r() - 0.5) * 0.7;
      g.strokeStyle = r() < 0.5 ? `rgba(170,230,120,${0.12 + r() * 0.16})` : `rgba(30,90,30,${0.1 + r() * 0.15})`;
      g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
    // worn earth
    const earth = (x, y, rx, ry) => {
      const q = g.createRadialGradient(X(x), Y(y), 1, X(x), Y(y), Math.max(rx, ry) * px);
      q.addColorStop(0, 'rgba(150,118,70,0.78)'); q.addColorStop(0.6, 'rgba(150,118,70,0.5)'); q.addColorStop(1, 'rgba(150,118,70,0)');
      g.save(); g.translate(X(x), Y(y)); g.scale(1, ry / rx); g.translate(-X(x), -Y(y));
      g.fillStyle = q; g.beginPath(); g.arc(X(x), Y(y), rx * px, 0, 7); g.fill(); g.restore();
    };
    earth(0, 0.6, 3.8, 2.6); earth(0, K.THROW_Y, 1.7, 1.1); earth(0, K.D + 0.2, 7, 1.1);
    for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(110,84,46,${0.1 + r() * 0.2})`; g.beginPath(); g.arc(X((r() - 0.5) * 6.4), Y(0.6 + (r() - 0.5) * 4.4), 0.6 + r() * 1.6, 0, 7); g.fill(); }
    // chalk, slightly irregular
    const lw = 0.16 * px;
    g.lineCap = 'round';
    const line = (x0, y0, x1, y1, dash) => {
      g.setLineDash(dash || []); g.strokeStyle = 'rgba(250,248,235,0.5)'; g.lineWidth = lw * 1.5; g.beginPath(); g.moveTo(X(x0), Y(y0)); g.lineTo(X(x1), Y(y1)); g.stroke();
      g.strokeStyle = 'rgba(252,250,240,0.94)'; g.lineWidth = lw; g.stroke(); g.setLineDash([]);
    };
    line(-K.W, 0, K.W, 0); line(-K.W, K.D, K.W, K.D);
    line(-K.W, 0, -K.W, K.D, [0.7 * px, 0.7 * px]); line(K.W, 0, K.W, K.D, [0.7 * px, 0.7 * px]);
    g.strokeStyle = 'rgba(252,250,240,0.92)'; g.lineWidth = 0.12 * px; g.lineCap = 'butt';
    g.strokeRect(X(-2.2), Y(1.8), 4.4 * px, 3.6 * px);                    // the batter's house
    g.setLineDash([]);
    // far-line posts leave a little worn patch
  });
  const court = new THREE.Mesh(new THREE.PlaneGeometry(CW, CD), std({ map: courtTex, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  court.rotation.x = -Math.PI / 2; court.position.set((COURT.x0 + COURT.x1) / 2, 0.003, -(COURT.y0 + COURT.y1) / 2); court.receiveShadow = true;
  root.add(court);

  // ---- merged scenery ----------------------------------------------------------------------------------------------------------------------
  const merge = (parts) => {
    const Pp = [], N = [], C = [], I = [], UV = [];
    let base = 0;
    for (const { geo, color, m } of parts) {
      if (m) geo.applyMatrix4(m);
      const keep = geo.userData.keepNormals;
      const g = geo.index ? geo.toNonIndexed() : geo;
      if (!keep) g.computeVertexNormals();
      const p = g.attributes.position, n = g.attributes.normal, uv = g.attributes.uv;
      for (let i = 0; i < p.count; i++) { Pp.push(p.getX(i), p.getY(i), p.getZ(i)); N.push(n.getX(i), n.getY(i), n.getZ(i)); C.push(color[0], color[1], color[2]); UV.push(uv ? uv.getX(i) : 0, uv ? uv.getY(i) : 0); I.push(base + i); }
      base += p.count;
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.Float32BufferAttribute(Pp, 3));
    out.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
    out.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
    out.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
    out.setIndex(I);
    return out;
  };
  const Mx = (x, y, z, sx = 1, sy = 1, sz = 1, ry = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(sx, sy, sz));
  const box = (w, h, d, x, y, z, col, ry = 0) => ({ geo: new THREE.BoxGeometry(w, h, d), color: hex(col), m: Mx(x, y, z, 1, 1, 1, ry) });
  const ball = (r, x, y, z, col, sy = 1) => ({ geo: new THREE.SphereGeometry(1, 10, 8), color: hex(col), m: Mx(x, y, z, r, r * sy, r) });
  const prism = (w, h, len, x, y, z, col) => {
    // gable roof: triangle in XY (width w, height h), extruded along Z (len)
    const a = [-w / 2, 0, -len / 2], b = [w / 2, 0, -len / 2], c = [0, h, -len / 2], d = [-w / 2, 0, len / 2], e = [w / 2, 0, len / 2], f = [0, h, len / 2];
    const tri = (...v) => v.flat();
    const pos = [...tri(a, c, b), ...tri(d, e, f), ...tri(a, d, f), ...tri(a, f, c), ...tri(b, c, f), ...tri(b, f, e), ...tri(a, b, e), ...tri(a, e, d)];
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    return { geo: g, color: hex(col), m: Mx(x, y, z) };
  };
  const sceneryMat = std({ vertexColors: true, roughness: 0.95 });
  const addMerged = (parts, { cast = false } = {}) => {
    const m = new THREE.Mesh(merge(parts), sceneryMat);
    m.castShadow = cast; m.receiveShadow = true;
    root.add(m);
    return m;
  };
  const posAt = (x, y) => [x, -y];

  // fence: far run and both sides; posts and two rails
  {
    const parts = [], post = '#8e6232', rail = '#a47a42';
    const run = (x0, y0, x1, y1) => {
      const len = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.round(len / 1.9)), ang = Math.atan2(-(y1 - y0), x1 - x0);
      for (let i = 0; i <= n; i++) { const [x, z] = posAt(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n); parts.push(box(0.28, 1.5, 0.28, x, 0.75, z, post)); }
      const mx = (x0 + x1) / 2, my = (y0 + y1) / 2, [cx, cz] = posAt(mx, my);
      for (const h of [0.62, 1.2]) parts.push({ geo: new THREE.BoxGeometry(len, 0.17, 0.12), color: hex(rail), m: Mx(cx, h, cz, 1, 1, 1, ang) });
    };
    run(-K.FENCE_X - 4, K.FENCE_Y, K.FENCE_X + 4, K.FENCE_Y);
    run(-K.FENCE_X, K.BACK_Y, -K.FENCE_X, K.FENCE_Y);
    run(K.FENCE_X, K.BACK_Y, K.FENCE_X, K.FENCE_Y);
    W.fence = addMerged(parts);
  }
  // the two far-line posts, with a pale band
  {
    const parts = [];
    for (const sx of [-K.W, K.W]) { const [x, z] = posAt(sx, K.D); parts.push(box(0.42, 1.9, 0.42, x, 0.95, z, '#9b6a35'), box(0.44, 0.34, 0.44, x, 1.35, z, '#e9d6a8')); }
    W.posts = addMerged(parts, { cast: true });
  }
  // ---- farmhouses (izbas) beyond the far fence: log walls, plank roof, carved window frames, brick chimney, porch ---------------------------------------
  const HOUSES = [[-14, 41.5, 0], [-2, 43.5, 1], [11, 41, 2], [24, 43, 1], [-27, 43, 2], [-40, 42, 0], [38, 41.5, 2]];
  const HAYSTACKS = [[-5, 36.5], [7, 37.5], [-19, 36], [19, 36.5]];
  const TREES = [[-24, 34, 1.15], [-17.5, 31.5, 1.0], [-9, 33.5, 0.9], [4, 34.5, 1.1], [14, 32.5, 1.0], [22, 34, 1.2], [-23, 12, 1.2], [23, 8, 1.25], [-23, 22, 1.0], [24, 24, 1.1], [-32, 30, 1.3], [32, 28, 1.2], [-30, 4, 1.1], [31, 14, 1.0]];
  const T = {};
  T.log = canvasTex(256, 256, (g, w, h) => {
    const r = lcg(5), n = 8, lh = h / n;
    for (let i = 0; i < n; i++) {
      const y = i * lh, gr = g.createLinearGradient(0, y, 0, y + lh);
      gr.addColorStop(0, '#c0884a'); gr.addColorStop(0.45, '#a56e36'); gr.addColorStop(1, '#6f4622');
      g.fillStyle = gr; g.fillRect(0, y, w, lh);
      for (let k = 0; k < 26; k++) { g.strokeStyle = `rgba(${r() < 0.5 ? '60,34,14' : '220,170,110'},${0.12 + r() * 0.18})`; g.lineWidth = 1; const yy = y + 3 + r() * (lh - 6); g.beginPath(); g.moveTo(r() * w, yy); g.lineTo(r() * w, yy + (r() - 0.5) * 3); g.stroke(); }
      g.fillStyle = 'rgba(30,16,6,0.55)'; g.fillRect(0, y + lh - 2, w, 2);
    }
  }, { repeat: [1, 1] });
  T.roof = canvasTex(256, 256, (g, w, h) => {
    const r = lcg(9), rows = 10, rh = h / rows;
    g.fillStyle = '#6b5a4a'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < rows; i++) for (let j = -1; j < 14; j++) {
      const x = j * (w / 12) + (i & 1 ? w / 24 : 0), tone = 70 + r() * 36;
      g.fillStyle = `rgb(${tone + 20},${tone + 6},${tone - 8})`; g.fillRect(x, i * rh, w / 12 - 1.5, rh - 1.5);
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(x, i * rh + rh - 4, w / 12, 3);
    }
  });
  T.win = canvasTex(128, 160, (g, w, h) => {
    g.fillStyle = '#f6efe0'; g.fillRect(0, 0, w, h);                              // carved white frame (nalichnik)
    g.fillStyle = '#e8dcc4'; for (let i = 0; i < 8; i++) { g.beginPath(); g.arc(8 + i * 15, 10, 8, Math.PI, 0); g.fill(); }
    g.fillStyle = '#4c6f9c'; g.fillRect(16, 26, w - 32, h - 44);
    const gl = g.createLinearGradient(0, 26, w, h); gl.addColorStop(0, 'rgba(255,255,255,0.45)'); gl.addColorStop(0.5, 'rgba(255,255,255,0)'); gl.addColorStop(1, 'rgba(255,255,255,0.18)');
    g.fillStyle = gl; g.fillRect(16, 26, w - 32, h - 44);
    g.fillStyle = '#f6efe0'; g.fillRect(w / 2 - 3, 26, 6, h - 44); g.fillRect(16, h / 2 - 3, w - 32, 6);
    g.fillStyle = '#d9cdb2'; g.fillRect(8, h - 16, w - 16, 10);
    g.fillStyle = 'rgba(230,80,90,0.5)'; g.fillRect(22, 32, 34, 34);                // a curtain
  });
  T.door = canvasTex(64, 128, (g, w, h) => {
    g.fillStyle = '#5a3b25'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 5; i++) { g.fillStyle = i & 1 ? '#6a4630' : '#5a3b25'; g.fillRect(i * 12.8, 0, 12.8, h); }
    g.strokeStyle = '#e8d9b6'; g.lineWidth = 5; g.strokeRect(2, 2, w - 4, h - 4); g.fillStyle = '#d8c070'; g.beginPath(); g.arc(w - 12, h / 2, 3.5, 0, 7); g.fill();
  });
  {
    const matBy = {
      log: std({ map: T.log, roughness: 0.9 }), roof: std({ map: T.roof, roughness: 0.85 }), win: std({ map: T.win, roughness: 0.5 }), door: std({ map: T.door, roughness: 0.8 }),
      plain: sceneryMat,
    };
    const parts = { log: [], roof: [], win: [], door: [], plain: [] };
    const plane = (w, h, x, y, z, ry = 0) => ({ geo: new THREE.PlaneGeometry(w, h), color: [1, 1, 1], m: Mx(x, y, z, 1, 1, 1, ry) });
    const house = (hx, hy, k) => {
      const [x, z] = posAt(hx, hy), w = 7.4 + (k % 2) * 0.8, d = 5.2, wallH = 3.0, rise = 2.5;
      parts.log.push({ geo: new THREE.BoxGeometry(w, wallH, d), color: [1, 1, 1], m: Mx(x, wallH / 2, z) });
      // gable ends are log-planked triangles; the roof is two plank slabs with an overhang
      const slope = Math.hypot(w / 2 + 0.55, rise), ang = Math.atan2(rise, w / 2 + 0.55);
      for (const sgn of [-1, 1]) {
        const slab = new THREE.BoxGeometry(slope, 0.16, d + 1.1);
        const m = new THREE.Matrix4().compose(new THREE.Vector3(x + sgn * (w / 4 + 0.27), wallH + rise / 2 + 0.03, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), -sgn * ang), new THREE.Vector3(1, 1, 1));
        parts.roof.push({ geo: slab, color: [1, 1, 1], m });
      }
      parts.log.push({ geo: new THREE.CylinderGeometry(0.2, 0.2, d + 1.3, 8), color: [1, 1, 1], m: new THREE.Matrix4().compose(new THREE.Vector3(x, wallH + rise + 0.12, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0)), new THREE.Vector3(1, 1, 1)) });
      parts.plain.push(prism(w, rise, d, x, wallH, z, '#b98a52'));
      parts.plain.push(box(0.9, 2.0, 0.9, x - w * 0.28, wallH + 2.0, z - 0.6, '#8d4a36'), box(1.1, 0.2, 1.1, x - w * 0.28, wallH + 3.1, z - 0.6, '#5c4636'));
      // windows front (+Z) and sides, a door and two porch steps
      for (const wx of [-w * 0.27, w * 0.27]) parts.win.push(plane(1.5, 1.9, x + wx, 1.75, z + d / 2 + 0.03));
      parts.win.push(plane(1.4, 1.8, x + w / 2 + 0.03, 1.75, z, Math.PI / 2), plane(1.4, 1.8, x - w / 2 - 0.03, 1.75, z, -Math.PI / 2));
      parts.door.push(plane(1.2, 2.3, x, 1.15, z + d / 2 + 0.03));
      parts.plain.push(box(2.0, 0.22, 0.9, x, 0.11, z + d / 2 + 0.5, '#8a6a42'), box(1.6, 0.22, 0.5, x, 0.33, z + d / 2 + 0.3, '#9a7a4c'));
      parts.plain.push(box(w + 0.3, 0.3, d + 0.3, x, 0.15, z, '#6b5a4a'));   // stone plinth
    };
    HOUSES.forEach(([x, y, k]) => house(x, y, k));
    HAYSTACKS.forEach(([hx, hy]) => {
      const [x, z] = posAt(hx, hy);
      parts.plain.push({ geo: new THREE.CylinderGeometry(0.02, 1.7, 2.9, 14), color: hex('#d9b04c'), m: Mx(x, 1.45, z) }, ball(1.5, x, 0.5, z, '#c79a3a', 0.55));
      parts.plain.push(box(0.12, 3.4, 0.12, x, 1.7, z, '#6b4a2a'));
    });
    // a well with a sweep (zhuravl), a bench and a log pile by the far fence
    {
      const [wx, wz] = posAt(-9.5, 37.5);
      parts.log.push({ geo: new THREE.CylinderGeometry(0.75, 0.75, 0.9, 12), color: [1, 1, 1], m: Mx(wx, 0.45, wz) });
      parts.plain.push(box(0.16, 4.4, 0.16, wx + 1.9, 2.2, wz, '#5c4636'), box(5.4, 0.14, 0.14, wx + 0.3, 4.1, wz, '#6b4a2a'), box(0.08, 2.4, 0.08, wx - 2.3, 2.8, wz, '#3a2a1a'), box(0.5, 0.5, 0.5, wx - 2.3, 1.5, wz, '#7a5a30'));
      const [bx, bz] = posAt(17.5, 28.5);
      parts.plain.push(box(2.1, 0.12, 0.5, bx, 0.55, bz, '#a47a42'), box(2.1, 0.5, 0.1, bx, 0.9, bz - 0.25, '#a47a42'), box(0.12, 0.55, 0.45, bx - 0.9, 0.27, bz, '#6b4a2a'), box(0.12, 0.55, 0.45, bx + 0.9, 0.27, bz, '#6b4a2a'));
      const [lx, lz] = posAt(-20, 35);
      for (let i = 0; i < 6; i++) parts.log.push({ geo: new THREE.CylinderGeometry(0.22, 0.22, 2.2, 8), color: [1, 1, 1], m: new THREE.Matrix4().compose(new THREE.Vector3(lx + (i % 3) * 0.45 - 0.45, 0.22 + Math.floor(i / 3) * 0.38, lz), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, Math.PI / 2)), new THREE.Vector3(1, 1, 1)) });
    }
    W.village = new THREE.Group(); root.add(W.village);
    for (const key of Object.keys(parts)) {
      if (!parts[key].length) continue;
      const m = new THREE.Mesh(merge(parts[key]), matBy[key]);
      m.castShadow = key !== 'win' && key !== 'door'; m.receiveShadow = true; W.village.add(m);
    }
  }
  // ---- birch trees: white bark with dark marks, a crown of soft, displaced leaf clumps ------------------------------------------------------------
  {
    const leaf = ['#7dbb4a', '#6aa83f', '#8cc955', '#9ad25c', '#5f9a3a'];
    const clump = (r, x, y, z, col, k) => {
      const g = new THREE.SphereGeometry(1, 20, 14);
      const p = g.attributes.position, n = new Float32Array(p.count * 3);
      for (let i = 0; i < p.count; i++) {
        const vx = p.getX(i), vy = p.getY(i), vz = p.getZ(i), l = Math.hypot(vx, vy, vz) || 1;
        const th = Math.atan2(vz, vx), ph = Math.acos(Math.max(-1, Math.min(1, vy / l))), d = 1 + 0.13 * Math.sin(th * 3 + k * 1.7) * Math.sin(ph * 4 + k) + 0.07 * Math.sin(th * 5 - k * 0.9 + ph * 2);
        p.setXYZ(i, vx / l * d, vy / l * d * 0.86, vz / l * d); n[i * 3] = vx / l; n[i * 3 + 1] = vy / l; n[i * 3 + 2] = vz / l;
      }
      g.setAttribute('normal', new THREE.BufferAttribute(n, 3)); g.userData.keepNormals = true;
      return { geo: g, color: hex(col), m: Mx(x, y, z, r, r, r, k) };
    };
    const tree = (parts, hx, hy, sc, k) => {
      const [x, z] = posAt(hx, hy);
      parts.push({ geo: new THREE.CylinderGeometry(0.17 * sc, 0.26 * sc, 4.2 * sc, 9), color: hex('#f4f1e8'), m: Mx(x, 2.1 * sc, z) });
      for (let i = 0; i < 7; i++) parts.push(box(0.42 * sc * (0.5 + hash(k + i) * 0.6), 0.1 * sc, 0.4 * sc, x + 0.02, (0.35 + i * 0.55 + hash(k + i * 3) * 0.2) * sc, z + 0.15 * sc, '#2b2a28'));
      const blobs = [[0, 5.6, 1.5], [-1.3, 4.8, 1.2], [1.35, 4.9, 1.25], [0.1, 6.5, 1.0], [0.3, 4.4, 1.35], [-0.7, 5.9, 1.05], [0.9, 5.7, 1.1], [-1.9, 4.3, 0.8], [1.9, 4.4, 0.85]];
      blobs.forEach(([bx, by, rr], i) => parts.push(clump(rr * sc, x + bx * sc, by * sc, z + (hash(k + i) - 0.5) * 1.0 * sc, leaf[(i + k) % 5], k + i)));
    };
    const parts = [];
    TREES.forEach(([x, y, sc], i) => tree(parts, x, y, sc, i * 7));
    W.trees = addMerged(parts, { cast: true });
    const hparts = [];
    tree(hparts, -6.4, 3.0, 0.62, 3); tree(hparts, 6.5, 3.6, 0.58, 11);
    W.heroTrees = addMerged(hparts, { cast: true });
    W.heroTrees.visible = false;
  }
  // soft tree and house shadows on the meadow (one translucent mesh; the people use the real shadow map)
  {
    const parts = [];
    const disc = (hx, hy, rx, rz, a) => { const [x, z] = posAt(hx, hy); const g = new THREE.CircleGeometry(1, 20); g.rotateX(-Math.PI / 2); parts.push({ geo: g, color: [0, 0, 0, a], m: Mx(x + rx * 0.35, 0.02, z + rz * 0.2, rx, 1, rz) }); };
    TREES.forEach(([x, y, sc]) => disc(x, y, 2.6 * sc, 1.3 * sc, 1));
    HOUSES.forEach(([x, y]) => disc(x, y, 5, 2.8, 1));
    HAYSTACKS.forEach(([x, y]) => disc(x, y, 2.2, 1, 1));
    const geo = merge(parts.map((p) => ({ geo: p.geo, color: [1, 1, 1], m: p.m })));
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x0a2a08, transparent: true, opacity: 0.16, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
    m.renderOrder = -1;
    root.add(m);
    W.treeShadows = m;
  }

  // ---- the ball, its ground shadow ----------------------------------------------------------------------------------------------------
  {
    const tex = canvasTex(128, 128, (g, w, h) => {
      const gr = g.createRadialGradient(w * 0.38, h * 0.36, 4, w / 2, h / 2, w * 0.5);
      gr.addColorStop(0, '#fffdf2'); gr.addColorStop(0.55, '#f1e4bc'); gr.addColorStop(1, '#bba66b');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.strokeStyle = 'rgba(120,70,30,0.8)'; g.lineWidth = 5; g.beginPath(); g.arc(w * 0.2, h * 0.5, w * 0.42, -1.1, 1.1); g.stroke(); g.beginPath(); g.arc(w * 0.8, h * 0.5, w * 0.42, Math.PI - 1.1, Math.PI + 1.1); g.stroke();
    });
    W.ball = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), std({ map: tex, roughness: 0.6 }));
    W.ball.castShadow = true; W.ball.visible = false; root.add(W.ball);
    const sc = canvasTex(64, 64, (g, w, h) => { const q = g.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2); q.addColorStop(0, 'rgba(0,0,0,0.6)'); q.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = q; g.fillRect(0, 0, w, h); });
    W.ballShadow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: sc, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
    W.ballShadow.rotation.x = -Math.PI / 2; W.ballShadow.visible = false; root.add(W.ballShadow);
  }

  // ---- bunting between the far-line posts: small pennants hung on a string that sway in the breeze; and dust puffs where the ball bounces ---------------
  {
    W.bunting = new THREE.Group(); root.add(W.bunting);
    const cols = [0xd9402f, 0xf4efe0, 0xf1b91e, 0x3b72d8, 0xf4efe0, 0xd9402f];
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([-0.22, 0, 0, 0.22, 0, 0, 0, -0.5, 0, -0.22, 0, 0, 0, -0.5, 0, 0.22, 0, 0], 3));
    geo.computeVertexNormals();
    const N = 17;
    for (let i = 0; i < N; i++) {
      const u = (i + 0.5) / N, x = -K.W + u * 2 * K.W, sag = 0.55 * Math.sin(Math.PI * u), y = 2.15 - sag;
      const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: cols[i % cols.length], roughness: 0.9, side: THREE.DoubleSide }));
      m.position.set(x, y, -K.D); m.userData.ph = i * 0.7; m.castShadow = false; W.bunting.add(m);
    }
    const lineGeo = new THREE.BufferGeometry();
    const lp = []; for (let i = 0; i <= 24; i++) { const u = i / 24; lp.push(-K.W + u * 2 * K.W, 2.15 - 0.55 * Math.sin(Math.PI * u) + 0.02, -K.D); }
    lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3));
    W.bunting.add(new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: 0x4a3a28 })));
    W.updateBunting = (t) => { W.bunting.children.forEach((m) => { if (m.userData.ph !== undefined) { m.rotation.z = Math.sin(t * 1.7 + m.userData.ph) * 0.18; m.rotation.x = Math.sin(t * 1.3 + m.userData.ph * 1.7) * 0.35; } }); };
    // dust puffs: a pool of soft sprites that grow and fade
    const dustTex = canvasTex(64, 64, (g, w, h) => { const q = g.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2); q.addColorStop(0, 'rgba(214,190,140,0.9)'); q.addColorStop(1, 'rgba(214,190,140,0)'); g.fillStyle = q; g.fillRect(0, 0, w, h); });
    W.puffs = [];
    for (let i = 0; i < 12; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: dustTex, transparent: true, depthWrite: false, opacity: 0 })); sp.visible = false; root.add(sp); W.puffs.push({ sp, t: 9 }); }
    W.puff = (x, y, z, n = 3) => { for (let k = 0; k < n; k++) { const p = W.puffs.find((q) => q.t >= 1); if (!p) return; p.t = 0; p.vx = (Math.random() - 0.5) * 0.9; p.vz = (Math.random() - 0.5) * 0.9; p.x = x; p.y = y; p.z = z; p.s = 0.16 + Math.random() * 0.1; p.sp.visible = true; } };
    W.updatePuffs = (dt) => { for (const p of W.puffs) { if (p.t >= 1) continue; p.t += dt / 0.7; p.x += p.vx * dt; p.z += p.vz * dt; p.sp.position.set(p.x, p.y + p.t * 0.25, p.z); p.sp.scale.setScalar(p.s * (1 + p.t * 3)); p.sp.material.opacity = 0.7 * (1 - p.t); if (p.t >= 1) p.sp.visible = false; } };
  }

  // ---- the ball's glow and trail: the real ball is ~6 cm, so it carries a soft halo and a short fading streak to stay readable on a phone ----------
  {
    const soft = canvasTex(64, 64, (g, w, h) => { const q = g.createRadialGradient(w / 2, h / 2, 1, w / 2, h / 2, w / 2); q.addColorStop(0, 'rgba(255,248,214,1)'); q.addColorStop(0.35, 'rgba(255,232,150,0.55)'); q.addColorStop(1, 'rgba(255,220,120,0)'); g.fillStyle = q; g.fillRect(0, 0, w, h); });
    W.halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: soft, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.85 }));
    W.halo.visible = false; W.halo.scale.setScalar(0.5); root.add(W.halo);
    const N = 30;
    const pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    W.trail = new THREE.Points(geo, new THREE.PointsMaterial({ map: soft, size: 0.2, sizeAttenuation: true, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    W.trail.frustumCulled = false; W.trail.visible = false; root.add(W.trail);
    // floating motes of dust and pollen in the low sun (title and menu scenes)
    {
      const M = 90, mp = new Float32Array(M * 3), seeds = [];
      const r = lcg(77);
      for (let i = 0; i < M; i++) seeds.push([r() * 20 - 10, 0.3 + r() * 4.5, -r() * 14, r() * 6.28, 0.2 + r() * 0.5]);
      const mg = new THREE.BufferGeometry(); mg.setAttribute('position', new THREE.BufferAttribute(mp, 3));
      W.motes = new THREE.Points(mg, new THREE.PointsMaterial({ map: soft, size: 0.11, sizeAttenuation: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xfff0c0, opacity: 0.7 }));
      W.motes.frustumCulled = false; W.motes.visible = false; root.add(W.motes);
      W.updateMotes = (t) => {
        for (let i = 0; i < M; i++) { const s = seeds[i]; mp[i * 3] = s[0] + Math.sin(t * 0.21 * s[4] + s[3]) * 1.3; mp[i * 3 + 1] = s[1] + Math.sin(t * 0.33 * s[4] + s[3] * 2) * 0.5; mp[i * 3 + 2] = s[2] + Math.cos(t * 0.17 * s[4] + s[3]) * 1.1; }
        mg.attributes.position.needsUpdate = true;
      };
    }
    W.trailN = N; W.trailPts = [];
    W.pushTrail = (x, y, z) => {
      const a = W.trailPts; a.push([x, y, z]); if (a.length > N) a.shift();
      for (let i = 0; i < N; i++) {
        const p = a[Math.max(0, i - (N - a.length))] || [x, y, z], k = i / (N - 1);
        pos[i * 3] = p[0]; pos[i * 3 + 1] = p[1]; pos[i * 3 + 2] = p[2];
        const f = Math.pow(k, 2.2) * 0.8; col[i * 3] = f; col[i * 3 + 1] = f * 0.9; col[i * 3 + 2] = f * 0.55;
      }
      geo.attributes.position.needsUpdate = true; geo.attributes.color.needsUpdate = true; W.trail.visible = true;
    };
    W.clearTrail = () => { W.trailPts.length = 0; W.trail.visible = false; };
  }

  // ---- the lapta bat: a flat wooden paddle (handle 0.34 m with a leather wrap, blade 0.62 m by 0.13 m). Prop convention: +Y long axis, origin at the butt.
  W.makeBat = () => {
    const g = new THREE.Group(); g.name = 'lapta-bat';
    const wood = std({ color: 0xd2a566, roughness: 0.6 }), dark = std({ color: 0x6b4423, roughness: 0.8 });
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.021, 0.36, 12), wood); handle.position.y = 0.18;
    const wrap = new THREE.Mesh(new THREE.CylinderGeometry(0.0225, 0.0225, 0.2, 12), dark); wrap.position.y = 0.12;
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.64, 0.026), wood); blade.position.y = 0.66;
    const shoulder = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.065, 0.14, 12), wood); shoulder.position.y = 0.4;
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.02, 12), dark); cap.position.y = -0.005;
    g.add(handle, wrap, shoulder, blade, cap);
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    g.userData.sweet = 0.7;
    return g;
  };
  W.makeBall = (r) => { const m = new THREE.Mesh(W.ball.geometry, W.ball.material); m.scale.setScalar(r); m.castShadow = true; return m; };

  W.dispose = () => { root.traverse((o) => { if (o.geometry) o.geometry.dispose?.(); }); stage.scene.remove(root); };
  return W;
}

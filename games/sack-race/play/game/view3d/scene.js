// The village green in 3D: mown grass with painted lanes, start and finish lines, ruts and mud, rope and bunting, a crowd that cheers
// near the runners, houses, trees and hills. World: x along the lanes (finish at +x), y up, lane 0 is the FAR lane, the last lane is nearest
// the camera at z = 0. Everything here is display only; the presenter calls update() with the sim state.
export const LANE_W = 1.5;
export const laneZ = (lane, n) => -(n - 1 - lane) * LANE_W;

const TAU = Math.PI * 2;
const hash = (i) => { let h = Math.imul(i | 0, 2654435761) ^ 0x9e3779b9; h = Math.imul(h ^ (h >>> 15), 2246822519); h ^= h >>> 13; return (h >>> 0) / 4294967296; };

function canvasTex(THREE, w, h, draw, { repeat = null, srgb = true, aniso = 8 } = {}) {
  const c = globalThis.document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  t.anisotropy = aniso;
  return t;
}

// Merge {geo, matrix, color} items into ONE vertex-coloured geometry (one draw call for all static scenery).
function mergeColored(THREE, items) {
  let nv = 0, ni = 0;
  for (const it of items) { nv += it.geo.attributes.position.count; ni += it.geo.index ? it.geo.index.count : it.geo.attributes.position.count; }
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), col = new Float32Array(nv * 3), idx = new Uint32Array(ni);
  let vo = 0, io = 0; const v = new THREE.Vector3(), nm = new THREE.Matrix3(), c = new THREE.Color();
  for (const it of items) {
    const g = it.geo, p = g.attributes.position, n = g.attributes.normal; nm.getNormalMatrix(it.matrix); c.set(it.color);
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).applyMatrix4(it.matrix); pos.set([v.x, v.y, v.z], (vo + i) * 3);
      v.fromBufferAttribute(n, i).applyMatrix3(nm).normalize(); nor.set([v.x, v.y, v.z], (vo + i) * 3);
      const sh = it.shade ? 1 + (hash(vo + i) - 0.5) * it.shade : 1;
      col.set([c.r * sh, c.g * sh, c.b * sh], (vo + i) * 3);
    }
    if (g.index) for (let i = 0; i < g.index.count; i++) idx[io++] = g.index.array[i] + vo; else for (let i = 0; i < p.count; i++) idx[io++] = vo + i;
    vo += p.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  return out;
}

export function buildScene(stage, THREE, { quality = 'high', createCrowd3d = null } = {}) {
  const scene = stage.scene;
  const root = new THREE.Group(); scene.add(root);
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), P = new THREE.Vector3(), S = new THREE.Vector3(1, 1, 1);
  const mat = (x, y, z, sx = 1, sy = 1, sz = 1, ry = 0, rx = 0, rz = 0) => M.clone().compose(P.set(x, y, z), Q.setFromEuler(E.set(rx, ry, rz)), S.set(sx, sy, sz));
  const cyl = (rt, rb, h, n = 8) => new THREE.CylinderGeometry(rt, rb, h, n, 1);
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const sph = (r, a = 8, b = 6) => new THREE.SphereGeometry(r, a, b);

  // ---- sky, light haze -----------------------------------------------------------------------------------------------------------------
  const sky = canvasTex(THREE, 8, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#2d78d0'); gr.addColorStop(0.45, '#6fb6ee'); gr.addColorStop(0.8, '#cfe9f8'); gr.addColorStop(1, '#eef7f0');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  }, { srgb: true });
  scene.background = sky;
  scene.fog = new THREE.Fog(0xcfe5ee, 12, 70);

  // ---- ground: mown stripes every 4 m along x ------------------------------------------------------------------------------------------
  const grassTex = canvasTex(THREE, 1024, 512, (g, w, h) => {
    g.fillStyle = '#5da845'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 9000; i++) {
      const x = hash(i * 3) * w, y = hash(i * 3 + 1) * h, k = hash(i * 3 + 2);
      g.fillStyle = k < 0.4 ? 'rgba(40,110,40,0.35)' : k < 0.8 ? 'rgba(150,210,90,0.28)' : 'rgba(30,80,30,0.3)';
      g.fillRect(x, y, 1.5 + k * 2, 3 + k * 8);
    }
    g.fillStyle = 'rgba(255,255,215,0.10)'; g.fillRect(0, 0, w, h / 2);   // mown stripes run along the lanes
    g.fillStyle = 'rgba(0,40,0,0.06)'; g.fillRect(0, h / 2, w, h / 2);
  }, { repeat: [12, 41], aniso: quality === 'low' ? 2 : 8 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(192, 140), new THREE.MeshStandardMaterial({ map: grassTex, roughness: 1, metalness: 0 }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(40, 0, -40); ground.receiveShadow = true; root.add(ground);
  // stripes: the texture is 8 m wide in x (24 repeats over 192 m) and 4 m in z
  grassTex.repeat.set(12, 41);

  // ---- dynamic course: lanes, marks, features, finish (rebuilt per race) -----------------------------------------------------------------
  const course = new THREE.Group(); root.add(course);
  let courseKey = '';
  const dashTex = canvasTex(THREE, 64, 8, (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = '#fff'; g.fillRect(0, 0, w * 0.6, h); }, { srgb: true });
  dashTex.wrapS = THREE.RepeatWrapping;
  const decal = (w, d, color, opacity, y = 0.004) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    m.rotation.x = -Math.PI / 2; m.position.y = y; return m;
  };
  const textTex = (txt, w, h, fg, bg, font) => canvasTex(THREE, w, h, (g) => {
    if (bg) { g.fillStyle = bg; g.fillRect(0, 0, w, h); }
    g.fillStyle = fg; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, w / 2, h / 2 + 2);
  });
  const tapes = [];   // finish tape per lane: { intact, a, b }
  const arrowTex = canvasTex(THREE, 128, 64, (g, w, h) => {
    g.clearRect(0, 0, w, h); g.fillStyle = '#fff'; g.beginPath(); g.moveTo(8, h * 0.36); g.lineTo(w * 0.58, h * 0.36); g.lineTo(w * 0.58, h * 0.14); g.lineTo(w - 6, h / 2); g.lineTo(w * 0.58, h * 0.86); g.lineTo(w * 0.58, h * 0.64); g.lineTo(8, h * 0.64); g.closePath(); g.fill();
  });
  const mudTex = canvasTex(THREE, 128, 64, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w / 2);
    gr.addColorStop(0, 'rgba(70,46,26,0.95)'); gr.addColorStop(0.7, 'rgba(84,56,32,0.9)'); gr.addColorStop(1, 'rgba(84,56,32,0)');
    g.fillStyle = gr; g.save(); g.scale(1, h / w); g.fillRect(0, 0, w, w); g.restore();
    g.fillStyle = 'rgba(190,160,120,0.35)'; g.beginPath(); g.ellipse(w * 0.44, h * 0.42, w * 0.2, h * 0.12, 0, 0, TAU); g.fill();
  });
  const rutTex = canvasTex(THREE, 128, 64, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
    gr.addColorStop(0, 'rgba(62,38,20,0.92)'); gr.addColorStop(0.75, 'rgba(76,48,26,0.8)'); gr.addColorStop(1, 'rgba(76,48,26,0)');
    g.save(); g.scale(1, h / w); g.fillStyle = gr; g.fillRect(0, 0, w, w); g.restore();
    g.strokeStyle = 'rgba(30,16,8,0.75)'; g.lineWidth = 2;
    for (let k = -1; k <= 1; k++) { g.beginPath(); g.ellipse(w / 2, h / 2 + k * 6, w * 0.38, h * 0.12, 0, 0, TAU); g.stroke(); }
  });

  function buildCourse(race, n) {
    while (course.children.length) { const o = course.children.pop(); o.geometry?.dispose?.(); }
    tapes.length = 0;
    const len = race.len, z0 = laneZ(0, n) - LANE_W / 2, z1 = laneZ(n - 1, n) + LANE_W / 2, depth = z1 - z0, zc = (z0 + z1) / 2;
    // lane lines: solid outer, dashed inner
    for (let i = 0; i <= n; i++) {
      const z = z0 + i * LANE_W, outer = i === 0 || i === n;
      const L = len + 24, t = outer ? 0.09 : 0.07;
      let m;
      if (outer) m = decal(L, t, 0xffffff, 0.9);
      else {
        const tex = dashTex.clone(); tex.needsUpdate = true; tex.wrapS = THREE.RepeatWrapping; tex.repeat.set(L / 1.0, 1);
        m = new THREE.Mesh(new THREE.PlaneGeometry(L, t), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.8, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
        m.rotation.x = -Math.PI / 2; m.position.y = 0.004;
      }
      m.position.x = len / 2 + 2; m.position.z = z; course.add(m);
    }
    // start line, 10 m marks
    const mark = (x, w, o, label) => {
      const m = decal(w, depth, 0xffffff, o); m.position.set(x, 0.005, zc); course.add(m);
      if (label) {
        const t = textTex(label, 256, 96, 'rgba(255,255,255,0.9)', null, '800 70px system-ui, sans-serif');
        const p = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.56), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
        p.rotation.x = -Math.PI / 2; p.position.set(x + (label === 'START' ? -1.0 : 0), 0.006, z1 + 0.5); course.add(p);
      }
    };
    mark(0, 0.16, 0.95, 'START');
    for (let m = 10; m < len; m += 10) mark(m, 0.07, 0.5, `${m} m`);
    // features: the same in every lane
    for (let i = 0; i < n; i++) {
      const z = laneZ(i, n);
      for (const mu of race.course.mud) {
        const p = new THREE.Mesh(new THREE.PlaneGeometry(mu.w * 1.15, 1.05), new THREE.MeshStandardMaterial({ map: mudTex, transparent: true, depthWrite: false, roughness: 0.35, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
        p.rotation.x = -Math.PI / 2; p.position.set(mu.x + mu.w / 2, 0.006, z); course.add(p);
      }
      for (const r of race.course.ruts) {
        const p = new THREE.Mesh(new THREE.PlaneGeometry(r.w * 1.45, 0.72), new THREE.MeshBasicMaterial({ map: rutTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
        p.rotation.x = -Math.PI / 2; p.position.set(r.x + r.w / 2, 0.007, z); course.add(p);
        const a = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.3), new THREE.MeshBasicMaterial({ map: arrowTex, color: r.dir > 0 ? 0xffd35a : 0x9fe0ff, transparent: true, opacity: 0.95, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
        a.rotation.x = -Math.PI / 2; a.position.set(r.x + r.w / 2, 0.009, z + 0.36); if (r.dir < 0) a.rotation.z = Math.PI; course.add(a);
      }
    }
    // finish: chequered strip, two poles, banner, tape per lane
    const fx = len, cw = 0.5, cells = Math.round(depth / 0.25);
    const chk = canvasTex(THREE, 64, 64 * cells / 2 > 1024 ? 1024 : 64 * cells / 2, (g, w, h) => {
      const rows = cells; for (let r = 0; r < rows; r++) for (let c = 0; c < 2; c++) { g.fillStyle = (r + c) & 1 ? '#17171d' : '#fbfbfb'; g.fillRect((c * w) / 2, (r * h) / rows, w / 2 + 1, h / rows + 1); }
    });
    const cm = new THREE.Mesh(new THREE.PlaneGeometry(cw, depth), new THREE.MeshBasicMaterial({ map: chk, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
    cm.rotation.x = -Math.PI / 2; cm.position.set(fx, 0.006, zc); course.add(cm);
    const poleMat = new THREE.MeshStandardMaterial({ color: 0xe9e2cf, roughness: 0.6 });
    for (const z of [z0 - 0.15, z1 + 0.15]) {
      const p = new THREE.Mesh(cyl(0.045, 0.05, 2.9, 10), poleMat); p.position.set(fx, 1.45, z); p.castShadow = true; course.add(p);
      const ball = new THREE.Mesh(sph(0.075, 10, 8), new THREE.MeshStandardMaterial({ color: 0xe23a62, roughness: 0.4 })); ball.position.set(fx, 2.95, z); course.add(ball);
    }
    const bw = depth + 0.3, bnr = textTex('FINISH', 512, 96, '#c4234a', '#fff6df', '800 64px system-ui, sans-serif');
    const ban = new THREE.Mesh(new THREE.PlaneGeometry(bw, 0.62), new THREE.MeshStandardMaterial({ map: bnr, roughness: 0.8, side: THREE.DoubleSide }));
    ban.rotation.y = Math.PI / 2; ban.position.set(fx, 2.55, zc); ban.castShadow = true; course.add(ban);
    // the banner is read from the side: a second panel faces the camera (rotate to face +z)
    const ban2 = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.62), new THREE.MeshStandardMaterial({ map: bnr, roughness: 0.8, side: THREE.DoubleSide }));
    ban2.position.set(fx - 0.01, 3.2, z0 - 0.15); ban2.castShadow = false; course.add(ban2);
    const hf = new THREE.Mesh(cyl(0.025, 0.025, depth + 0.3, 6), poleMat); hf.rotation.x = Math.PI / 2; hf.position.set(fx, 2.82, zc); course.add(hf);
    for (let i = 0; i < n; i++) {
      const z = laneZ(i, n), geo = new THREE.PlaneGeometry(0.02, 1);
      void geo;
      const tape = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.06, LANE_W * 0.94), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6, emissive: 0x333333 }));
      tape.position.set(fx, 1.15, z); course.add(tape);
      const a = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.06, LANE_W * 0.45), tape.material); const b = a.clone();
      a.visible = b.visible = false; course.add(a, b);
      tapes.push({ tape, a, b, z, k: 0 });
    }
  }

  // ---- static scenery (single merged mesh): rope, posts, bunting, houses, trees, palms, hills --------------------------------------------------
  const items = [];
  const R0 = laneZ(0, 4) - LANE_W / 2 - 1.1;   // rope z (the field is built for the maximum four lanes; the clock run uses fewer)
  function addStatic(len) {
    const X0 = -16, X1 = len + 30;
    // rope + posts
    for (let x = X0; x <= X1; x += 3) {
      items.push({ geo: cyl(0.035, 0.04, 1.0, 6), matrix: mat(x, 0.5, R0), color: '#8a6338' });
      items.push({ geo: sph(0.06, 6, 5), matrix: mat(x, 1.03, R0), color: '#f3d9a4' });
      items.push({ geo: box(3.0, 0.03, 0.03), matrix: mat(x + 1.5, 0.82, R0), color: '#f4efe2' });
      items.push({ geo: box(3.0, 0.03, 0.03), matrix: mat(x + 1.5, 0.52, R0), color: '#f4efe2' });
    }
    // bunting poles every 7 m and flags
    const BC = ['#e23a62', '#ffc83d', '#2f8fd6', '#14a897', '#ff7a2f', '#fff2e0'];
    const sp = 7;
    for (let x = X0; x < X1; x += sp) {
      items.push({ geo: cyl(0.045, 0.06, 4.6, 6), matrix: mat(x, 2.3, R0 - 0.35), color: '#6b4a30' });
      for (let k = 0; k < 9; k++) {
        const u = (k + 0.5) / 9, xx = x + sp * u, yy = 4.45 - 0.55 * 4 * u * (1 - u);
        items.push({ geo: new THREE.CylinderGeometry(0, 0.16, 0.34, 3), matrix: mat(xx, yy - 0.12, R0 - 0.35, 1, 1, 0.3, 0, 0, Math.PI), color: BC[(k + Math.floor(x / sp)) % BC.length] });
      }
    }
    // grass terrace for the spectators, hay bales along the rope, striped fair stalls behind
    for (let r = 0; r < 3; r++) items.push({ geo: box(X1 - X0 + 6, 0.16 * (r + 1), 0.78), matrix: mat((X0 + X1) / 2, 0.08 * (r + 1), R0 - 0.75 - r * 0.78 - 0.1), color: r % 2 ? '#5aa347' : '#63ad4c', shade: 0.05 });
    for (let x = X0 + 2, i = 0; x < X1; x += 9 + hash(i * 3) * 5, i++) {
      for (let k = 0; k < 2; k++) {
        items.push({ geo: cyl(0.34, 0.34, 0.9, 12), matrix: mat(x + k * 0.8, 0.34, R0 + 0.05 + hash(i + k) * 0.1, 1, 1, 1, 0, 0, Math.PI / 2), color: '#d9b45a', shade: 0.16 });
        items.push({ geo: cyl(0.345, 0.345, 0.06, 12), matrix: mat(x + k * 0.8, 0.34, R0 + 0.05, 1, 1, 1, 0, 0, Math.PI / 2), color: '#a07c36' });
      }
    }
    const SC = ['#e23a62', '#2f8fd6', '#ffc83d', '#14a897'];
    for (let x = X0 + 6, i = 0; x < X1; x += 21 + hash(i * 9) * 10, i++) {
      const zz = R0 - 5.2, w = 3.4, c = SC[i % 4];
      for (const dx of [-w / 2, w / 2]) items.push({ geo: cyl(0.05, 0.05, 2.4, 6), matrix: mat(x + dx, 1.2, zz + 1), color: '#6b4a30' });
      for (let s2 = 0; s2 < 8; s2++) items.push({ geo: box(w / 8, 0.05, 1.5), matrix: mat(x - w / 2 + (s2 + 0.5) * w / 8, 2.45 - 0.0, zz + 0.4, 1, 1, 1, 0, -0.28), color: s2 & 1 ? '#fff6e6' : c });
      items.push({ geo: box(w, 0.9, 0.9), matrix: mat(x, 0.45, zz - 0.25), color: '#8a6338' });
      items.push({ geo: box(w - 0.3, 0.05, 0.9), matrix: mat(x, 0.92, zz - 0.25), color: '#f1e3c2' });
      for (let k = 0; k < 4; k++) items.push({ geo: sph(0.17, 8, 6), matrix: mat(x - 1.1 + k * 0.72, 1.12, zz - 0.25), color: ['#d93a2b', '#f3a712', '#7bb733', '#d93a2b'][k], shade: 0.15 });
    }
    // far scenery
    const house = (x, z, q) => {
      const w = 3.2 + 2.2 * q, d = 2.8 + 1.5 * hash(Math.floor(q * 977)), h = 2.1 + 1.0 * hash(Math.floor(q * 331));
      const walls = ['#f4e3c4', '#f2c9a0', '#e6efe0', '#f7d9d0', '#efe2b8'], roofs = ['#c8503a', '#a8412f', '#7b5a46', '#b86a3a'], k = Math.floor(q * 1000);
      items.push({ geo: box(w, h, d), matrix: mat(x, h / 2, z), color: walls[k % 5], shade: 0.06 });
      const roof = new THREE.CylinderGeometry(0, Math.max(w, d) * 0.78, 1.5, 4);
      items.push({ geo: roof, matrix: mat(x, h + 0.75, z, 1, 1, d / w, Math.PI / 4), color: roofs[(k >> 2) % 4] });
      items.push({ geo: box(0.7, 0.8, 0.05), matrix: mat(x - w * 0.22, h * 0.6, z + d / 2 + 0.03), color: '#6b8fb0' });
      items.push({ geo: box(0.7, 0.8, 0.05), matrix: mat(x + w * 0.22, h * 0.6, z + d / 2 + 0.03), color: '#6b8fb0' });
      items.push({ geo: box(0.6, 1.2, 0.05), matrix: mat(x, 0.6, z + d / 2 + 0.03), color: '#7a5236' });
    };
    const tree = (x, z, q) => {
      const s = 0.8 + q * 0.9;
      items.push({ geo: cyl(0.12 * s, 0.17 * s, 2.2 * s, 6), matrix: mat(x, 1.1 * s, z), color: '#6b4a30' });
      const g = ['#3f9a52', '#2f8745', '#58ad54', '#4a9d3f'], c = g[Math.floor(q * 40) % 4];
      items.push({ geo: sph(1.35 * s, 8, 6), matrix: mat(x, 3.0 * s, z, 1, 0.9, 1), color: c, shade: 0.12 });
      items.push({ geo: sph(0.95 * s, 8, 6), matrix: mat(x - 0.9 * s, 2.5 * s, z + 0.2), color: c, shade: 0.12 });
      items.push({ geo: sph(0.95 * s, 8, 6), matrix: mat(x + 0.9 * s, 2.55 * s, z - 0.2), color: c, shade: 0.12 });
    };
    const palm = (x, z, q) => {
      const s = 1.0 + q * 0.5;
      items.push({ geo: cyl(0.1 * s, 0.17 * s, 5.6 * s, 6), matrix: mat(x, 2.8 * s, z, 1, 1, 1, 0, 0, 0.07 * (q - 0.5) * 4), color: '#8a6a44' });
      for (let k = 0; k < 7; k++) {
        const a = (k / 7) * TAU;
        items.push({ geo: new THREE.CylinderGeometry(0, 0.22 * s, 2.3 * s, 4), matrix: mat(x + Math.cos(a) * 0.95 * s, 5.6 * s - 0.35 * s, z + Math.sin(a) * 0.95 * s, 1, 1, 1, -a, 0, -1.25), color: '#2f9a4a', shade: 0.1 });
      }
    };
    for (let x = X0 - 6, i = 0; x < X1 + 10; x += 6.5 + hash(i * 7) * 3, i++) {
      const q = hash(i * 13 + 5), z = R0 - 9 - hash(i * 3) * 7, kind = Math.floor(q * 10);
      if (kind < 4) house(x, z, q); else if (kind < 7) tree(x, z + 1.5, q); else palm(x, z + 1, q);
    }
    // second row of trees behind and a few near the rope
    for (let x = X0, i = 100; x < X1 + 10; x += 9 + hash(i * 5) * 5, i++) tree(x, R0 - 24 - hash(i) * 8, hash(i * 3));
    for (let x = X0 + 4, i = 200; x < X1; x += 22 + hash(i) * 12, i++) tree(x, R0 - 8, 0.5 + hash(i) * 0.4);
    // hills
    for (let i = 0; i < 9; i++) {
      const x = X0 + i * ((X1 - X0) / 8), z = R0 - 52 - hash(i * 3 + 1) * 10;
      items.push({ geo: sph(1, 18, 8), matrix: mat(x, -2.5, z, 38 + hash(i) * 14, 11 + hash(i + 40) * 6, 20), color: i % 2 ? '#86bb94' : '#74ad86' });
    }
  }
  let staticMesh = null, staticLen = -1;
  function ensureStatic(len) {
    if (staticMesh && staticLen >= len) return;
    if (staticMesh) { root.remove(staticMesh); staticMesh.geometry.dispose(); }
    items.length = 0; addStatic(Math.max(len, 60)); staticLen = Math.max(len, 60);
    staticMesh = new THREE.Mesh(mergeColored(THREE, items), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0, flatShading: false }));
    staticMesh.castShadow = false; staticMesh.receiveShadow = true; root.add(staticMesh);
  }

  // ---- crowd: real 3D spectators (shared crowd3d: varied faces, hair, clothes, ages; idle clapping and waving, reactions) -----------------------
  let crowd = null, crowdLen = -1, crowdT = null;
  function buildCrowd(len) {
    if (!createCrowd3d || crowdLen >= len) return;
    if (crowd) { crowd.dispose(); crowd = null; }
    crowdLen = Math.max(len, 60);
    const x0 = -14, x1 = crowdLen + 26, span = x1 - x0;
    const rows = [0, 1, 2].map((r) => ({ from: [x0, 0.16 * (r + 1), R0 - 0.75 - r * 0.78], to: [x1, 0.16 * (r + 1), R0 - 0.75 - r * 0.78], count: Math.round(span / (0.72 + r * 0.04)), face: 0 }));
    crowd = createCrowd3d(stage, { rows, seed: 11, culture: ['european_village', 'central_asian'], quality, kids: 0.16, props: { flag: 0.06, phone: 0.05, child: 0.05 }, flagColors: ['#e23a62', '#ffc83d', '#2f8fd6'], excitement: 0.35 });
  }
  function updateCrowd(t, xs, camX) {
    if (!crowd) return;
    const dt = crowdT === null ? 0 : Math.min(0.1, Math.max(0, t - crowdT)); crowdT = t;
    let near = 0; for (const x of xs) near = Math.max(near, 1 - Math.min(1, Math.abs(x - camX) / 9));
    crowd.setExcitement(0.3 + 0.5 * near);
    crowd.update(dt);
  }
  const react = (kind, x, radius = 7) => { if (crowd) crowd.react(kind, { origin: [x, 0, R0], radius }); };

  // ---- clouds ------------------------------------------------------------------------------------------------------------------------------
  const cloudTex = canvasTex(THREE, 256, 96, (g, w, h) => {
    g.fillStyle = 'rgba(255,255,255,0.92)';
    for (let k = 0; k < 6; k++) { g.beginPath(); g.ellipse(w * (0.2 + 0.12 * k), h * (0.55 - 0.1 * Math.sin(k * 1.7)), w * 0.14, h * 0.26, 0, 0, TAU); g.fill(); }
  });
  const clouds = [];
  for (let i = 0; i < 7; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, transparent: true, depthWrite: false, fog: false, opacity: 0.9 }));
    sp.scale.set(20 + hash(i) * 12, 7 + hash(i + 3) * 3, 1); sp.position.set(-10 + i * 24, 30 + hash(i * 3) * 10, R0 - 90); clouds.push(sp); root.add(sp);
  }

  function setRace(race, n) {
    const key = `${race.seed}|${race.len}|${n}|${race.mode}`;
    ensureStatic(race.len); buildCrowd(race.len);
    if (key !== courseKey) { courseKey = key; buildCourse(race, n); }
  }
  // broke[lane]: 0 intact, else 0..1 flutter time; positions of the torn tape halves
  function updateTapes(broke, offset, n, t) {
    tapes.forEach((tp, i) => {
      const lane = i; const b = broke[lane + offset];
      if (!b) { tp.tape.visible = true; tp.a.visible = tp.b.visible = false; tp.tape.position.y = 1.15 + Math.sin(t * 5 + i) * 0.01; return; }
      tp.tape.visible = false; tp.a.visible = tp.b.visible = true;
      const k = typeof b === 'number' ? b : 1;
      tp.a.position.set(tp.tape.position.x + 0.1 * k, 1.15 - 0.4 * k, tp.z + LANE_W * 0.26); tp.a.rotation.set(0.5 * k, 0, 0.9 * k);
      tp.b.position.set(tp.tape.position.x + 0.14 * k, 1.15 - 0.55 * k, tp.z - LANE_W * 0.26); tp.b.rotation.set(-0.5 * k, 0, 0.8 * k);
    });
  }
  function updateClouds(t) { clouds.forEach((c, i) => { c.position.x = ((c.position.x + 0.004 * (1 + i * 0.1)) + 40) % 190 - 40; void t; }); }

  return { root, prepare() { ensureStatic(60); buildCrowd(60); }, setRace, updateCrowd, updateTapes, updateClouds, react, R0, dispose() { root.removeFromParent(); } };
}

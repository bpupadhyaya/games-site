// Kolf world builders: everything static in the 3D court scene (ice, boards, banks, Dutch canal houses, mills, ships, trees, post).
// Presentation only. Coordinates: court x across, y along (0..L), z up; three.js space is (x, z, -y).
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export function lcg(seed) { let s = (seed >>> 0) || 1; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }
export const hashStr = (str) => { let h = 2166136261 >>> 0; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h; };

export const STYLE3 = {
  canal: { sky: ['#4c86c8', '#a8c6dc', '#fbd7a0'], fog: '#efd8ae', sun: 0xffe2a8 },
  mill: { sky: ['#5a8fcc', '#b4cade', '#f9dba6'], fog: '#eed8ae', sun: 0xffdca0 },
  harbour: { sky: ['#5683b4', '#aec4d4', '#f5d8a8'], fog: '#ead6b0', sun: 0xffd9a0 },
};

export function makeKit(V3) {
  const THREE = V3.THREE;
  const doc = globalThis.document;
  const cv = (w, h) => { const c = doc.createElement('canvas'); c.width = w; c.height = h; return c; };
  const tex = (c, { repeat = null, srgb = true, aniso = 4 } = {}) => {
    const t = new THREE.CanvasTexture(c);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
    t.anisotropy = aniso;
    return t;
  };
  const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0, ...o });

  // ---- merged coloured geometry helper: [{ geo, color:'#rrggbb', at:[x,y,z], rot:[x,y,z] }] -> BufferGeometry with vertex colours
  function mergeColored(list) {
    const pos = [], nor = [], uv = [], col = [];
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s = new THREE.Vector3(1, 1, 1);
    const nm = new THREE.Matrix3();
    for (const it of list) {
      const g = it.geo.index ? it.geo.toNonIndexed() : it.geo;
      e.set(...(it.rot || [0, 0, 0])); q.setFromEuler(e); v.set(...(it.at || [0, 0, 0]));
      m.compose(v, q, s); nm.getNormalMatrix(m);
      const c = new THREE.Color(it.color || '#ffffff');
      const p = g.attributes.position, n = g.attributes.normal, u = g.attributes.uv;
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i).applyMatrix4(m); pos.push(v.x, v.y, v.z);
        if (n) { v.fromBufferAttribute(n, i).applyMatrix3(nm).normalize(); nor.push(v.x, v.y, v.z); } else nor.push(0, 1, 0);
        uv.push(u ? u.getX(i) : 0, u ? u.getY(i) : 0);
        col.push(c.r, c.g, c.b);
      }
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    out.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    return out;
  }
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);

  // ---- textures ------------------------------------------------------------------------------------------------------------
  function noiseCanvas(size, base, amp, seed = 1, speck = 0.0) {
    const c = cv(size, size), g = c.getContext('2d'), rnd = lcg(seed);
    g.fillStyle = base; g.fillRect(0, 0, size, size);
    const img = g.getImageData(0, 0, size, size), d = img.data;
    for (let i = 0; i < d.length; i += 4) { const n = (rnd() - 0.5) * amp; d[i] += n; d[i + 1] += n; d[i + 2] += n * 1.05; if (speck && rnd() < speck) { d[i] = d[i + 1] = d[i + 2] = 255; } }
    g.putImageData(img, 0, 0);
    return c;
  }
  const snowTex = () => {
    const c = noiseCanvas(256, '#f1f1ea', 14, 5, 0.004), g = c.getContext('2d'), r = lcg(77);
    for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(150,170,195,${0.05 + r() * 0.07})`; g.beginPath(); g.ellipse(r() * 256, r() * 256, 10 + r() * 30, 4 + r() * 10, r() * 3, 0, TAU); g.fill(); }
    return tex(c, { repeat: [60, 60] });
  };
  const brickTex = () => {
    const c = cv(256, 256), g = c.getContext('2d'), r = lcg(9);
    g.fillStyle = '#d7cdbd'; g.fillRect(0, 0, 256, 256);   // mortar
    const bw = 32, bh = 13;
    for (let row = 0; row < 256 / bh; row++) for (let k = -1; k < 256 / bw + 1; k++) {
      const x = k * bw + (row % 2 ? bw / 2 : 0), y = row * bh, t = 0.82 + r() * 0.3;
      g.fillStyle = `rgb(${Math.round(232 * t)},${Math.round(224 * t)},${Math.round(214 * t)})`;
      g.fillRect(x + 1, y + 1, bw - 2, bh - 2);
    }
    return tex(c, { repeat: [1 / 2.0, 1 / 1.6] });
  };
  const plankTex = (base = '#8a6535', dark = '#4a3418') => {
    const c = cv(256, 128), g = c.getContext('2d'), r = lcg(21);
    g.fillStyle = base; g.fillRect(0, 0, 256, 128);
    for (let i = 0; i < 150; i++) { g.strokeStyle = `rgba(${r() < 0.5 ? '40,25,8' : '200,160,100'},${0.05 + r() * 0.1})`; g.lineWidth = 1 + r() * 2; const y = r() * 128; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(80, y + (r() - 0.5) * 6, 170, y + (r() - 0.5) * 6, 256, y + (r() - 0.5) * 4); g.stroke(); }
    g.fillStyle = dark; g.fillRect(0, 60, 256, 4); g.fillRect(0, 0, 256, 2); g.fillRect(0, 126, 256, 2);
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, 0, 3, 128);
    return tex(c);
  };
  const barkTex = () => tex(noiseCanvas(64, '#5b4a3a', 36, 3));

  // Delft-blue tile band (post plinth, signs)
  const tileTex = () => {
    const c = cv(256, 64), g = c.getContext('2d');
    for (let i = 0; i < 4; i++) {
      const x = i * 64; g.fillStyle = '#f4f2ea'; g.fillRect(x, 0, 64, 64);
      g.strokeStyle = '#2b5aa0'; g.lineWidth = 2.5; g.strokeRect(x + 3, 3, 58, 58);
      g.beginPath(); g.arc(x + 32, 32, 14, 0, TAU); g.stroke();
      for (let k = 0; k < 4; k++) { const a = k * TAU / 4 + 0.4; g.beginPath(); g.moveTo(x + 32 + Math.cos(a) * 14, 32 + Math.sin(a) * 14); g.quadraticCurveTo(x + 32 + Math.cos(a + 0.5) * 26, 32 + Math.sin(a + 0.5) * 26, x + 32 + Math.cos(a) * 28, 32 + Math.sin(a) * 28); g.stroke(); }
      g.fillStyle = '#2b5aa0'; for (const [dx, dy] of [[8, 8], [56, 8], [8, 56], [56, 56]]) { g.beginPath(); g.arc(x + dx, dy, 2.6, 0, TAU); g.fill(); }
    }
    return tex(c, { repeat: [2, 1] });
  };

  // ---- the ice for one court (a texture the size of the court) ---------------------------------------------------------------
  function iceCanvas(court) {
    const W = court.W, L = court.L;
    const ppm = Math.min(14, 2048 / L, 1024 / W);
    const w = Math.max(64, Math.round(W * ppm)), h = Math.max(64, Math.round(L * ppm));
    const c = cv(w, h), g = c.getContext('2d'), r = lcg(hashStr(`ice3-${court.id}`));
    const X = (x) => x * ppm, Y = (y) => (L - y) * ppm;
    const grd = g.createLinearGradient(0, 0, 0, h);   // top = far end (warmer), bottom = near end (cooler, deeper)
    grd.addColorStop(0, '#c4e6ea'); grd.addColorStop(0.5, '#94cddb'); grd.addColorStop(1, '#6db3cc');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    // deep green-blue clouds in the ice
    for (let i = 0; i < 70; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '70,120,140' : '200,225,225'},${0.04 + r() * 0.07})`; g.beginPath(); g.ellipse(r() * w, r() * h, (6 + r() * 30) * ppm / 8, (10 + r() * 60) * ppm / 8, r() * 0.6 - 0.3, 0, TAU); g.fill(); }
    // skate scratches: long pale arcs
    g.lineCap = 'round';
    for (let i = 0; i < 90; i++) {
      const x0 = r() * w, y0 = r() * h, len = (6 + r() * 30) * ppm, a = (r() - 0.5) * 1.1 + Math.PI / 2 * (r() < 0.5 ? 0 : 1);
      g.strokeStyle = `rgba(255,255,255,${0.06 + r() * 0.12})`; g.lineWidth = 0.6 + r() * 1.4;
      g.beginPath(); g.moveTo(x0, y0); g.quadraticCurveTo(x0 + Math.cos(a) * len * 0.5 + (r() - 0.5) * 20, y0 + Math.sin(a) * len * 0.5, x0 + Math.cos(a) * len, y0 + Math.sin(a) * len); g.stroke();
    }
    // cracks
    g.strokeStyle = 'rgba(40,80,100,0.35)'; g.lineWidth = 1;
    for (let i = 0; i < 50; i++) {
      let x = r() * W, y = r() * L, a = r() * TAU; g.beginPath(); g.moveTo(X(x), Y(y));
      const n = 3 + Math.floor(r() * 4);
      for (let k = 0; k < n; k++) { a += (r() - 0.5) * 1.3; const l = 1 + r() * 4; x = clamp(x + Math.cos(a) * l, 0.1, W - 0.1); y = clamp(y + Math.sin(a) * l, 0.1, L - 0.1); g.lineTo(X(x), Y(y)); }
      g.stroke();
    }
    // thin ice: dark glassy water-ice with white fracture lines
    for (const t of court.thin) {
      const x0 = X(t.x0), y0 = Y(t.y1), ww = X(t.x1) - x0, hh = Y(t.y0) - y0;
      const tg = g.createLinearGradient(x0, y0, x0 + ww, y0 + hh);
      tg.addColorStop(0, 'rgba(24,62,86,0.92)'); tg.addColorStop(0.5, 'rgba(36,86,108,0.88)'); tg.addColorStop(1, 'rgba(20,52,74,0.93)');
      g.fillStyle = tg; g.fillRect(x0, y0, ww, hh);
      g.strokeStyle = 'rgba(225,244,252,0.6)'; g.lineWidth = 1;
      for (let i = 0; i < 26; i++) { let x = t.x0 + r() * (t.x1 - t.x0), y = t.y0 + r() * (t.y1 - t.y0); g.beginPath(); g.moveTo(X(x), Y(y)); for (let k = 0; k < 3; k++) { x += (r() - 0.5) * 2.4; y += (r() - 0.5) * 2.8; g.lineTo(X(x), Y(y)); } g.stroke(); }
      g.strokeStyle = 'rgba(230,246,252,0.8)'; g.lineWidth = 2; g.strokeRect(x0, y0, ww, hh);
    }
    // snow patches: soft, uneven edges
    for (const s of court.snow) {
      const cx = (s.x0 + s.x1) / 2, cy = (s.y0 + s.y1) / 2;
      const pts = [];
      const n = 28;
      for (let i = 0; i < n; i++) {
        const t = i / n * TAU, rx = (s.x1 - s.x0) / 2 + 0.6, ry = (s.y1 - s.y0) / 2 + 0.6;
        const k = 1 / Math.max(Math.abs(Math.cos(t)) / rx, Math.abs(Math.sin(t)) / ry);   // rectangle-ish
        const rr = k * (0.94 + r() * 0.1);
        pts.push([cx + Math.cos(t) * rr, cy + Math.sin(t) * rr]);
      }
      g.fillStyle = 'rgba(210,225,232,0.55)'; g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(X(p[0]), Y(p[1])) : g.moveTo(X(p[0]), Y(p[1])))); g.closePath(); g.fill();
      g.fillStyle = '#f8f6ee'; g.beginPath(); pts.forEach((p, i) => { const x = cx + (p[0] - cx) * 0.92, y = cy + (p[1] - cy) * 0.92; i ? g.lineTo(X(x), Y(y)) : g.moveTo(X(x), Y(y)); }); g.closePath(); g.fill();
      for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(170,190,205,${0.2 + r() * 0.3})`; g.fillRect(X(s.x0 + r() * (s.x1 - s.x0)), Y(s.y0 + r() * (s.y1 - s.y0)), 2 + r() * 4, 1 + r() * 1.5); }
    }
    return c;
  }

  // ---- Dutch canal houses ---------------------------------------------------------------------------------------------------
  const VARIANTS = ['stepped', 'bell', 'neck', 'spout', 'plain', 'warehouse'];
  function outline(kind, w, H) {
    const hw = w / 2, p = [[-hw, 0], [hw, 0]];
    if (kind === 'stepped') {
      const base = H - 1.9, right = [[hw, base]];
      let x = hw, y = base;
      for (let i = 0; i < 3; i++) { x -= 0.42; right.push([x, y]); y += 0.62; right.push([x, y]); }
      return [[-hw, 0], [hw, 0], ...right, ...right.slice().reverse().map((q) => [-q[0], q[1]])];
    }
    if (kind === 'bell') {
      const base = H - 2.2; p.push([hw, base]);
      for (let i = 1; i <= 10; i++) { const u = i / 10; p.push([hw * (1 - u * 0.78) - (u > 0.5 ? 0 : 0.12 * Math.sin(u * Math.PI)), base + 2.4 * Math.sin(u * Math.PI / 2) ** 1.4]); }
      for (let i = 10; i >= 1; i--) { const u = i / 10; p.push([-hw * (1 - u * 0.78) + (u > 0.5 ? 0 : 0.12 * Math.sin(u * Math.PI)), base + 2.4 * Math.sin(u * Math.PI / 2) ** 1.4]); }
      p.push([-hw, base]);
      return p;
    }
    if (kind === 'neck') { const b = H - 1.6, nw = hw * 0.55; p.push([hw, b], [nw + 0.25, b], [nw + 0.25, b + 0.3], [nw, b + 0.3], [nw, b + 1.5], [-nw, b + 1.5], [-nw, b + 0.3], [-nw - 0.25, b + 0.3], [-nw - 0.25, b], [-hw, b]); return p; }
    if (kind === 'spout') { const b = H - 2.2; p.push([hw, b], [hw * 0.45, b + 1.5], [hw * 0.45, b + 2.3], [-hw * 0.45, b + 2.3], [-hw * 0.45, b + 1.5], [-hw, b]); return p; }
    if (kind === 'warehouse') { const b = H - 1.0; p.push([hw, b], [hw * 0.3, b], [hw * 0.3, b + 1.4], [-hw * 0.3, b + 1.4], [-hw * 0.3, b], [-hw, b]); return p; }
    const b = H - 2.0; p.push([hw, b], [0, b + 2.0], [-hw, b]); return p;   // plain pitched
  }
  const HOUSE = {
    stepped: { w: 4.2, H: 8.4, floors: 3 }, bell: { w: 4.4, H: 8.8, floors: 3 }, neck: { w: 4.0, H: 8.0, floors: 3 },
    spout: { w: 3.8, H: 8.2, floors: 3 }, plain: { w: 4.6, H: 7.0, floors: 2 }, warehouse: { w: 6.6, H: 7.4, floors: 3 },
  };
  function houseGeos(kind, depth = 8) {
    const { w, H, floors } = HOUSE[kind];
    const pts = outline(kind, w, H);
    const shape = new THREE.Shape(pts.map((q) => new THREE.Vector2(q[0], q[1])));
    const body = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
    body.translate(0, 0, -depth / 2);
    // details: windows, doors, cornices, snow caps, gable beam; front face at z = +depth/2
    const z = depth / 2, list = [];
    const r = lcg(hashStr(kind));
    const cols = kind === 'warehouse' ? 3 : 2, usable = (H - (kind === 'plain' ? 2.0 : 2.3));
    const fh = Math.max(2.0, (usable - 0.4) / floors);
    for (let f = 0; f < floors; f++) {
      const y = 0.9 + f * fh + (f === 0 ? 0.55 : 0);
      for (let k = 0; k < cols; k++) {
        const x = cols === 2 ? (k ? 1 : -1) * w * 0.24 : (k - 1) * w * 0.3;
        if (f === 0 && kind !== 'warehouse' && k === 0) continue;   // door goes here
        const sh = f === 0 ? 1.3 : 1.55;
        list.push({ geo: box(1.0, sh + 0.2, 0.1), color: '#f1ece0', at: [x, y + sh / 2, z + 0.03] });
        const lit = r() < 0.38;
        list.push({ geo: box(0.74, sh - 0.1, 0.12), color: lit ? '#ffc766' : '#27323f', at: [x, y + sh / 2 + 0.02, z + 0.06] });
        list.push({ geo: box(0.05, sh - 0.1, 0.14), color: '#f1ece0', at: [x, y + sh / 2 + 0.02, z + 0.08] });
        list.push({ geo: box(0.74, 0.05, 0.14), color: '#f1ece0', at: [x, y + sh * 0.62, z + 0.08] });
        if (f > 0) list.push({ geo: box(1.2, 0.1, 0.22), color: '#c9c0ae', at: [x, y - 0.04, z + 0.1] });
      }
      if (f < floors - 1) list.push({ geo: box(w + 0.1, 0.12, 0.14), color: '#e3dccb', at: [0, 0.9 + (f + 1) * fh - 0.45 + (f === 0 ? 0.55 : 0), z + 0.05] });
    }
    if (kind !== 'warehouse') {   // door + step
      const dx = cols === 2 ? -w * 0.24 : 0;
      list.push({ geo: box(1.15, 2.3, 0.12), color: '#f1ece0', at: [dx, 1.15 + 0.15, z + 0.04] });
      list.push({ geo: box(0.9, 2.1, 0.14), color: '#2e5a8a', at: [dx, 1.05 + 0.15, z + 0.07] });
      list.push({ geo: box(1.5, 0.3, 0.6), color: '#b8b0a0', at: [dx, 0.15, z + 0.25] });
    } else {   // hoist beam and door
      list.push({ geo: box(0.14, 0.14, 1.6), color: '#4a3418', at: [0, H - 0.4, z + 0.8] });
      list.push({ geo: box(1.8, 2.4, 0.14), color: '#5a3d22', at: [0, 1.2, z + 0.05] });
    }
    // snow caps along the roofline (thin white strips on each horizontal edge of the outline)
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      if (b[1] < 1 && a[1] < 1) continue;
      const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy);
      if (len < 0.2 || Math.abs(dx) < Math.abs(dy) * 0.6 && Math.abs(dy) > 0.3) continue;
      if (dy < 0 && Math.abs(dx) < 0.01) continue;
      const ang = Math.atan2(dy, dx);
      list.push({ geo: box(len + 0.1, 0.16, depth + 0.3), color: '#f7f7f2', at: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + 0.08, 0], rot: [0, 0, ang] });
    }
    return { body, det: mergeColored(list), w, H };
  }

  // ---- trees ------------------------------------------------------------------------------------------------------------------
  function treeGeos() {
    const trunk = new THREE.CylinderGeometry(0.10, 0.2, 3.2, 6); trunk.translate(0, 1.6, 0);
    const crown = mergeColored([
      { geo: new THREE.CylinderGeometry(0.0, 1.05, 6.8, 7, 1), color: '#4d4a3a', at: [0, 6.2, 0] },
      { geo: new THREE.CylinderGeometry(0.0, 0.8, 4.6, 7, 1), color: '#5a5640', at: [0.15, 8.6, 0.05] },
      { geo: new THREE.CylinderGeometry(0.0, 0.65, 3.6, 6, 1), color: '#434034', at: [-0.2, 4.2, 0.1] },
    ]);
    return { trunk, crown };
  }

  // ---- windmill -----------------------------------------------------------------------------------------------------------
  function buildMill() {
    const g = new THREE.Group();
    const stone = std({ color: '#cbbfa6', roughness: 0.95 }), dark = std({ color: '#3b3128' }), cloth = std({ color: '#e9dfc4', side: THREE.DoubleSide }), wood = std({ color: '#5a4026' });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 3.4, 11, 8), stone); body.position.y = 5.5; body.castShadow = true; g.add(body);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(2.05, 2.1, 0.5, 8), dark); band.position.y = 11.0; g.add(band);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.0, 2.5, 3.0, 8), dark); cap.position.y = 12.7; cap.castShadow = true; g.add(cap);
    const snow = new THREE.Mesh(new THREE.CylinderGeometry(0.0, 2.3, 1.2, 8), std({ color: '#f4f4ee' })); snow.position.y = 13.25; g.add(snow);
    const door = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.2, 0.3), wood); door.position.set(0, 1.1, 3.3); g.add(door);
    const gal = new THREE.Mesh(new THREE.CylinderGeometry(3.0, 3.0, 0.2, 14), wood); gal.position.y = 3.4; g.add(gal);
    const hub = new THREE.Group(); hub.position.set(0, 11.2, 2.3); g.add(hub);
    for (let i = 0; i < 4; i++) {
      const arm = new THREE.Group(); arm.rotation.z = i * Math.PI / 2;
      const spar = new THREE.Mesh(new THREE.BoxGeometry(0.28, 15, 0.22), wood); spar.position.y = 0; arm.add(spar);
      for (let k = 0; k < 2; k++) {
        const sail = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 5.6, 1, 1), cloth); sail.position.set(0.95, 2.5 + k * 0 + 2.8 * (k ? 1 : 0.4) - 0.2 + (k ? 0 : 0.0), 0.06);
        sail.position.y = 3.2 + 0 + (k ? 0 : 0); arm.add(sail); break;
      }
      for (let k = 0; k < 6; k++) { const bar = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.07, 0.1), wood); bar.position.set(0.95, 0.9 + k * 1.0, 0.08); arm.add(bar); }
      const tail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 7.0, 0.12), wood); tail.position.set(1.8, 3.2, 0.03); arm.add(tail);
      hub.add(arm);
    }
    g.userData.hub = hub;
    return g;
  }
  function buildSpire() {
    const g = new THREE.Group();
    const brick = std({ color: '#9a5a40', roughness: 0.95 }), copper = std({ color: '#6c8f86', roughness: 0.6 }), white = std({ color: '#efe9da' });
    const tw = new THREE.Mesh(new THREE.BoxGeometry(5.4, 17, 5.4), brick); tw.position.y = 8.5; tw.castShadow = true; g.add(tw);
    const l = new THREE.Mesh(new THREE.BoxGeometry(3.2, 3.4, 3.2), brick); l.position.y = 18.4; g.add(l);
    const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.0, 2.4, 12, 8), copper); sp.position.y = 26.1; sp.castShadow = true; g.add(sp);
    for (const [dx, dz, ry] of [[0, 2.72, 0], [0, -2.72, 0], [2.72, 0, 1], [-2.72, 0, 1]]) { const f = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 0.1, 20), white); f.rotation.x = ry ? 0 : Math.PI / 2; f.rotation.z = ry ? Math.PI / 2 : 0; f.position.set(dx, 14, dz); g.add(f); }
    const band = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.25, 5.6), white); band.position.y = 16.9; g.add(band);
    const snowTop = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.25, 3.4), std({ color: '#f6f6f0' })); snowTop.position.y = 20.2; g.add(snowTop);
    return g;
  }
  function buildShip(r) {
    const g = new THREE.Group();
    const hullMat = std({ color: ['#2b2420', '#3a2a1c', '#2c3a4a'][Math.floor(r() * 3)], roughness: 0.8 }), deck = std({ color: '#a8854f' }), sail = std({ color: '#d9cdb0', side: THREE.DoubleSide }), wood = std({ color: '#4a3418' });
    const L = 9 + r() * 4, Wd = 3.0 + r();
    const sh = new THREE.Shape();
    sh.moveTo(-L / 2, -Wd / 2 * 0.75); sh.lineTo(L / 2 - 1.4, -Wd / 2); sh.quadraticCurveTo(L / 2 + 0.6, 0, L / 2 - 1.4, Wd / 2); sh.lineTo(-L / 2, Wd / 2 * 0.75); sh.closePath();
    const hg = new THREE.ExtrudeGeometry(sh, { depth: 1.5, bevelEnabled: false }); hg.rotateX(-Math.PI / 2);
    const hull = new THREE.Mesh(hg, hullMat); hull.position.y = 0.0; hull.castShadow = true; g.add(hull);
    const dk = new THREE.Mesh(new THREE.BoxGeometry(L * 0.8, 0.12, Wd * 0.7), deck); dk.position.set(-L * 0.06, 1.52, 0); g.add(dk);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(L * 0.22, 1.1, Wd * 0.55), std({ color: '#b78c55' })); cabin.position.set(-L * 0.3, 2.1, 0); g.add(cabin);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.14, 11, 6), wood); mast.position.set(L * 0.1, 7, 0); mast.castShadow = true; g.add(mast);
    const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, L * 0.6, 6), wood); boom.rotation.z = Math.PI / 2; boom.position.set(-L * 0.12, 3.0, 0); g.add(boom);
    const furl = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, L * 0.55, 8), sail); furl.rotation.z = Math.PI / 2; furl.position.set(-L * 0.12, 3.25, 0); g.add(furl);
    const snowD = new THREE.Mesh(new THREE.BoxGeometry(L * 0.7, 0.14, Wd * 0.55), std({ color: '#f4f4ee' })); snowD.position.set(-L * 0.06, 1.62, 0); g.add(snowD);
    return g;
  }

  // ---- the post: painted bands in cream, Delft blue and ochre on a tiled plinth, with a gilt ball ------------------------------
  function buildPost({ h = 3.6, r = 0.5, flag = true } = {}) {
    const g = new THREE.Group();
    const bands = ['#f2e9cf', '#2b5aa0', '#f2e9cf', '#d9a540', '#f2e9cf', '#2b5aa0', '#f2e9cf'];
    const n = bands.length, rb = r + 0.06, rt = r * 0.72;
    for (let i = 0; i < n; i++) {
      const y0 = h * i / n, y1 = h * (i + 1) / n, r0 = rb + (rt - rb) * i / n, r1 = rb + (rt - rb) * (i + 1) / n;
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, y1 - y0, 20), std({ color: bands[i], roughness: 0.55 }));
      m.position.y = 0.18 + (y0 + y1) / 2; m.castShadow = true; g.add(m);
    }
    const plinth = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.34, r + 0.4, 0.2, 24), std({ color: '#f4f2ea', map: tileTex(), roughness: 0.4 }));
    plinth.position.y = 0.1; plinth.receiveShadow = true; g.add(plinth);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(rt + 0.1, rt + 0.04, 0.16, 20), std({ color: '#2a1d12' })); cap.position.y = 0.18 + h + 0.08; g.add(cap);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 12), new THREE.MeshStandardMaterial({ color: '#e8c273', metalness: 0.85, roughness: 0.28 })); ball.position.y = 0.18 + h + 0.3; g.add(ball);
    g.userData.top = 0.18 + h + 0.3;
    if (flag) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 1.2, 6), std({ color: '#2a1d12' })); pole.position.y = g.userData.top + 0.6; g.add(pole);
      const fg = new THREE.PlaneGeometry(1.5, 0.78, 14, 4); fg.translate(0.75, 0, 0);
      const fm = new THREE.Mesh(fg, std({ color: '#b8412e', roughness: 0.7, side: THREE.DoubleSide }));
      fm.position.set(0, g.userData.top + 0.95, 0); g.add(fm); g.userData.flag = fm; g.userData.flagBase = fg.attributes.position.array.slice();
    }
    return g;
  }

  // ---- obstacles --------------------------------------------------------------------------------------------------------------
  function buildPier(o) {   // a brick lock pier / mooring post with a stone cap and an iron ring
    const g = new THREE.Group(), R = o.r + 0.09;
    const brick = std({ color: '#b3694a', map: brickTex(), roughness: 0.95 });
    const b = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.86, R, 1.55, 16), brick); b.position.y = 0.78; b.castShadow = true; b.receiveShadow = true; g.add(b);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.98, R * 0.9, 0.22, 16), std({ color: '#c9c1ae' })); cap.position.y = 1.66; cap.castShadow = true; g.add(cap);
    const snow = new THREE.Mesh(new THREE.SphereGeometry(R * 0.86, 14, 8, 0, TAU, 0, Math.PI / 2), std({ color: '#f6f6f0' })); snow.scale.y = 0.35; snow.position.y = 1.77; g.add(snow);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.035, 8, 16), std({ color: '#2a2a2a', metalness: 0.7, roughness: 0.4 })); ring.position.set(R * 0.88, 1.0, 0); ring.rotation.y = Math.PI / 2; g.add(ring);
    const rope = new THREE.Mesh(new THREE.TorusGeometry(R * 0.93, 0.045, 6, 20), std({ color: '#d9c9a0' })); rope.rotation.x = Math.PI / 2; rope.position.y = 1.2; g.add(rope);
    const sk = new THREE.Mesh(new THREE.CylinderGeometry(R * 1.15, R * 1.2, 0.08, 16), std({ color: '#f1f1ea' })); sk.position.y = 0.04; g.add(sk);
    return g;
  }
  function buildBoat(o) {   // a frozen-in boat or barge: hull block with a cabin and a mast
    const g = new THREE.Group();
    const wx = o.x1 - o.x0 + 0.18, wy = o.y1 - o.y0 + 0.18, barge = o.kind === 'barge', hgt = barge ? 1.5 : 1.35;
    const hullC = barge ? '#4a3a2a' : '#2f4a68', band = barge ? '#2b2016' : '#8d3b2b';
    const hull = new THREE.Mesh(new THREE.BoxGeometry(wx, hgt, wy), std({ color: hullC, roughness: 0.75 })); hull.position.y = hgt / 2; hull.castShadow = true; hull.receiveShadow = true; g.add(hull);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(wx + 0.04, 0.3, wy + 0.04), std({ color: band })); stripe.position.y = 0.18; g.add(stripe);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(wx + 0.12, 0.16, wy + 0.12), std({ color: '#e8dcc0' })); rail.position.y = hgt; g.add(rail);
    const deck = new THREE.Mesh(new THREE.BoxGeometry(wx - 0.3, 0.1, wy - 0.3), std({ color: '#a8854f', map: plankTex() })); deck.position.y = hgt + 0.02; g.add(deck);
    const snow = new THREE.Mesh(new THREE.BoxGeometry(wx - 0.4, 0.14, wy - 0.4), std({ color: '#f5f5ee' })); snow.position.y = hgt + 0.13; g.add(snow);
    if (barge) {
      for (let i = 0; i < 3; i++) { const cr = new THREE.Mesh(new THREE.BoxGeometry(wx * 0.24, 0.8, wy * 0.4), std({ color: '#a8854f', map: plankTex('#a07a44') })); cr.position.set((i - 1) * wx * 0.3, hgt + 0.5, 0); cr.castShadow = true; g.add(cr); const sn = new THREE.Mesh(new THREE.BoxGeometry(wx * 0.24, 0.1, wy * 0.4), std({ color: '#f5f5ee' })); sn.position.set((i - 1) * wx * 0.3, hgt + 0.95, 0); g.add(sn); }
    } else {
      const cab = new THREE.Mesh(new THREE.BoxGeometry(wx * 0.36, 1.0, wy * 0.36), std({ color: '#b9894f', map: plankTex('#b08a50') })); cab.position.set(0, hgt + 0.55, -wy * 0.12); cab.castShadow = true; g.add(cab);
      const cr = new THREE.Mesh(new THREE.BoxGeometry(wx * 0.4, 0.14, wy * 0.4), std({ color: '#f5f5ee' })); cr.position.set(0, hgt + 1.1, -wy * 0.12); g.add(cr);
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 6.0, 6), std({ color: '#2b1f15' })); mast.position.set(0, hgt + 3, wy * 0.15); mast.castShadow = true; g.add(mast);
      const sail = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, wy * 0.5, 8), std({ color: '#e8dcc0' })); sail.rotation.x = Math.PI / 2; sail.position.set(0, hgt + 1.5, wy * 0.15); g.add(sail);
    }
    return g;
  }
  // a kick-sled (prikslee) with seat and long runners; the rider is a real figure added by the presenter
  function buildSledge() {
    const g = new THREE.Group();
    const wood = std({ color: '#8a6a3c', map: plankTex('#9a7440'), roughness: 0.7 }), steel = std({ color: '#8a949c', metalness: 0.8, roughness: 0.3 });
    for (const s of [-1, 1]) {
      const run = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, 2.0), steel); run.position.set(s * 0.32, 0.1, 0); run.castShadow = true; g.add(run);
      const curl = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, 0.35), steel); curl.rotation.x = 0.55; curl.position.set(s * 0.32, 0.2, 1.05); g.add(curl);
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.3, 0.06), wood); post.position.set(s * 0.32, 0.27, 0.5); g.add(post); const post2 = post.clone(); post2.position.z = -0.5; g.add(post2);
    }
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.07, 1.5), wood); seat.position.y = 0.43; seat.castShadow = true; g.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 0.06), wood); back.position.set(0, 0.7, -0.7); back.rotation.x = -0.25; g.add(back);
    return g;
  }

  return { THREE, cv, tex, std, mergeColored, box, snowTex, brickTex, plankTex, barkTex, tileTex, iceCanvas, houseGeos, treeGeos, buildMill, buildSpire, buildShip, buildPost, buildPier, buildBoat, buildSledge, VARIANTS, HOUSE };
}

// The festival grounds: sky dome, ground, the marked lane, the rope and flag, scenery for six settings and a cheering crowd.
// Coordinates: the rope runs along X (team A on -X, team B on +X, both facing the centre), Y up, the camera side is +Z. The centre line is x = 0.
// Everything is generated from fixed seeds with canvas textures: no image files. buildWorld(...).setSetting(id) rebuilds the per-setting scenery.
const rnd = (seed) => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

// per-setting look: sky gradient (top, horizon), fog, lighting numbers, ground colours, mood tag
export const LOOKS = {
  harvest: { top: '#5d9be0', hor: '#f4d9a4', fog: 0xe9d3a8, fogN: 22, fogF: 90, g1: '#7da34a', g2: '#8fb457', lane: '#b49a62', hemi: 0.85, keyI: 3.1, key: '#ffe2b0', sky: 0xbcd4f2, gnd: 0x6b5a30, exp: 1.02, sun: 1 },
  river: { top: '#4f93d8', hor: '#dcebf4', fog: 0xd2e3ea, fogN: 24, fogF: 100, g1: '#9aa65a', g2: '#a8b266', lane: '#cdb98a', hemi: 0.9, keyI: 3.0, key: '#fff1d6', sky: 0xc4dcf0, gnd: 0x756d45, exp: 1.04, sun: 1 },
  meadow: { top: '#3f86d9', hor: '#cfe6f6', fog: 0xcfe2f0, fogN: 26, fogF: 120, g1: '#4f9446', g2: '#5ea652', lane: '#a99a68', hemi: 0.9, keyI: 3.2, key: '#fffaf0', sky: 0xa8caf0, gnd: 0x4a5e34, exp: 1.04, sun: 1 },
  seaside: { top: '#2f8fe0', hor: '#d6f0fb', fog: 0xcfeaf6, fogN: 30, fogF: 130, g1: '#e3cd98', g2: '#dcc58c', lane: '#d2b980', hemi: 1.0, keyI: 3.3, key: '#fff6e0', sky: 0xbfe2f8, gnd: 0xb59d68, exp: 1.08, sun: 1 },
  lantern: { top: '#0b1030', hor: '#3a2f5a', fog: 0x1c1b3c, fogN: 16, fogF: 70, g1: '#3c5a3a', g2: '#466846', lane: '#6e5f46', hemi: 0.75, keyI: 2.4, key: '#ffcf8a', sky: 0x4b5a96, gnd: 0x2a2630, exp: 1.18, sun: 0 },
  grand: { top: '#355f9f', hor: '#f3c58a', fog: 0xe6c7a0, fogN: 24, fogF: 100, g1: '#5f9a47', g2: '#6dac52', lane: '#b8a06a', hemi: 0.85, keyI: 3.2, key: '#ffd9a0', sky: 0xb2c4e8, gnd: 0x5a4a30, exp: 1.06, sun: 1 },
};

function cv(doc, w, h, draw) { const c = doc.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); return c; }

export function buildWorld(V3, stage) {
  const { THREE } = V3;
  const doc = globalThis.document;
  const root = new THREE.Group(); root.name = 'festival';
  const scenery = new THREE.Group(); root.add(scenery);
  const std = (c, r = 0.85, m = 0, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m, ...o });
  const lam = (c, o = {}) => new THREE.MeshLambertMaterial({ color: c, ...o });
  const basic = (c, o = {}) => new THREE.MeshBasicMaterial({ color: c, ...o });
  const out = { root, scenery, crowd: null, setting: '', flags: [], banner: [], lanterns: [], t: 0 };
  const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
  const tex = (canvas, repeat) => { const t = new THREE.CanvasTexture(canvas); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; if (repeat) t.repeat.set(repeat[0], repeat[1]); t.anisotropy = 4; return t; };

  // ---- sky dome ---------------------------------------------------------------------------------------------------------------------
  const skyMat = new THREE.MeshBasicMaterial({ side: THREE.BackSide, fog: false, depthWrite: false });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(180, 32, 16), skyMat); sky.renderOrder = -10; sky.frustumCulled = false; root.add(sky);
  function paintSky(look, id) {
    const R = rnd(7);
    const c = cv(doc, 512, 512, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, look.top); gr.addColorStop(0.5, look.hor); gr.addColorStop(0.52, look.hor); gr.addColorStop(1, look.hor);
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      if (id === 'lantern') { for (let i = 0; i < 260; i++) { g.globalAlpha = 0.35 + R() * 0.65; g.fillStyle = '#fff6e0'; const s = R() < 0.1 ? 2 : 1; g.fillRect(R() * w, R() * h * 0.46, s, s); } g.globalAlpha = 1; }
      else {
        for (let i = 0; i < 16; i++) { const x = R() * w, y = 40 + R() * h * 0.34, r = 14 + R() * 30; g.globalAlpha = 0.22 + R() * 0.2; g.fillStyle = '#ffffff'; for (let k = 0; k < 5; k++) { g.beginPath(); g.ellipse(x + (k - 2) * r * 0.6, y + (k % 2) * 4, r, r * 0.45, 0, 0, 7); g.fill(); } }
        g.globalAlpha = 1;
        if (look.sun) { const sx = id === 'grand' ? 380 : 120, sy = h * 0.46; const gs = g.createRadialGradient(sx, sy, 0, sx, sy, 120); gs.addColorStop(0, 'rgba(255,240,200,0.85)'); gs.addColorStop(1, 'rgba(255,240,200,0)'); g.fillStyle = gs; g.fillRect(sx - 120, sy - 120, 240, 240); }
      }
    });
    if (skyMat.map) skyMat.map.dispose();
    skyMat.map = new THREE.CanvasTexture(c); skyMat.map.colorSpace = THREE.SRGBColorSpace; skyMat.needsUpdate = true;
  }

  // ---- ground and the marked lane ---------------------------------------------------------------------------------------------------
  const groundMat = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(300, 300), groundMat); ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; root.add(ground);
  const laneMat = new THREE.MeshStandardMaterial({ roughness: 1, metalness: 0 });
  const lane = new THREE.Mesh(new THREE.PlaneGeometry(24, 3.6), laneMat); lane.rotation.x = -Math.PI / 2; lane.position.y = 0.004; lane.receiveShadow = true; root.add(lane);
  function paintGround(look, id) {
    const R = rnd(31);
    const gc = cv(doc, 512, 512, (g, w, h) => {
      g.fillStyle = look.g1; g.fillRect(0, 0, w, h);
      const sand = id === 'seaside';
      for (let i = 0; i < 6; i++) { g.fillStyle = look.g2; g.globalAlpha = 0.7; g.fillRect(0, i * (h / 6) + (h / 12), w, h / 12); }
      g.globalAlpha = 1;
      const im = g.getImageData(0, 0, w, h);
      for (let i = 0; i < im.data.length; i += 4) { const n = (R() - 0.5) * (sand ? 14 : 34); im.data[i] += n; im.data[i + 1] += n; im.data[i + 2] += n * 0.8; }
      g.putImageData(im, 0, 0);
      if (sand) { g.strokeStyle = 'rgba(120,90,50,0.12)'; g.lineWidth = 2; for (let i = 0; i < 40; i++) { const y = R() * h; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(w * 0.3, y + 8, w * 0.6, y - 8, w, y + 4); g.stroke(); } }
      else { g.strokeStyle = 'rgba(30,60,20,0.18)'; g.lineWidth = 1; for (let i = 0; i < 900; i++) { const x = R() * w, y = R() * h; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (R() - 0.5) * 3, y - 3 - R() * 3); g.stroke(); } }
    });
    if (groundMat.map) groundMat.map.dispose();
    groundMat.map = tex(gc, [60, 60]); groundMat.needsUpdate = true;
    const lc = cv(doc, 512, 128, (g, w, h) => {
      g.fillStyle = look.lane; g.fillRect(0, 0, w, h);
      const im = g.getImageData(0, 0, w, h);
      for (let i = 0; i < im.data.length; i += 4) { const n = (R() - 0.5) * 30; im.data[i] += n; im.data[i + 1] += n; im.data[i + 2] += n; }
      g.putImageData(im, 0, 0);
      for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(70,50,30,${0.05 + R() * 0.1})`; g.beginPath(); g.ellipse(R() * w, R() * h, 3 + R() * 9, 2 + R() * 4, R() * 3, 0, 7); g.fill(); }
      const e = g.createLinearGradient(0, 0, 0, h); e.addColorStop(0, 'rgba(0,0,0,0.0)'); e.addColorStop(1, 'rgba(0,0,0,0)');
    });
    if (laneMat.map) laneMat.map.dispose();
    laneMat.map = tex(lc, [3, 1]); laneMat.needsUpdate = true;
  }

  // chalk lines: centre, win lines, ticks every 0.4 m. Colours of the win lines follow the team kits.
  const lineGroup = new THREE.Group(); root.add(lineGroup);
  const centre = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 3.4), basic(0xf4f1e6)); centre.rotation.x = -Math.PI / 2; centre.position.set(0, 0.008, 0); lineGroup.add(centre);
  const winL = [0, 1].map(() => { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 3.4), basic(0xffffff)); m.rotation.x = -Math.PI / 2; m.position.y = 0.009; lineGroup.add(m); return m; });
  const LIM = 1.6;
  winL[0].position.x = -LIM; winL[1].position.x = LIM;   // world X: team A is on -X, so its win line is at world x = +LIM? set by setTeamColors
  for (const k of [-1.2, -0.8, -0.4, 0.4, 0.8, 1.2]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 2.0), basic(0xf4f1e6, { transparent: true, opacity: 0.55 })); m.rotation.x = -Math.PI / 2; m.position.set(k, 0.007, 0); lineGroup.add(m); }
  out.setLineColors = (colA, colB) => { winL[1].material.color.set(colA); winL[0].material.color.set(colB); };
  // (the flag crosses the world line x = +LIM when side B wins? no: s.x > 0 moves the flag toward A, i.e. to world -x. Win line for A is at world x = -LIM.)
  // so side A's line is world -LIM: fix the mapping
  out.setLineColors = (colA, colB) => { winL[0].material.color.set(colA); winL[1].material.color.set(colB); };

  // ---- the rope ---------------------------------------------------------------------------------------------------------------------
  const RL = 13, RS = 96;
  const ropeGeo = new THREE.CylinderGeometry(0.026, 0.026, RL, 8, RS, false);
  ropeGeo.rotateZ(Math.PI / 2);                      // axis along X
  const rbase = ropeGeo.attributes.position.array.slice();
  const ropeTex = tex(cv(doc, 64, 64, (g, w, h) => { g.fillStyle = '#c9a56a'; g.fillRect(0, 0, w, h); g.strokeStyle = '#8a6a3a'; g.lineWidth = 6; for (let i = -2; i < 8; i++) { g.beginPath(); g.moveTo(i * 12, 0); g.lineTo(i * 12 + 30, h); g.stroke(); } }), [90, 1]);
  const rope = new THREE.Mesh(ropeGeo, new THREE.MeshStandardMaterial({ map: ropeTex, roughness: 0.9 })); rope.castShadow = true; rope.frustumCulled = false; root.add(rope);
  // flag: a ribbon cloth under the rope's middle with a knot
  const flagGeo = new THREE.PlaneGeometry(0.4, 0.5, 8, 4); flagGeo.translate(0, -0.25, 0);
  const flagBase = flagGeo.attributes.position.array.slice();
  const flagTex = new THREE.CanvasTexture(cv(doc, 128, 160, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = '#d62828'; g.beginPath(); g.moveTo(0, 0); g.lineTo(w, 0); g.lineTo(w, h); g.lineTo(w / 2, h * 0.76); g.lineTo(0, h); g.closePath(); g.fill();
    g.fillStyle = '#fff'; g.fillRect(0, h * 0.24, w, h * 0.13);
    g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(0, 0, w, 6);
  })); flagTex.colorSpace = THREE.SRGBColorSpace;
  const flag = new THREE.Mesh(flagGeo, new THREE.MeshLambertMaterial({ map: flagTex, alphaTest: 0.5, side: THREE.DoubleSide })); flag.castShadow = true; root.add(flag);
  const knot = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), std(0xe9c46a, 0.6)); root.add(knot);
  out.rope = { mesh: rope, flag, knot };
  const pts = []; for (let i = 0; i <= 12; i++) pts.push(0);
  // update: flagX world, hand points [{x, y}] for both teams sorted by x, tension 0..1, t seconds, hands y
  out.updateRope = (flagX, yHand, tension, t, spanA, spanB, yawA, yawB, sway) => {
    const pos = rope.geometry.attributes.position, arr = pos.array;
    const x0 = flagX - 6.5, sagMax = 0.12 * (1 - tension) + 0.012;
    const xa = flagX - spanA, xb = flagX + spanB;               // the outermost hands of each team
    for (let i = 0; i < arr.length; i += 3) {
      const wx = flagX + rbase[i];                             // vertex world x
      const dxc = wx - flagX;
      // inside the pulled span: slight sag; beyond the anchors: the tail falls to the ground
      let y = yHand;
      const inSpan = wx >= xa && wx <= xb;
      if (inSpan) { const u = (wx - xa) / Math.max(0.1, xb - xa); y = yHand - sagMax * 4 * u * (1 - u) * 0.6 - sagMax * Math.exp(-dxc * dxc / 1.2); }
      else { const d = wx < xa ? xa - wx : wx - xb; y = Math.max(0.03, yHand - sagMax * 0.3 - d * d * 0.55); }
      const wob = Math.sin(wx * 3.1 + t * 9) * 0.004 * (0.3 + tension * 1.6);
      arr[i] = wx; arr[i + 1] = rbase[i + 1] + y + wob; arr[i + 2] = rbase[i + 2] + (sway ? Math.sin(wx * 0.9 + t * 2) * 0.01 : 0);
    }
    pos.needsUpdate = true; rope.geometry.computeBoundingSphere();
    ropeTex.offset.x = 0;
    void x0;
    // flag + knot on the rope at flagX
    const fy = yHand - sagMax * 1.9;
    flag.position.set(flagX, fy - 0.03, 0.0); knot.position.set(flagX, fy, 0);
    const fp = flag.geometry.attributes.position.array;
    for (let i = 0; i < fp.length; i += 3) { const d = -flagBase[i + 1] / 0.5; fp[i] = flagBase[i]; fp[i + 1] = flagBase[i + 1]; fp[i + 2] = Math.sin(t * 7 + flagBase[i] * 9 + d * 3) * 0.03 * (0.3 + d); }
    flag.geometry.attributes.position.needsUpdate = true;
  };

  // ---- scenery pieces ----------------------------------------------------------------------------------------------------------------
  const cone = (r, h, seg = 8) => new THREE.CylinderGeometry(0, r, h, seg);
  function merged(parts) {       // merge [{geo, matrix, color}] into one vertex-coloured BufferGeometry (one draw call)
    let n = 0, ni = 0;
    for (const p of parts) { n += p.geo.attributes.position.count; ni += p.geo.index ? p.geo.index.count : p.geo.attributes.position.count; }
    const P = new Float32Array(n * 3), N = new Float32Array(n * 3), C = new Float32Array(n * 3), I = new Uint32Array(ni);
    let o = 0, io = 0; const col = new THREE.Color(), nm = new THREE.Matrix3(), v = V();
    for (const p of parts) {
      const g = p.geo, m = p.matrix, pa = g.attributes.position, na = g.attributes.normal; col.set(p.color); nm.getNormalMatrix(m);
      for (let i = 0; i < pa.count; i++) {
        v.fromBufferAttribute(pa, i).applyMatrix4(m); P[(o + i) * 3] = v.x; P[(o + i) * 3 + 1] = v.y; P[(o + i) * 3 + 2] = v.z;
        v.fromBufferAttribute(na, i).applyMatrix3(nm).normalize(); N[(o + i) * 3] = v.x; N[(o + i) * 3 + 1] = v.y; N[(o + i) * 3 + 2] = v.z;
        const j = 0.92 + ((i * 7 + o) % 9) * 0.01; C[(o + i) * 3] = col.r * j; C[(o + i) * 3 + 1] = col.g * j; C[(o + i) * 3 + 2] = col.b * j;
      }
      if (g.index) for (let i = 0; i < g.index.count; i++) I[io++] = g.index.array[i] + o; else for (let i = 0; i < pa.count; i++) I[io++] = i + o;
      o += pa.count;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(P, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(N, 3)); geo.setAttribute('color', new THREE.BufferAttribute(C, 3)); geo.setIndex(new THREE.BufferAttribute(I, 1));
    return geo;
  }
  const M4 = new THREE.Matrix4(), Q4 = new THREE.Quaternion(), E4 = new THREE.Euler(), S4 = V(1, 1, 1);
  const place = (x, y, z, ry = 0, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0) => { E4.set(rx, ry, rz); Q4.setFromEuler(E4); S4.set(sx, sy, sz); return new THREE.Matrix4().compose(V(x, y, z), Q4, S4); };
  const vmat = (o = {}) => new THREE.MeshLambertMaterial({ vertexColors: true, ...o });

  function tree(parts, x, z, s, kind, R) {
    if (kind === 'pine') {
      parts.push({ geo: new THREE.CylinderGeometry(0.12 * s, 0.18 * s, 1.2 * s, 6), matrix: place(x, 0.6 * s, z), color: '#5a3b22' });
      for (let k = 0; k < 4; k++) parts.push({ geo: cone((1.5 - k * 0.28) * s, 1.7 * s, 8), matrix: place(x, (1.1 + k * 0.95) * s, z), color: k % 2 ? '#2f6b3a' : '#285c33' });
    } else {
      const c = kind === 'autumn' ? ['#c97a1e', '#b8561a', '#d9a13a', '#8f4a1a'][(R() * 4) | 0] : ['#4c8f3a', '#58a042', '#3f7f33'][(R() * 3) | 0];
      parts.push({ geo: new THREE.CylinderGeometry(0.16 * s, 0.24 * s, 2.2 * s, 6), matrix: place(x, 1.1 * s, z), color: '#5e4128' });
      for (let k = 0; k < 4; k++) parts.push({ geo: new THREE.SphereGeometry(1.0 * s, 8, 6), matrix: place(x + (R() - 0.5) * 1.3 * s, (2.8 + R() * 1.0) * s, z + (R() - 0.5) * 1.3 * s, 0, 1.15, 0.9, 1.15), color: c });
    }
  }
  function hay(parts, x, z, R) { const s = 0.8 + R() * 0.3; parts.push({ geo: new THREE.CylinderGeometry(0.62 * s, 0.62 * s, 0.9 * s, 14), matrix: place(x, 0.62 * s, z, R() * 3, 1, 1, 1, Math.PI / 2, 0), color: '#d8b24a' }); }
  function stall(parts, x, z, ry, c1, c2) {
    parts.push({ geo: new THREE.BoxGeometry(2.6, 1.0, 1.2), matrix: place(x, 0.5, z, ry), color: '#8a5a32' });
    for (const dx of [-1.2, 1.2]) parts.push({ geo: new THREE.CylinderGeometry(0.05, 0.05, 2.5, 6), matrix: place(x + Math.cos(-ry) * dx, 1.25, z + Math.sin(-ry) * dx, ry), color: '#6b4426' });
    for (let k = 0; k < 6; k++) { const u = (k - 2.5) * 0.45; parts.push({ geo: new THREE.BoxGeometry(0.44, 0.06, 1.7), matrix: place(x + Math.cos(-ry) * u, 2.45 + Math.abs(k - 2.5) * -0.02, z + Math.sin(-ry) * u, ry, 1, 1, 1, 0.12, 0), color: k % 2 ? c1 : c2 }); }
  }
  function tent(parts, x, z, r, h, c1, c2) { parts.push({ geo: new THREE.CylinderGeometry(r, r, h * 0.45, 12), matrix: place(x, h * 0.225, z), color: c2 }); parts.push({ geo: new THREE.CylinderGeometry(0.02, r * 1.12, h * 0.6, 12), matrix: place(x, h * 0.45 + h * 0.3, z), color: c1 }); }
  function post(parts, x, z, h = 2.6, c = '#6b4426') { parts.push({ geo: new THREE.CylinderGeometry(0.06, 0.08, h, 6), matrix: place(x, h / 2, z), color: c }); }
  function bunting(group, a, b, sag, colors, n = 14) {
    const geoParts = [], R = rnd(a.x * 7 + b.x);
    const rope3 = []; for (let i = 0; i <= n; i++) { const u = i / n; rope3.push(V(lerp(a.x, b.x, u), lerp(a.y, b.y, u) - sag * 4 * u * (1 - u), lerp(a.z, b.z, u))); }
    const line = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rope3), 20, 0.012, 4), basic(0x3a2a1a)); group.add(line);
    for (let i = 0; i < n; i++) { const p = rope3[i], q = rope3[i + 1], mid = p.clone().lerp(q, 0.5); const w = p.distanceTo(q) * 0.82; const g = new THREE.CylinderGeometry(w * 0.5, 0, 0.42, 3); geoParts.push({ geo: g, matrix: place(mid.x, mid.y - 0.2, mid.z, 0, 1, 1, 0.18), color: colors[i % colors.length] }); void R; }
    const m = new THREE.Mesh(merged(geoParts), vmat({ side: THREE.DoubleSide })); m.castShadow = false; group.add(m);
  }

  function clearScenery() { while (scenery.children.length) { const c = scenery.children.pop(); c.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material && !o.material.shared) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); } }); } out.flags = []; out.lanterns = []; out.crowd = null; }

  // crowd: instanced simple spectators, standing in arcs behind the lane; they cheer when told to
  function buildCrowd(group, spots, palette) {
    const NC = spots.length; if (!NC) return null;
    const bodyG = new THREE.CapsuleGeometry(0.2, 0.4, 4, 10); bodyG.scale(1.12, 1, 0.78); bodyG.translate(0, 1.08, 0);
    const legG = merged([{ geo: new THREE.CylinderGeometry(0.078, 0.066, 0.74, 7), matrix: place(-0.09, 0.37, 0), color: '#ffffff' }, { geo: new THREE.CylinderGeometry(0.078, 0.066, 0.74, 7), matrix: place(0.09, 0.37, 0), color: '#ffffff' }]);
    const headG = new THREE.SphereGeometry(0.135, 10, 8); headG.translate(0, 1.6, 0);
    const hairG = new THREE.SphereGeometry(0.145, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.58); hairG.translate(0, 1.615, -0.005);
    const armG = new THREE.CapsuleGeometry(0.04, 0.42, 3, 6); armG.translate(0, -0.27, 0);
    const mk = (g, n, c, vc) => { const m = new THREE.InstancedMesh(g, lam(c, vc ? { vertexColors: true } : {}), n); m.frustumCulled = false; m.castShadow = false; group.add(m); return m; };
    const bodies = mk(bodyG, NC, 0xffffff), heads = mk(headG, NC, 0xffffff), legs = mk(legG, NC, 0xffffff, true), arms = mk(armG, NC * 2, 0xffffff), hairs = mk(hairG, NC, 0xffffff);
    const skin = ['#e8c3a2', '#d9a982', '#b98563', '#f1d3b8', '#8f5f43', '#6b4530'];
    const hairC = ['#1b1714', '#2a1d14', '#4a3220', '#7a5a3a', '#c7a468', '#9a9a9a', '#9c4a26', '#111111'];
    const trouser = ['#2a2d36', '#3b4256', '#5a4a38', '#26402f', '#4a3a58', '#1f2a44'];
    const c = new THREE.Color(), R = rnd(99);
    spots.forEach((p, i) => {
      p.ph = R() * 6.28; p.sc = 0.9 + R() * 0.22; bodies.setColorAt(i, c.set(palette[(R() * palette.length) | 0])); const sk = skin[(R() * skin.length) | 0]; heads.setColorAt(i, c.set(sk));
      arms.setColorAt(i * 2, c.set(sk)); arms.setColorAt(i * 2 + 1, c.set(sk)); hairs.setColorAt(i, c.set(hairC[(R() * hairC.length) | 0])); legs.setColorAt(i, c.set(trouser[(R() * trouser.length) | 0]));
    });
    const mtx = new THREE.Matrix4(), qq = new THREE.Quaternion(), ee = new THREE.Euler(), scl = V(), p0 = V(), p1 = V();
    const api = {
      cheer: 0, t: 0,
      update(dt, cheer) {
        this.t += dt; this.cheer += (cheer - this.cheer) * Math.min(1, dt * 4);
        for (let i = 0; i < NC; i++) {
          const b = spots[i];
          const bob = Math.abs(Math.sin(this.t * (2.2 + (i % 5) * 0.25) + b.ph)) * (0.025 + 0.22 * this.cheer);
          ee.set(0, b.rot, 0); qq.setFromEuler(ee); scl.set(b.sc, b.sc * (1 + this.cheer * 0.03), b.sc); p0.set(b.x, b.y + bob, b.z);
          mtx.compose(p0, qq, scl); bodies.setMatrixAt(i, mtx); heads.setMatrixAt(i, mtx); legs.setMatrixAt(i, mtx); hairs.setMatrixAt(i, mtx);
          for (let k = 0; k < 2; k++) {
            const sd = k ? 1 : -1, ce = Math.max(0, Math.min(1, (this.cheer - 0.3) / 0.7)), lift = ce * (2.6 + Math.sin(this.t * 7 + b.ph + k) * 0.5);
            ee.set(0, b.rot, sd * (0.08 + lift)); qq.setFromEuler(ee); ee.set(0, b.rot, 0);
            const off = p1.set(sd * 0.25 * b.sc, 1.3 * b.sc, 0).applyEuler(ee);
            mtx.compose(V(p0.x + off.x, p0.y + off.y, p0.z + off.z), qq, scl.set(b.sc, b.sc, b.sc)); arms.setMatrixAt(i * 2 + k, mtx);
          }
        }
        for (const m of [bodies, heads, legs, arms, hairs]) m.instanceMatrix.needsUpdate = true;
      },
    };
    api.update(0, 0);
    return api;
  }
  const arcSpots = (R, n, zMin, zMax, endMin, endMax, y0 = 0, faceCentre = true) => {
    const spots = [];
    for (let i = 0; i < n; i++) {
      const zone = R();
      let x, z;
      if (zone < 0.62) { x = (R() - 0.5) * 22; z = -(zMin + R() * (zMax - zMin)); } else { const side = R() < 0.5 ? -1 : 1; x = side * (endMin + R() * (endMax - endMin)); z = (R() - 0.35) * 14; }
      spots.push({ x, y: y0, z, rot: faceCentre ? Math.atan2(-x, -z) : 0 });
    }
    return spots;
  };

  // ---- the six grounds ----------------------------------------------------------------------------------------------------------------
  const BUILD = {
    harvest(g, R) {
      const parts = [];
      for (let i = 0; i < 26; i++) { const a = R() * 6.28, d = 16 + R() * 26; tree(parts, Math.cos(a) * d * 1.3, -Math.abs(Math.sin(a)) * d - 6, 0.9 + R() * 0.7, R() < 0.55 ? 'autumn' : 'round', R); }
      for (let i = 0; i < 14; i++) hay(parts, -9 + i * 1.4 + R() * 0.4, -5.2 - R() * 0.8, R);
      for (let i = 0; i < 5; i++) { hay(parts, 8 + i * 1.3, 0.2, R); hay(parts, -(8 + i * 1.3), -0.2, R); }
      // barn
      parts.push({ geo: new THREE.BoxGeometry(9, 4.5, 6), matrix: place(-17, 2.25, -24, 0.2), color: '#a63c2a' });
      parts.push({ geo: new THREE.CylinderGeometry(0, 5.2, 3, 4), matrix: place(-17, 6, -24, 0.2 + Math.PI / 4, 1.3, 1, 0.9), color: '#6b3a2a' });
      // fence along the far side
      for (let x = -12; x <= 12; x += 2) { post(parts, x, -4.2, 1.1); }
      g.add(new THREE.Mesh(merged(parts), vmat()));
      const rail = []; for (let x = -12; x < 12; x += 2) for (const h of [0.55, 0.95]) rail.push({ geo: new THREE.BoxGeometry(2, 0.07, 0.07), matrix: place(x + 1, h, -4.2), color: '#8a6238' });
      g.add(new THREE.Mesh(merged(rail), vmat()));
      const pp = []; post(pp, -10, -3, 3.2); post(pp, 10, -3, 3.2); g.add(new THREE.Mesh(merged(pp), vmat()));
      bunting(g, V(-10, 3.1, -3), V(10, 3.1, -3), 1.1, ['#d62828', '#f2c14e', '#2a6fb0', '#ffffff', '#2f9e5c'], 22);
      return { palette: ['#c0392b', '#2c5d8f', '#e8e4d8', '#d98a2b', '#4f7d5e', '#7a4f7c'], crowd: 150 };
    },
    river(g, R) {
      const parts = [];
      for (let i = 0; i < 20; i++) { const x = (R() - 0.5) * 70; tree(parts, x, -24 - R() * 20, 0.9 + R() * 0.8, 'round', R); }
      stall(parts, -6.5, -6.2, 0.1, '#e63946', '#f4f1de'); stall(parts, -2.2, -6.4, 0, '#2a9d8f', '#f4f1de'); stall(parts, 2.4, -6.3, -0.05, '#f4a261', '#f4f1de'); stall(parts, 6.8, -6.2, -0.1, '#6a4c93', '#f4f1de');
      tent(parts, 13, -4, 2.4, 3.8, '#e63946', '#f4f1de'); tent(parts, -13.5, -4.5, 2.4, 3.8, '#2a9d8f', '#f4f1de');
      for (let i = 0; i < 20; i++) post(parts, -10 + i * 1.05, -3.3 + (i % 2) * 0.01, 0.5, '#7a5a3a');
      // bridge
      for (let i = 0; i < 12; i++) parts.push({ geo: new THREE.BoxGeometry(1.2, 0.2, 4), matrix: place(-8 + i * 1.3, 1.1 + Math.sin(i / 11 * Math.PI) * 1.1, -22), color: '#7a5a3a' });
      g.add(new THREE.Mesh(merged(parts), vmat()));
      const riv = new THREE.Mesh(new THREE.PlaneGeometry(200, 14), new THREE.MeshStandardMaterial({ color: 0x3f8fbf, roughness: 0.15, metalness: 0.3, transparent: true, opacity: 0.92 })); riv.rotation.x = -Math.PI / 2; riv.position.set(0, 0.02, -22); g.add(riv);
      const pp = []; post(pp, -10, -3, 3.2); post(pp, 10, -3, 3.2); g.add(new THREE.Mesh(merged(pp), vmat()));
      bunting(g, V(-10, 3.1, -3), V(10, 3.1, -3), 1.0, ['#e63946', '#f4f1de', '#2a9d8f', '#f4a261'], 22);
      return { palette: ['#e63946', '#457b9d', '#f1faee', '#e9c46a', '#2a9d8f', '#6d597a'], crowd: 150 };
    },
    meadow(g, R) {
      const parts = [];
      for (let i = 0; i < 46; i++) { const x = (R() - 0.5) * 120, z = -14 - R() * 40; tree(parts, x, z, 1.0 + R() * 1.0, 'pine', R); }
      for (let i = 0; i < 12; i++) tree(parts, (R() - 0.5) * 26, -8 - R() * 3, 0.8 + R() * 0.5, 'pine', R);
      // chalet
      parts.push({ geo: new THREE.BoxGeometry(6, 3.2, 4.4), matrix: place(15, 1.6, -9, -0.3), color: '#9a6a3a' });
      parts.push({ geo: new THREE.CylinderGeometry(0, 4.2, 2.2, 4), matrix: place(15, 4.3, -9, -0.3 + Math.PI / 4, 1.1, 1, 0.8), color: '#6e3d2a' });
      for (let i = 0; i < 90; i++) { const x = (R() - 0.5) * 40, z = -4 - R() * 10; parts.push({ geo: new THREE.SphereGeometry(0.07, 5, 4), matrix: place(x, 0.1, z), color: ['#ffd23f', '#ffffff', '#ee6c4d', '#c77dff'][(R() * 4) | 0] }); }
      g.add(new THREE.Mesh(merged(parts), vmat()));
      const mp = [];
      for (let i = 0; i < 9; i++) { const x = -90 + i * 22 + R() * 8, s = 1.0 + R() * 0.7; mp.push({ geo: cone(26 * s, 40 * s, 7), matrix: place(x, 20 * s - 2, -110 - R() * 12), color: '#7f8aa3' }); mp.push({ geo: cone(8.5 * s, 13.5 * s, 7), matrix: place(x, 33.2 * s - 2, -110), color: '#f4f7fb' }); }
      const mm = new THREE.Mesh(merged(mp), vmat({ fog: true })); g.add(mm);
      const pp = []; post(pp, -9, -3, 3); post(pp, 9, -3, 3); g.add(new THREE.Mesh(merged(pp), vmat()));
      bunting(g, V(-9, 3, -3), V(9, 3, -3), 0.9, ['#2f9e5c', '#ffffff', '#c1272d', '#f2c14e'], 20);
      return { palette: ['#3a6ea5', '#c44536', '#f0ead2', '#6a994e', '#e09f3e', '#7b4b94'], crowd: 120 };
    },
    seaside(g, R) {
      const parts = [];
      const cols = ['#e63946', '#f4a261', '#2a9d8f', '#457b9d', '#e9c46a', '#ffffff'];
      for (let i = 0; i < 12; i++) { const x = -14 + i * 2.6 + R(), z = -6.5 - R() * 2.5; parts.push({ geo: new THREE.CylinderGeometry(0.04, 0.04, 2.6, 5), matrix: place(x, 1.3, z), color: '#e9e2cf' }); for (let k = 0; k < 6; k++) parts.push({ geo: new THREE.CylinderGeometry(0, 1.4, 0.5, 3, 1, false, k * 1.0472, 1.0472), matrix: place(x, 2.5, z), color: k % 2 ? cols[i % 6] : '#ffffff' }); }
      // lighthouse
      for (let k = 0; k < 6; k++) parts.push({ geo: new THREE.CylinderGeometry(1.8 - k * 0.12, 2.0 - k * 0.12, 3.3, 12), matrix: place(-30, 1.65 + k * 3.3, -38), color: k % 2 ? '#c1272d' : '#f5f5f0' });
      parts.push({ geo: new THREE.CylinderGeometry(1.5, 1.5, 1.5, 12), matrix: place(-30, 20.5, -38), color: '#ffe9a0' });
      parts.push({ geo: cone(2.2, 1.8, 12), matrix: place(-30, 22.1, -38), color: '#c1272d' });
      for (let i = 0; i < 18; i++) { const x = -30 + R() * 60, z = -9 - R() * 6; parts.push({ geo: new THREE.SphereGeometry(0.45 + R() * 0.3, 6, 5), matrix: place(x, 0.25, z, 0, 1.4, 0.55, 1), color: '#a89870' }); }
      for (let i = 0; i < 4; i++) { const x = -10 + i * 7, z = -5.5; parts.push({ geo: new THREE.BoxGeometry(2.4, 2.6, 1.8), matrix: place(x, 1.3, z), color: ['#f4a261', '#e63946', '#2a9d8f', '#e9c46a'][i] }); parts.push({ geo: new THREE.BoxGeometry(2.7, 0.15, 2.1), matrix: place(x, 2.7, z), color: '#ffffff' }); }
      g.add(new THREE.Mesh(merged(parts), vmat()));
      const sea = new THREE.Mesh(new THREE.PlaneGeometry(300, 90), new THREE.MeshStandardMaterial({ color: 0x1f8fc9, roughness: 0.12, metalness: 0.25 })); sea.rotation.x = -Math.PI / 2; sea.position.set(0, 0.0, -62); g.add(sea);
      const foam = new THREE.Mesh(new THREE.PlaneGeometry(300, 3), basic(0xffffff, { transparent: true, opacity: 0.7 })); foam.rotation.x = -Math.PI / 2; foam.position.set(0, 0.03, -17.5); g.add(foam); out.flags.push({ foam });
      const pp = []; post(pp, -9, -3, 3); post(pp, 9, -3, 3); g.add(new THREE.Mesh(merged(pp), vmat()));
      bunting(g, V(-9, 3, -3), V(9, 3, -3), 1.0, ['#e63946', '#ffffff', '#2a9d8f', '#e9c46a', '#457b9d'], 22);
      return { palette: ['#e76f51', '#2a9d8f', '#f4f1de', '#264653', '#e9c46a', '#e63946'], crowd: 130 };
    },
    lantern(g, R) {
      const parts = [];
      for (let i = 0; i < 28; i++) tree(parts, (R() - 0.5) * 90, -16 - R() * 30, 1 + R() * 0.8, R() < 0.5 ? 'pine' : 'round', R);
      tent(parts, -12, -7, 2.6, 4.2, '#7a2d4d', '#3a1d33'); tent(parts, 12.5, -7, 2.6, 4.2, '#2d5d7a', '#1d2b3a'); tent(parts, 0, -12, 3.4, 5.5, '#8a3d2a', '#4a2418');
      for (let x = -14; x <= 14; x += 2) post(parts, x, -4.2, 1.1, '#4a3320');
      g.add(new THREE.Mesh(merged(parts), vmat()));
      const lp = [];
      const strings = [[V(-12, 4.2, -2.5), V(12, 4.2, -2.5), 0.9], [V(-12, 3.6, -5.5), V(12, 3.6, -5.5), 0.7], [V(-12, 4.8, 3.5), V(12, 4.8, 3.5), 1.0], [V(-9, 5.2, -1), V(9, 5.2, -1), 0.5]];
      const lcol = ['#ffb347', '#ff6b6b', '#ffd166', '#f78fb3', '#ff9f43'];
      const glowTex = new THREE.CanvasTexture(cv(doc, 64, 64, (gg) => { const gr = gg.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,214,150,0.9)'); gr.addColorStop(0.35, 'rgba(255,170,90,0.35)'); gr.addColorStop(1, 'rgba(255,140,60,0)'); gg.fillStyle = gr; gg.fillRect(0, 0, 64, 64); }));
      const gp = []; post(gp, -12, -2.5, 4.4); post(gp, 12, -2.5, 4.4); post(gp, -12, -5.5, 3.8); post(gp, 12, -5.5, 3.8); post(gp, -12, 3.5, 5); post(gp, 12, 3.5, 5); g.add(new THREE.Mesh(merged(gp), vmat()));
      for (const [a, b, sag] of strings) {
        const n = 16, pts3 = []; for (let i = 0; i <= n; i++) { const u = i / n; pts3.push(V(lerp(a.x, b.x, u), lerp(a.y, b.y, u) - sag * 4 * u * (1 - u), lerp(a.z, b.z, u))); }
        g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts3), 24, 0.01, 4), basic(0x20150c)));
        for (let i = 1; i < n; i++) {
          const p = pts3[i]; lp.push({ geo: new THREE.SphereGeometry(0.17, 8, 6), matrix: place(p.x, p.y - 0.2, p.z, 0, 1, 1.25, 1), color: lcol[i % lcol.length] });
          const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, opacity: 0.8 })); sp.position.set(p.x, p.y - 0.2, p.z); sp.scale.set(1.5, 1.5, 1); g.add(sp); out.lanterns.push({ sp, ph: R() * 6 });
        }
      }
      const lm = new THREE.Mesh(merged(lp), new THREE.MeshBasicMaterial({ vertexColors: true })); g.add(lm);
      return { palette: ['#9a4d6a', '#4d7a9a', '#d9a05b', '#5f4d9a', '#9a6a4d', '#4d9a7a'], crowd: 150 };
    },
    grand(g, R) {
      const parts = [];
      // stands: stepped blocks on the far side and the two ends
      const stand = (x, z, w, d, ry, rows) => { for (let r = 0; r < rows; r++) parts.push({ geo: new THREE.BoxGeometry(w, 0.7, d - r * 0.9), matrix: place(x + Math.sin(ry) * r * 0.45 * -1, 0.35 + r * 0.7, z - Math.cos(ry) * r * 0.45 * 1 - r * 0.9 * 0.0, ry), color: r % 2 ? '#7d8597' : '#6c7486' }); };
      for (let r = 0; r < 5; r++) parts.push({ geo: new THREE.BoxGeometry(34, 0.7, 6 - r * 0.2), matrix: place(0, 0.35 + r * 0.7, -9 - r * 1.1), color: r % 2 ? '#8a8fa3' : '#7a7f94' });
      for (const sd of [-1, 1]) for (let r = 0; r < 4; r++) parts.push({ geo: new THREE.BoxGeometry(5 - r * 0.2, 0.7, 14), matrix: place(sd * (11 + r * 1.1), 0.35 + r * 0.7, 0), color: r % 2 ? '#8a8fa3' : '#7a7f94' });
      void stand;
      // roof and arch
      parts.push({ geo: new THREE.BoxGeometry(34, 0.3, 4), matrix: place(0, 6.2, -12.5), color: '#c9ccd8' });
      for (const x of [-16, -6, 6, 16]) parts.push({ geo: new THREE.CylinderGeometry(0.15, 0.15, 6, 6), matrix: place(x, 3, -11), color: '#555b6e' });
      for (let i = 0; i < 6; i++) parts.push({ geo: new THREE.CylinderGeometry(0.04, 0.05, 7 + (i % 2), 5), matrix: place(-17.5 + i * 7, 3.6, 6.5), color: '#d9d9e0' });
      g.add(new THREE.Mesh(merged(parts), vmat()));
      // banners hanging from the roof
      const bc = ['#c1272d', '#f2c14e', '#2a6fb0', '#2f9e5c', '#7a4bb5', '#e19a1d'];
      for (let i = 0; i < 6; i++) { const geo = new THREE.PlaneGeometry(1.4, 3.6, 1, 6); geo.translate(0, -1.8, 0); const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: bc[i], side: THREE.DoubleSide })); m.position.set(-12.5 + i * 5, 6, -10.4); g.add(m); out.banner.push({ m, base: geo.attributes.position.array.slice(), ph: i }); }
      for (let i = 0; i < 7; i++) { const geo = new THREE.PlaneGeometry(1.0, 2.2, 1, 4); geo.translate(0, -1.1, 0); const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: bc[(i + 2) % 6], side: THREE.DoubleSide })); m.position.set(-17.5 + i * 5.8, 7.4, 6.5); g.add(m); out.banner.push({ m, base: geo.attributes.position.array.slice(), ph: i + 3 }); }
      const pp = []; post(pp, -9, -3.4, 3.2); post(pp, 9, -3.4, 3.2); g.add(new THREE.Mesh(merged(pp), vmat()));
      bunting(g, V(-9, 3.1, -3.4), V(9, 3.1, -3.4), 1.0, ['#c1272d', '#f2c14e', '#2a6fb0', '#ffffff'], 22);
      return { palette: ['#c1272d', '#2a6fb0', '#f2c14e', '#ffffff', '#2f9e5c', '#7a4bb5'], crowd: 0, stands: true };
    },
  };

  out.setSetting = (id) => {
    if (out.setting === id) return;
    out.setting = id;
    const look = LOOKS[id] || LOOKS.harvest;
    clearScenery();
    paintSky(look, id); paintGround(look, id);
    const R = rnd(1000 + id.length * 17 + id.charCodeAt(0));
    const info = (BUILD[id] || BUILD.harvest)(scenery, R);
    // crowd standing behind the far fence and at the ends (the grand festival fills its stands)
    let spots;
    if (info.stands) {
      spots = [];
      for (let r = 0; r < 5; r++) for (let i = 0; i < 26; i++) spots.push({ x: -16 + i * 1.27 + (r % 2) * 0.5, y: 0.7 + r * 0.7, z: -8.4 - r * 1.1, rot: 0 });
      for (const sd of [-1, 1]) for (let r = 0; r < 4; r++) for (let i = 0; i < 9; i++) spots.push({ x: sd * (10.6 + r * 1.1), y: 0.7 + r * 0.7, z: -5.4 + i * 1.35, rot: -sd * Math.PI / 2 });
    } else spots = arcSpots(R, info.crowd, 6.2, 11, 11.5, 15);
    out.crowd = buildCrowd(scenery, spots, info.palette);
    stage.setLighting('day', { exposure: look.exp, hemi: look.hemi, keyI: look.keyI, key: look.key, sky: look.sky, fog: look.fog, hemiSky: look.sky, hemiGround: look.gnd });
    stage.setSky(look.fog, look.fog, { near: look.fogN, far: look.fogF });
    stage.scene.background = null;
    if (id === 'lantern') { stage.lights.rim.color.set('#6f7fd0'); stage.lights.rim.intensity = 0.9; } else { stage.lights.rim.color.set('#ffffff'); stage.lights.rim.intensity = 0.9; }
    stage.invalidate();
  };

  out.update = (dt, mood, t) => {
    out.t = t;
    if (out.crowd) out.crowd.update(dt, mood);
    for (const l of out.lanterns) l.sp.material.opacity = 0.68 + Math.sin(t * 3 + l.ph) * 0.14;
    for (const b of out.banner) { const a = b.m.geometry.attributes.position.array; for (let i = 0; i < a.length; i += 3) { const d = -b.base[i + 1] / 3.6; a[i + 2] = Math.sin(t * 2.2 + b.ph + d * 2.5) * 0.12 * d; } b.m.geometry.attributes.position.needsUpdate = true; }
    for (const f of out.flags) if (f.foam) f.foam.position.z = -17.5 + Math.sin(t * 0.8) * 0.9;
  };
  return out;
}

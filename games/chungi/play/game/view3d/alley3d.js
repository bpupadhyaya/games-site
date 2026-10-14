// Chungi: the real 3D alley behind the 2D HUD (game-owned). Drawn on its own WebGL canvas UNDER the kit canvas. The camera is a
// perspective pinhole whose z = 0 plane (the plane the kid, the ball and the 2D effects live in) maps exactly onto the 2D alley camera
// (px = cx + X s, py = floorY - Y s), so everything the 2D layer places still lands where it should, while the walls, floor and
// facade recede with real perspective, the cloths hang at different depths and the light is real. It only READS what the 2D art
// hands over (src/glhook.js bgFrame: camera, wall half-width, wind, time).
const TAU = Math.PI * 2;
const rng = (seed) => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };

export function createAlley3d({ THREE, canvas, quality = 'medium' }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: quality !== 'low', alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: false });
  renderer.setClearColor(0x2a1830, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xe39a76, 14, 62);
  const camera = new THREE.PerspectiveCamera(40, 1, 0.5, 120);
  camera.matrixAutoUpdate = true;
  const D = 9, EYE = 1.55;                   // eye distance to the z = 0 plane (metres) and eye height: the vanishing point sits at chest height
  camera.position.set(0, EYE, D);
  camera.updateProjectionMatrix = () => {};

  // ---------------------------------------------------------------- procedural textures
  const cvs = (w, h = w) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const tex = (c, rx = 1, ry = 1) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.anisotropy = 4; return t; };
  const brickTex = (seed, base, lines) => {
    const c = cvs(512), x = c.getContext('2d'), r = rng(seed);
    x.fillStyle = lines; x.fillRect(0, 0, 512, 512);
    const bh = 32, bw = 64;
    for (let row = 0; row < 16; row++) for (let col = -1; col < 9; col++) {
      const ox = (row & 1) ? bw / 2 : 0, v = (r() - 0.5) * 38;
      const [R, G, B] = base; x.fillStyle = `rgb(${R + v | 0},${G + v * 0.7 | 0},${B + v * 0.6 | 0})`;
      x.fillRect(col * bw + ox + 2, row * bh + 2, bw - 4, bh - 4);
      if (r() < 0.12) { x.fillStyle = 'rgba(0,0,0,0.18)'; x.fillRect(col * bw + ox + 2, row * bh + 2, bw - 4, bh - 4); }
    }
    const g = x.createLinearGradient(0, 0, 0, 512); g.addColorStop(0, 'rgba(255,255,255,0.06)'); g.addColorStop(1, 'rgba(0,0,0,0.12)'); x.fillStyle = g; x.fillRect(0, 0, 512, 512);
    return c;
  };
  const cobbleTex = () => {
    const c = cvs(512), x = c.getContext('2d'), r = rng(9);
    x.fillStyle = '#3b2230'; x.fillRect(0, 0, 512, 512);
    for (let row = 0; row < 16; row++) for (let col = 0; col < 8; col++) {
      const ox = (row & 1) ? 32 : 0, v = (r() - 0.5) * 40;
      x.fillStyle = `rgb(${150 + v | 0},${104 + v * 0.8 | 0},${86 + v * 0.7 | 0})`;
      x.beginPath(); x.roundRect(col * 64 + ox + 3, row * 32 + 3, 58, 26, 7); x.fill();
      x.fillStyle = 'rgba(255,230,200,0.14)'; x.fillRect(col * 64 + ox + 8, row * 32 + 6, 40, 4);
    }
    return c;
  };
  const plasterTex = () => {
    const c = cvs(512), x = c.getContext('2d'), r = rng(21);
    const g = x.createLinearGradient(0, 0, 0, 512); g.addColorStop(0, '#f0a27a'); g.addColorStop(0.55, '#d27158'); g.addColorStop(1, '#9a4244'); x.fillStyle = g; x.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 160; i++) { x.fillStyle = `rgba(${r() < 0.5 ? '255,235,205' : '60,20,20'},${0.04 + r() * 0.06})`; x.fillRect(r() * 512, r() * 512, 20 + r() * 90, 10 + r() * 50); }
    return c;
  };
  const skyTex = () => {
    const c = cvs(512, 512), x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, 512); g.addColorStop(0, '#3a1f5e'); g.addColorStop(0.42, '#9a4a7e'); g.addColorStop(0.7, '#f08f6a'); g.addColorStop(1, '#ffd08a'); x.fillStyle = g; x.fillRect(0, 0, 512, 512);
    const sg = x.createRadialGradient(150, 330, 6, 150, 330, 190); sg.addColorStop(0, 'rgba(255,238,180,0.9)'); sg.addColorStop(1, 'rgba(255,200,120,0)'); x.fillStyle = sg; x.fillRect(0, 0, 512, 512);
    const r = rng(5);
    for (const [col, base, amp] of [['#6a3a6a', 400, 70], ['#4a2850', 440, 55]]) {
      x.fillStyle = col; x.beginPath(); x.moveTo(0, 512);
      for (let i = 0; i <= 32; i++) { const u = i / 32; x.lineTo(u * 512, base - Math.abs(Math.sin(u * 7 + base)) * amp * (0.6 + r() * 0.6)); }
      x.lineTo(512, 512); x.fill();
    }
    return c;
  };
  const glowTex = (() => { const c = cvs(64), x = c.getContext('2d'); const g = x.createRadialGradient(32, 32, 1, 32, 32, 31); g.addColorStop(0, 'rgba(255,214,140,1)'); g.addColorStop(0.35, 'rgba(255,170,80,0.45)'); g.addColorStop(1, 'rgba(255,140,60,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();

  // ---------------------------------------------------------------- lights
  scene.add(new THREE.HemisphereLight(0xffe3cf, 0x6a4a5e, 1.15));
  const sun = new THREE.DirectionalLight(0xffd0a0, 2.4); sun.position.set(-4, 7, 6); scene.add(sun);
  const rim = new THREE.DirectionalLight(0xb9a4ff, 0.8); rim.position.set(5, 4, -8); scene.add(rim);

  // ---------------------------------------------------------------- the alley
  const std = (map, o = {}) => new THREE.MeshStandardMaterial({ map, roughness: 0.92, metalness: 0, ...o });
  const wallTexL = tex(brickTex(3, [160, 88, 84], '#3a2030'), 30, 6), wallTexR = tex(brickTex(8, [150, 84, 90], '#3a2030'), 30, 6);
  const WALL_H = 14, WALL_LEN = 64, WALL_Z = -29;
  const walls = [-1, 1].map((side) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(WALL_LEN, WALL_H), std(side < 0 ? wallTexL : wallTexR));
    m.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2; m.position.set(side * 3, WALL_H / 2, WALL_Z); scene.add(m);
    return m;
  });
  // a lit strip along the inner edge where the ball bounces
  const edges = [-1, 1].map((side) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.1, 62), new THREE.MeshBasicMaterial({ color: 0xffd6a0, transparent: true, opacity: 0.16, fog: false }));
    m.position.set(side * 3, 0.55, -31); scene.add(m); return m;
  });
  // windows, lanterns and drainpipes on the walls (positions fixed in z, x follows the wall)
  const winMat = new THREE.MeshBasicMaterial({ color: 0xffb35a }), winDark = new THREE.MeshBasicMaterial({ color: 0x24182e });
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x4a2a18, roughness: 0.8 });
  const wallProps = [];
  const r = rng(77);
  for (const side of [-1, 1]) for (let i = 0; i < 9; i++) {
    const z = -2 - i * 6 - (side < 0 ? 0 : 3), yy = 4.4 + (i % 2) * 1.6, lit = r() < 0.6;
    const g = new THREE.Group();
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.5, 1.0), woodMat); g.add(frame);
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 1.3), lit ? winMat : winDark); pane.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2; pane.position.x = -side * 0.07; g.add(pane);
    g.position.set(side * 3, yy, z); scene.add(g); wallProps.push({ g, side, kind: 'win' });
    if (lit) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.55, fog: false })); sp.scale.set(2.4, 2.4, 1); sp.position.set(-side * 0.5, 0, 0); g.add(sp); }
  }
  const pipeG = new THREE.CylinderGeometry(0.07, 0.07, WALL_H, 8), pipeM = new THREE.MeshStandardMaterial({ color: 0x3a2a30, roughness: 0.6, metalness: 0.4 });
  for (const side of [-1, 1]) for (const z of [-4.5, -17, -30]) { const p = new THREE.Mesh(pipeG, pipeM); p.position.set(side * 3, WALL_H / 2, z); scene.add(p); wallProps.push({ g: p, side, kind: 'pipe', inset: 0.1 }); }
  // hanging lanterns
  const lanternG = new THREE.SphereGeometry(0.18, 10, 8), lanternM = new THREE.MeshBasicMaterial({ color: 0xffc77a });
  for (const side of [-1, 1]) for (let i = 0; i < 4; i++) {
    const g = new THREE.Group(); g.add(new THREE.Mesh(lanternG, lanternM));
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.9, fog: false })); sp.scale.set(1.8, 1.8, 1); g.add(sp);
    g.position.set(side * 3, 3.0, -3 - i * 9 - (side < 0 ? 0 : 4)); scene.add(g); wallProps.push({ g, side, kind: 'lamp', inset: 0.35 });
  }

  // building masses outside the walls so the sides of a wide (landscape) screen never see past the alley into nothing
  const blockTex = tex(brickTex(14, [96, 56, 66], '#2a1626'), 14, 6);
  const blocks = [-1, 1].map((side) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(14, 16, 66), std(blockTex)); m.position.set(side * 10, 8, -31); scene.add(m);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(14.4, 0.5, 66.4), new THREE.MeshStandardMaterial({ color: 0x4a2418, roughness: 0.8 })); roof.position.set(0, 8.25, 0); m.add(roof);
    return m;
  });
  // floor
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 70), std(tex(cobbleTex(), 60 / 1.4, 70 / 1.4), { roughness: 0.85 }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, -30); scene.add(floor);
  // back facade, doorway, eaves
  const facadeW = 46, facade = new THREE.Mesh(new THREE.PlaneGeometry(facadeW, 14), std(tex(plasterTex(), 3, 1))); facade.position.set(0, 7, -36); scene.add(facade);
  const ownWin = (x, y) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.4), (Math.round(x * 3 + y) & 3) ? winMat : winDark); m.position.set(x, y, -35.95); scene.add(m); const f = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.6, 0.08), woodMat); f.position.set(x, y, -35.98); scene.add(f); };
  for (let i = -6; i <= 6; i++) { ownWin(i * 3.4 + 0.5, 4.2); ownWin(i * 3.4 + 0.5, 8.6); }
  const door = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 3.4), new THREE.MeshBasicMaterial({ color: 0x2a140f })); door.position.set(0, 1.7, -35.95); scene.add(door);
  const eaves = new THREE.Mesh(new THREE.BoxGeometry(facadeW, 0.7, 1.6), new THREE.MeshStandardMaterial({ color: 0x4a2418, roughness: 0.8 })); eaves.position.set(0, 13.3, -35.3); scene.add(eaves);
  // sky and distant peaks above the roof line
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(190, 120), new THREE.MeshBasicMaterial({ map: (() => { const t = new THREE.CanvasTexture(skyTex()); t.colorSpace = THREE.SRGBColorSpace; return t; })(), fog: false }));
  sky.position.set(0, 52, -80); scene.add(sky);
  // kites
  const kites = [0xffdd55, 0x5bf0d0].map((c, i) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.1), new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide, fog: false })); m.rotation.z = Math.PI / 4; scene.add(m); return { m, ph: i * 2.1 }; });

  // laundry lines and bunting between the walls at three depths
  const clothCols = [0xfff3c9, 0x4ad3c6, 0xff6a8b, 0xffd35a, 0x7aa8ff];
  const lines = [-6, -13, -21].map((z, li) => {
    const ly = 6.2 - li * 0.3;
    const line = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1, 6), new THREE.MeshBasicMaterial({ color: 0xf3e6d2 })); line.rotation.z = Math.PI / 2; scene.add(line);
    const cloths = [];
    for (let i = 0; i < 7; i++) {
      const pivot = new THREE.Group(), m = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.6 + (i % 3) * 0.14), new THREE.MeshStandardMaterial({ color: clothCols[(i + li) % 5], roughness: 0.9, side: THREE.DoubleSide }));
      m.position.y = -0.34; pivot.add(m); scene.add(pivot); cloths.push({ pivot, u: (i + 0.5) / 7 });
    }
    return { line, cloths, z, ly };
  });

  // contact shadow under the kid (the 2D canvas keeps its own ellipse; this one is lit onto the cobbles and shows up in perspective)
  const blob = (() => { const c = cvs(64), x = c.getContext('2d'); const g = x.createRadialGradient(32, 32, 2, 32, 32, 31); g.addColorStop(0, 'rgba(0,0,0,0.55)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.9), new THREE.MeshBasicMaterial({ map: blob, transparent: true, depthWrite: false, fog: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.01; scene.add(shadow);

  // ---------------------------------------------------------------- per frame
  let W = 0, H = 0;
  const api = { renderer, scene, ready: false };
  api.resize = (w, h, dpr) => { W = w; H = h; renderer.setPixelRatio(dpr); renderer.setSize(w, h, false); };
  api.render = (F, B) => {
    const { cx, floorY, s } = F.cam, Wv = B.W, Hv = B.H;      // virtual units of the 2D camera
    const f = s * D, pcx = cx, pcy = floorY - s * EYE, n = 0.5, fa = 120;
    const a = -(fa + n) / (fa - n), b = -2 * fa * n / (fa - n);
    camera.projectionMatrix.set(
      2 * f / Wv, 0, -(2 * pcx / Wv - 1), 0,
      0, 2 * f / Hv, -(1 - 2 * pcy / Hv), 0,
      0, 0, a, b,
      0, 0, -1, 0,
    );
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    camera.position.set(0, EYE, D); camera.quaternion.identity(); camera.updateMatrixWorld(true);
    const half = Math.max(1, B.half), t = B.t, sway = Math.max(-1, Math.min(1, (B.wx || 0) / 1.6));
    walls[0].position.x = -half - 0.02; walls[1].position.x = half + 0.02;
    edges[0].position.x = -half; edges[1].position.x = half;
    blocks[0].position.x = -half - 7.05; blocks[1].position.x = half + 7.05;
    for (const p of wallProps) {
      const inset = p.inset ?? 0.0;
      p.g.position.x = p.side * (half - inset);
      if (p.kind === 'lamp') { p.g.children[0].position.y = Math.sin(t * 1.3 + p.g.position.z) * 0.03; }
    }
    for (const L of lines) {
      L.line.scale.set(1, 2 * half, 1); L.line.position.set(0, L.ly - Math.sin(0.5 * Math.PI) * 0.0, L.z);
      L.cloths.forEach((c, i) => {
        const x = -half + c.u * 2 * half, sag = Math.sin(c.u * Math.PI) * 0.0;
        c.pivot.position.set(x, L.ly - sag, L.z);
        c.pivot.rotation.z = Math.sin(t * 2 + i + L.z) * 0.07 + sway * 0.28;
        c.pivot.rotation.y = Math.sin(t * 1.3 + i * 1.7) * 0.25;
      });
    }
    kites.forEach((k, i) => { k.m.position.set(-4 + i * 7 + Math.sin(t * 0.5 + k.ph) * 1.4, 22 + i * 3 + Math.sin(t * 0.7 + k.ph) * 0.8, -50); k.m.rotation.z = Math.PI / 4 + Math.sin(t + k.ph) * 0.25; });
    shadow.position.x = F.kid.x; shadow.scale.set(1, 1, 1);
    renderer.render(scene, camera);
  };
  api.dispose = () => { renderer.dispose(); };
  void TAU; void W; void H;
  return api;
}

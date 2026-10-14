// The lakeside lawn of Finnish Pin Toss as a lit 3D scene. Units are metres. World axes: x = across the lawn, y = up, z3 = -(sim y):
// the thrower stands at positive z3 and looks toward negative z3 (the lake). Skittles and the pin are real size (6 cm x 15 cm and
// 6 cm x 22 cm), turned from pine with the slanted, numbered top of the real game. Everything is procedural (canvas textures and
// analytic geometry), built once, and moved by the presenter.
import { SK_R, SK_H, PIN_R, PIN_HL, BOUNDS, LINE_Y } from '../src/sim.js';

export const Z3 = (y) => -y / 100;            // sim y (cm) -> three z (m)
export const M = (c) => c / 100;              // cm -> m
export const SK_HM = SK_H / 100, SK_RM = SK_R / 100, PIN_LEN = (2 * PIN_HL + 2 * PIN_R) / 100, PIN_RM = PIN_R / 100;
export const SLANT = 0.5;                     // tan of the slanted cut (about 27 degrees)
const TAU = Math.PI * 2;
function lcg(seed) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }

export function buildWorld(V3, stage, { quality = 'high', THREE = V3.THREE } = {}) {
  const doc = globalThis.document;
  const aniso = Math.min(8, stage.renderer.capabilities.getMaxAnisotropy());
  const W = { quality, anim: [], flowers: null };
  const root = new THREE.Group(); root.name = 'fpt-world';
  stage.scene.add(root);
  W.root = root;
  const tex = (w, h, draw, { repeat = null, srgb = true, rep = true } = {}) => {
    const c = doc.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'); draw(g, w, h);
    const t = new THREE.CanvasTexture(c);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = aniso;
    if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
    return t;
  };
  const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0, ...o });
  const lam = (o) => new THREE.MeshLambertMaterial(o);
  const shadowed = (m, cast = true, recv = true) => { m.castShadow = cast; m.receiveShadow = recv; return m; };
  const low = quality === 'low';

  // ---- grass: a tiled blade texture, mowing stripes in vertex colours --------------------------------------------------------------
  const grassTex = tex(512, 512, (g, w, h) => {
    const r = lcg(3);
    g.fillStyle = '#5f9a3a'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) {   // soft patches
      const x = r() * w, y = r() * h, rr = 30 + r() * 80, k = r();
      const gr = g.createRadialGradient(x, y, 0, x, y, rr);
      const col = k < 0.4 ? '84,138,48' : k < 0.75 ? '112,168,60' : '70,120,42';
      gr.addColorStop(0, `rgba(${col},0.35)`); gr.addColorStop(1, `rgba(${col},0)`);
      g.fillStyle = gr; g.fillRect(x - rr, y - rr, rr * 2, rr * 2);
    }
    g.lineCap = 'round';
    for (let i = 0; i < 5200; i++) {   // blades
      const x = r() * w, y = r() * h, l = 5 + r() * 9, a = -Math.PI / 2 + (r() - 0.5) * 0.9, k = r();
      g.strokeStyle = k < 0.33 ? 'rgba(36,86,26,0.55)' : k < 0.66 ? 'rgba(150,206,84,0.5)' : 'rgba(96,152,52,0.5)';
      g.lineWidth = 1 + r() * 1.3;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
  }, { repeat: [14, 14] });
  const LX0 = -9, LX1 = 9, LZ0 = -2.0, LZ1 = 8.5;              // lawn plane extents (x, z3)
  const lawnGeo = (() => {
    const nx = 40, nz = 2, P = [], N = [], U = [], C = [], I = [];
    for (let j = 0; j <= nz; j++) for (let i = 0; i <= nx; i++) {
      const x = LX0 + (LX1 - LX0) * i / nx, z = LZ0 + (LZ1 - LZ0) * j / nz;
      P.push(x, 0, z); N.push(0, 1, 0); U.push((x - LX0) / 1.3, (z - LZ0) / 1.3);
      const stripe = Math.floor((x + 40) / 0.46) & 1;
      const k = stripe ? 1.0 : 0.86, fall = Math.max(0.55, 1 - Math.max(0, Math.abs(x) - 4.5) * 0.06);
      C.push(k * fall, k * fall, k * fall);
    }
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const a = j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1; I.push(a, c, b, b, c, d); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); g.setIndex(I);
    return g;
  })();
  const lawn = shadowed(new THREE.Mesh(lawnGeo, std({ map: grassTex, vertexColors: true, roughness: 0.95 })), false, true);
  root.add(lawn);

  // ---- the play patch: worn turf round the bundle, the throw line, boot prints, clover and flowers (alpha decal) --------------------------
  const PX0 = -1.6, PX1 = 1.6, PZ0 = -2.0, PZ1 = 4.6, PPM = low ? 120 : 220;
  const patchTex = tex(Math.round((PX1 - PX0) * PPM), Math.round((PZ1 - PZ0) * PPM), (g, w, h) => {
    const r = lcg(17);
    const px = (x) => (x - PX0) * PPM, pz = (z) => (z - PZ0) * PPM;
    g.clearRect(0, 0, w, h);
    // worn earth under the bundle and a fainter trampled path along the throw line
    const worn = (x, z, rx, rz, a) => { const gr = g.createRadialGradient(px(x), pz(z), 0, px(x), pz(z), rx * PPM); gr.addColorStop(0, `rgba(122,98,54,${a})`); gr.addColorStop(1, 'rgba(122,98,54,0)'); g.save(); g.translate(px(x), pz(z)); g.scale(1, rz / rx); g.translate(-px(x), -pz(z)); g.fillStyle = gr; g.beginPath(); g.arc(px(x), pz(z), rx * PPM, 0, TAU); g.fill(); g.restore(); };
    worn(0, 0, 0.5, 0.36, 0.5); worn(0, 0, 0.9, 0.7, 0.18); worn(0, -LINE_Y / 100, 0.9, 0.2, 0.34);
    // dry blades in the worn area
    g.lineCap = 'round';
    for (let i = 0; i < 380; i++) {
      const a = r() * TAU, d = Math.sqrt(r()) * 0.7, x = Math.cos(a) * d, z = Math.sin(a) * d * 0.7;
      g.strokeStyle = `rgba(${150 + r() * 40},${130 + r() * 30},70,0.5)`; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(px(x), pz(z)); g.lineTo(px(x) + (r() - 0.5) * 6, pz(z) - 5 - r() * 6); g.stroke();
    }
    // boot prints behind the throw line
    const foot = (x, z, a, s, c) => {
      g.save(); g.translate(px(x), pz(z)); g.rotate(a); g.fillStyle = c;
      g.beginPath(); g.ellipse(0, 0, 0.055 * PPM * s, 0.14 * PPM * s, 0, 0, TAU); g.fill(); g.restore();
    };
    for (let i = 0; i < 12; i++) foot((r() - 0.5) * 1.1, 3.6 + r() * 0.7, (r() - 0.5) * 0.9, 1, 'rgba(70,60,28,0.28)');
    // the throw line: a white-painted plank laid on the grass is drawn as geometry; here only chalk dust beside it
    // clover and daisies
    for (let i = 0; i < 70; i++) {
      const x = PX0 + r() * (PX1 - PX0), z = PZ0 + r() * (PZ1 - PZ0);
      g.fillStyle = r() < 0.5 ? 'rgba(118,170,70,0.9)' : 'rgba(84,140,52,0.9)'; g.beginPath(); g.arc(px(x), pz(z), 3 + r() * 3, 0, TAU); g.fill();
    }
    // soft feathered edges so the decal melts into the lawn
    g.globalCompositeOperation = 'destination-in';
    const mask = g.createLinearGradient(0, 0, 0, h); mask.addColorStop(0, 'rgba(0,0,0,0.2)'); mask.addColorStop(0.2, 'rgba(0,0,0,1)'); mask.addColorStop(0.9, 'rgba(0,0,0,1)'); mask.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = mask; g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'source-over';
  });
  const patch = new THREE.Mesh(new THREE.PlaneGeometry(PX1 - PX0, PZ1 - PZ0), new THREE.MeshLambertMaterial({ map: patchTex, transparent: true, depthWrite: false }));
  patch.rotation.x = -Math.PI / 2; patch.position.set((PX0 + PX1) / 2, 0.002, (PZ0 + PZ1) / 2); patch.receiveShadow = true; patch.renderOrder = 1;
  root.add(patch);

  // ---- the shore, the lake, sun glitter ---------------------------------------------------------------------------------------------------
  const SHORE_Z = -1.95;
  const bankTex = tex(256, 128, (g, w, h) => {
    const r = lcg(5); g.fillStyle = '#6b5a38'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(${60 + r() * 60},${50 + r() * 40},30,0.5)`; g.fillRect(r() * w, r() * h, 2 + r() * 5, 1 + r() * 2); }
  }, { repeat: [12, 1] });
  const bank = new THREE.Mesh(new THREE.BoxGeometry(LX1 - LX0, 0.22, 0.9), std({ map: bankTex, roughness: 1 }));
  bank.position.set(0, -0.09, SHORE_Z - 0.35); bank.rotation.x = 0.1; bank.receiveShadow = true; root.add(bank);
  const lakeTex = tex(8, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);   // top = far, bottom = near the shore
    gr.addColorStop(0, '#f6dcae'); gr.addColorStop(0.2, '#efcfa2'); gr.addColorStop(0.5, '#a9c0c8'); gr.addColorStop(0.8, '#7fa8b8'); gr.addColorStop(1, '#6a99ac');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
  const lakeGeo = new THREE.PlaneGeometry(260, 130); lakeGeo.rotateX(-Math.PI / 2);
  const lake = new THREE.Mesh(lakeGeo, new THREE.MeshBasicMaterial({ map: lakeTex, fog: false }));
  lake.position.set(0, -0.06, SHORE_Z - 65 - 0.8); root.add(lake);
  // glitter: additive streaks on the water along the sun path, twinkling
  const glitTex = tex(64, 16, (g, w, h) => { const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); gr.addColorStop(0, 'rgba(255,248,214,1)'); gr.addColorStop(0.4, 'rgba(255,228,160,0.5)'); gr.addColorStop(1, 'rgba(255,220,140,0)'); g.setTransform(1, 0, 0, 0.3, 0, h * 0.35); g.fillStyle = gr; g.fillRect(0, 0, w, h * 3); });
  W.glints = [];
  { const r = lcg(31), n = low ? 40 : 110;
    for (let i = 0; i < n; i++) {
      const d = 3.2 + Math.pow(r(), 1.6) * 60, spread = 0.6 + d * 0.12;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.5 + d * 0.06, (0.5 + d * 0.06) * 0.22), new THREE.MeshBasicMaterial({ map: glitTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, opacity: 0 }));
      m.rotation.x = -Math.PI / 2; m.position.set(-1.5 + (r() - 0.5) * 2 * spread, -0.04, SHORE_Z - 0.9 - d);
      m.userData = { ph: r() * 9, sp: 0.6 + r() * 1.2, base: 0.25 + r() * 0.45 };
      root.add(m); W.glints.push(m);
    }
  }
  // stones, reeds, a small jetty and a rowboat
  { const r = lcg(8), g = new THREE.SphereGeometry(1, 8, 6), n = 26;
    const mesh = new THREE.InstancedMesh(g, std({ color: 0x9c978a, roughness: 0.95 }), n);
    const mx = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
    for (let i = 0; i < n; i++) {
      const sc = 0.07 + r() * 0.15; p.set(-4.5 + i * 0.36 + r() * 0.2, 0.0, SHORE_Z - 0.05 - r() * 0.5); s.set(sc * 1.5, sc * 0.7, sc); q.setFromEuler(new THREE.Euler(0, r() * 3, 0));
      mx.compose(p, q, s); mesh.setMatrixAt(i, mx);
    }
    mesh.castShadow = true; mesh.receiveShadow = true; root.add(mesh);
    // reed clumps: thin leaning cones
    const reedGeo = new THREE.CylinderGeometry(0.0, 0.012, 1, 4, 1); reedGeo.translate(0, 0.5, 0);
    const nr = low ? 90 : 200, reeds = new THREE.InstancedMesh(reedGeo, new THREE.MeshLambertMaterial({ color: 0x7c8f3a }), nr);
    for (let i = 0; i < nr; i++) {
      const cl = Math.floor(i / 18), cx = -6.5 + (cl * 7.3) % 13, cz = SHORE_Z - 0.35 - ((cl * 3) % 5) * 0.14;
      p.set(cx + (r() - 0.5) * 0.6, -0.04, cz - r() * 0.3); const h = 0.3 + r() * 0.45; s.set(1, h, 1);
      q.setFromEuler(new THREE.Euler((r() - 0.5) * 0.5, 0, (r() - 0.5) * 0.5)); mx.compose(p, q, s); reeds.setMatrixAt(i, mx);
    }
    root.add(reeds);
  }
  const plankTex = tex(256, 64, (g, w, h) => {
    const r = lcg(3); g.fillStyle = '#8c6a44'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) { g.strokeStyle = `rgba(${r() < 0.5 ? '50,34,18' : '176,134,88'},${0.2 + r() * 0.25})`; g.lineWidth = 1 + r() * 2; g.beginPath(); const y = r() * h; g.moveTo(0, y); g.bezierCurveTo(w * 0.3, y + (r() - 0.5) * 8, w * 0.6, y + (r() - 0.5) * 8, w, y + (r() - 0.5) * 6); g.stroke(); }
    g.fillStyle = 'rgba(20,12,4,0.55)'; g.fillRect(0, h - 2, w, 2);
  }, { repeat: [2, 1] });
  const plankM = std({ map: plankTex, roughness: 0.82 });
  { // jetty to the right of the lawn
    const g = new THREE.Group();
    for (let i = 0; i < 14; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.05, 0.19), plankM); b.position.set(0, 0.12, -i * 0.21); b.castShadow = true; b.receiveShadow = true; g.add(b); }
    for (const sx of [-0.6, 0.6]) for (const k of [0, 5, 10]) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 1.0, 8), plankM); p.position.set(sx, -0.1, -k * 0.21); p.castShadow = true; g.add(p); }
    g.position.set(3.9, 0, SHORE_Z - 0.35); g.rotation.y = -0.1; root.add(g);
    // rowboat moored beside the jetty: hull = a stretched, flattened half sphere with a darker inside and a bench
    const boat = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 10, 0, TAU, Math.PI / 2, Math.PI / 2), std({ color: 0x2f5f86, roughness: 0.55 }));
    hull.scale.set(0.55, 0.38, 1.7); hull.position.y = 0.2; hull.castShadow = true;
    const inner = new THREE.Mesh(new THREE.SphereGeometry(0.98, 20, 10, 0, TAU, Math.PI / 2, Math.PI / 2), std({ color: 0xc8a272, roughness: 0.8, side: THREE.BackSide }));
    inner.scale.set(0.55, 0.38, 1.7); inner.position.y = 0.2;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(1, 0.025, 6, 40), std({ color: 0xf2ead8, roughness: 0.6 })); rim.rotation.x = Math.PI / 2; rim.scale.set(0.55, 1.7, 1); rim.position.y = 0.2;
    const bench = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.04, 0.2), plankM); bench.position.set(0, 0.15, 0.2);
    boat.add(hull, inner, rim, bench); boat.position.set(4.9, -0.03, SHORE_Z - 1.6); boat.rotation.y = 0.25; root.add(boat); W.boat = boat;
  }

  // ---- birches ------------------------------------------------------------------------------------------------------------------------------
  const barkTex = tex(128, 512, (g, w, h) => {
    const r = lcg(41); g.fillStyle = '#ebe5d8'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '160,150,132' : '255,252,244'},${0.1 + r() * 0.2})`; g.fillRect(r() * w, r() * h, 6 + r() * 30, 3 + r() * 10); }
    for (let i = 0; i < 70; i++) { // black lenticels and scars
      const x = r() * w, y = r() * h, ww = 8 + r() * 26, hh = 2 + r() * 5;
      g.fillStyle = `rgba(30,26,22,${0.55 + r() * 0.4})`; g.beginPath(); g.ellipse(x, y, ww / 2, hh / 2, 0, 0, TAU); g.fill();
      g.fillStyle = 'rgba(30,26,22,0.18)'; g.beginPath(); g.ellipse(x, y + hh, ww * 0.7, hh * 1.2, 0, 0, TAU); g.fill();
    }
    g.fillStyle = 'rgba(60,50,40,0.4)'; g.fillRect(w * 0.82, 0, w * 0.18, h);   // shaded side
  });
  const barkM = std({ map: barkTex, roughness: 0.78 });
  const leafTex = tex(256, 256, (g, w, h) => {
    const r = lcg(77); g.clearRect(0, 0, w, h);
    const pal = ['#8fbf3c', '#74a82e', '#a6cf4c', '#5f9524', '#b9d95e'];
    for (let i = 0; i < 520; i++) {
      const a = r() * TAU, d = Math.sqrt(r()) * 0.46, x = w / 2 + Math.cos(a) * d * w, y = h / 2 + Math.sin(a) * d * h * 0.9;
      g.save(); g.translate(x, y); g.rotate(r() * TAU); g.fillStyle = pal[(r() * pal.length) | 0];
      g.beginPath(); g.ellipse(0, 0, 9 + r() * 6, 5 + r() * 3, 0, 0, TAU); g.fill();
      g.fillStyle = 'rgba(30,60,10,0.25)'; g.fillRect(-1, -0.5, 8, 1); g.restore();
    }
  });
  const leafM = new THREE.MeshLambertMaterial({ map: leafTex, alphaTest: 0.45, side: THREE.DoubleSide, color: 0xffffff });
  W.sway = [];
  const birch = (x, z, h, lean, seed) => {
    const r = lcg(seed), g = new THREE.Group();
    const geo = new THREE.CylinderGeometry(0.045, 0.11, h, 10, 12, false); geo.translate(0, h / 2, 0);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) { const y = pos.getY(i) / h; pos.setX(i, pos.getX(i) + Math.sin(y * 3.2 + seed) * 0.12 * y + lean * y * y); }
    geo.computeVertexNormals();
    const trunk = new THREE.Mesh(geo, barkM); trunk.castShadow = true; trunk.receiveShadow = true; g.add(trunk);
    // foliage: crossed quads merged into one mesh
    const P = [], U = [], I = [];
    const quad = (cx, cy, cz, s, ry, tilt) => {
      const c = Math.cos(ry), sn = Math.sin(ry), base = P.length / 3;
      for (const [u, v] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
        const lx = u * s, lz = 0, ly = v * s * 0.8;
        const y2 = ly * Math.cos(tilt) - lz * Math.sin(tilt), z2 = ly * Math.sin(tilt) + lz * Math.cos(tilt);
        P.push(cx + lx * c + z2 * sn, cy + y2, cz - lx * sn + z2 * c); U.push((u + 1) / 2, (v + 1) / 2);
      }
      I.push(base, base + 1, base + 2, base, base + 2, base + 3);
    };
    const n = low ? 9 : 16;
    for (let i = 0; i < n; i++) {
      const u = 0.42 + (i / n) * 0.58, a = r() * TAU, rad = (1 - u) * 1.1 + 0.25 + r() * 0.25;
      const y = u * h, tx = Math.sin(u * 3.2 + seed) * 0.12 * u + lean * u * u;
      const cx = tx + Math.cos(a) * rad, cz = Math.sin(a) * rad, s = 0.8 + r() * 0.6;
      for (let k = 0; k < 3; k++) quad(cx, y + (r() - 0.3) * 0.4, cz, s, a + k * Math.PI / 3 + r() * 0.3, (r() - 0.5) * 0.6);
      // a thin branch from the trunk to the cluster
      if (i % 2 === 0) {
        const br = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.016, rad * 1.1, 5), barkM);
        br.position.set(tx + Math.cos(a) * rad * 0.5, y - 0.1, Math.sin(a) * rad * 0.5); br.rotation.z = Math.PI / 2 - Math.cos(a) * 0.5; br.rotation.x = Math.sin(a) * 0.9; g.add(br);
      }
    }
    const fg = new THREE.BufferGeometry();
    fg.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); fg.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); fg.setIndex(I); fg.computeVertexNormals();
    const fol = new THREE.Mesh(fg, leafM); fol.castShadow = !low; g.add(fol);
    g.position.set(x, 0, z); g.rotation.y = r() * TAU; root.add(g);
    W.sway.push({ g: fol, ph: seed * 1.7, amp: 0.012 + r() * 0.012 });
    return g;
  };
  [[-2.1, -3.8, 8.0, 0.5], [-0.3, -5.2, 9.6, -0.2], [1.7, -4.4, 8.6, 0.3], [3.0, -3.2, 7.4, -0.4], [-3.4, -1.0, 7.6, 0.4], [3.9, 0.4, 7.0, -0.3],
    [-5.4, -4.2, 9.8, 0.2], [5.4, -5.0, 10.2, -0.1], [-2.8, -7.6, 11.8, 0.3], [1.2, -8.4, 12.4, -0.2], [6.4, -1.6, 8.4, 0.2], [-6.2, 0.9, 8.8, 0.1]]
    .forEach(([x, z, h, l], i) => birch(x, z, h, l, 10 + i * 7));

  // ---- the sauna cabin: log walls, a dark gabled roof, a glowing window, a stack of firewood, smoke ----------------------------------------
  const logTex = tex(256, 128, (g, w, h) => {
    const r = lcg(21);
    for (let y = 0; y < h; y += 16) { g.fillStyle = `hsl(${24 + r() * 8},${48 + r() * 10}%,${26 + r() * 10}%)`; g.fillRect(0, y, w, 15); g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillRect(0, y + 15, w, 1); g.fillStyle = 'rgba(255,205,150,0.22)'; g.fillRect(0, y + 1, w, 2);
      for (let i = 0; i < 5; i++) { g.fillStyle = 'rgba(20,10,4,0.25)'; g.fillRect(r() * w, y + 4 + r() * 8, 12 + r() * 30, 1); } }
  }, { repeat: [2, 1.2] });
  const logM = std({ map: logTex, roughness: 0.9 });
  const roofM = std({ color: 0x3a2a22, roughness: 0.95 });
  const glowM = new THREE.MeshBasicMaterial({ color: 0xffc35a });
  const sauna = new THREE.Group();
  { const body = new THREE.Mesh(new THREE.BoxGeometry(3.3, 2.0, 2.5), logM); body.position.y = 1.0; body.castShadow = true; body.receiveShadow = true; sauna.add(body);
    for (const sd of [-1, 1]) { const rf = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.1, 1.75), roofM); rf.position.set(0, 2.38, sd * 0.78); rf.rotation.x = -sd * 0.52; rf.castShadow = true; sauna.add(rf); }
    const gable = new THREE.Mesh(new THREE.CylinderGeometry(0, 1.5, 0.85, 4), logM); gable.rotation.y = Math.PI / 4; gable.scale.set(1.2, 1, 0.9); gable.position.y = 2.4; sauna.add(gable);
    const ch = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.1, 0.4), std({ color: 0x5a3a30, roughness: 1 })); ch.position.set(1.0, 2.9, -0.3); ch.castShadow = true; sauna.add(ch);
    const front = 1.26;
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.55, 0.06), std({ color: 0x6a3a22, roughness: 0.8 })); door.position.set(-0.7, 0.78, front); sauna.add(door);
    const wr = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.035, 8, 20), std({ color: 0x5e9a3c, roughness: 0.9 })); wr.position.set(-0.7, 1.15, front + 0.05); sauna.add(wr);   // midsummer wreath
    const win = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.52, 0.05), glowM); win.position.set(0.7, 1.18, front + 0.02); sauna.add(win);
    const wf = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.68, 0.04), std({ color: 0xf6efdc, roughness: 0.6 })); wf.position.set(0.7, 1.18, front); sauna.add(wf);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.04, 0.06), std({ color: 0xf6efdc })); bar.position.set(0.7, 1.18, front + 0.05); sauna.add(bar);
    const bar2 = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.52, 0.06), std({ color: 0xf6efdc })); bar2.position.set(0.7, 1.18, front + 0.05); sauna.add(bar2);
    // steps and a bench
    const step = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.12, 0.5), plankM); step.position.set(-0.7, 0.06, front + 0.3); step.receiveShadow = true; sauna.add(step);
    const bench = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.05, 0.34), plankM); bench.position.set(1.1, 0.42, front + 0.4); sauna.add(bench);
    for (const bx of [0.6, 1.6]) { const lg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.4, 0.3), plankM); lg.position.set(bx, 0.2, front + 0.4); sauna.add(lg); }
    // firewood stack
    const logG = new THREE.CylinderGeometry(0.07, 0.07, 0.8, 8), endM = std({ color: 0xe2bd86, roughness: 0.8 });
    const rr = lcg(9);
    for (let row = 0; row < 4; row++) for (let i = 0; i < 7 - row; i++) {
      const l = new THREE.Mesh(logG, [std({ color: 0xa8763f, roughness: 0.9 }), endM, endM]);
      l.rotation.x = Math.PI / 2; l.position.set(-2.1 + i * 0.16 + row * 0.08, 0.08 + row * 0.14, 0.2 + (rr() - 0.5) * 0.03); l.castShadow = true; sauna.add(l);
    }
  }
  sauna.position.set(-3.7, 0, -3.1); sauna.rotation.y = 0.32; root.add(sauna);
  // smoke from the chimney
  const puffTex = tex(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,0.8)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.3)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });
  W.puffTex = puffTex;
  W.smokes = [];
  { const cx = -3.7 + 1.0 * Math.cos(0.32) + 0.3 * Math.sin(0.32), cz = -3.1 - 0.3 * Math.cos(0.32) - 1.0 * Math.sin(0.32);
    for (let i = 0; i < 8; i++) {
      const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex, color: 0xe6e1da, transparent: true, depthWrite: false, opacity: 0, fog: false }));
      m.userData = { x: cx, y: 3.5, z: cz, ph: i / 8 }; root.add(m); W.smokes.push(m);
    } }

  // ---- picnic blanket, basket, thermos, cups --------------------------------------------------------------------------------------------------
  { const g = new THREE.Group();
    const cloth = tex(128, 128, (c, w, h) => { c.fillStyle = '#f6efdc'; c.fillRect(0, 0, w, h); c.fillStyle = 'rgba(46,94,170,0.65)'; for (let i = 0; i < 4; i++) { c.fillRect(i * 32 + 8, 0, 16, h); c.fillRect(0, i * 32 + 8, w, 16); } });
    const bl = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.012, 1.2), std({ map: cloth, roughness: 1 })); bl.position.y = 0.007; bl.receiveShadow = true; g.add(bl);
    const basket = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.17, 0.2, 14), std({ color: 0xb8864a, roughness: 0.95 })); basket.position.set(-0.3, 0.11, 0.1); basket.castShadow = true; g.add(basket);
    const lid = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.012, 6, 22, Math.PI), std({ color: 0x7a5530 })); lid.position.set(-0.3, 0.2, 0.1); g.add(lid);
    const therm = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.28, 12), std({ color: 0xc8362f, roughness: 0.4, metalness: 0.2 })); therm.position.set(0.15, 0.15, -0.1); therm.castShadow = true; g.add(therm);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.048, 0.07, 12), std({ color: 0xe8e8e8, roughness: 0.3, metalness: 0.6 })); cap.position.set(0.15, 0.31, -0.1); g.add(cap);
    for (const [cx, cz] of [[0.4, 0.15], [0.52, -0.05]]) { const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.028, 0.06, 12), std({ color: 0xfbf6ea, roughness: 0.3 })); cup.position.set(cx, 0.04, cz); cup.castShadow = true; g.add(cup); }
    g.position.set(2.7, 0, 1.4); g.rotation.y = -0.3; root.add(g);
  }

  // ---- the rope field: stakes and a cord round the rectangle the skittles are stood up in ---------------------------------------------------
  { const B = BOUNDS, pts = [[B.x0, B.y0], [B.x0, B.y1], [B.x1, B.y1], [B.x1, B.y0]];
    const stakeM = std({ color: 0xcfa06a, roughness: 0.85 }), cordM = std({ color: 0xf5eddb, roughness: 0.9 });
    const stakes = [];
    for (let i = 0; i < 3; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], len = Math.hypot(x1 - x0, y1 - y0), n = Math.round(len / 50);
      for (let k = 0; k <= n; k++) stakes.push([x0 + (x1 - x0) * k / n, y0 + (y1 - y0) * k / n]);
    }
    for (const [x, y] of stakes) {
      const s = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.018, 0.2, 6), stakeM); s.position.set(M(x), 0.1, Z3(y)); s.castShadow = true; root.add(s);
    }
    const curve = new THREE.CatmullRomCurve3(pts.map(([x, y]) => new THREE.Vector3(M(x), 0.17, Z3(y))));
    // sagging cord: tubes between successive stakes
    for (let i = 0; i < stakes.length - 1; i++) {
      const [ax, ay] = stakes[i], [bx, by] = stakes[i + 1];
      if (Math.hypot(ax - bx, ay - by) > 80) continue;
      const a = new THREE.Vector3(M(ax), 0.19, Z3(ay)), b = new THREE.Vector3(M(bx), 0.19, Z3(by)), mid = a.clone().lerp(b, 0.5); mid.y -= 0.03;
      const t = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([a, mid, b]), 6, 0.006, 4), cordM); root.add(t);
    }
    void curve;
  }
  // the throw line: a white-painted board laid in the grass, 3.5 m from the bundle
  { const b = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.016, 0.07), std({ color: 0xf7f3e8, roughness: 0.7 })); b.position.set(0, 0.008, Z3(LINE_Y)); b.receiveShadow = true; root.add(b); }

  // ---- wildflowers (midsummer): small crossed quads scattered at the edges --------------------------------------------------------------------
  { const ft = tex(64, 64, (g, w, h) => { g.clearRect(0, 0, w, h); const gr = ['#fff8e6', '#f4d35e', '#9ac0f0', '#e68aa6']; for (let i = 0; i < 4; i++) { const cx = 16 + (i % 2) * 32, cy = 16 + (i >> 1) * 32; g.fillStyle = gr[i]; for (let k = 0; k < 6; k++) { g.beginPath(); g.ellipse(cx + Math.cos(k) * 6, cy + Math.sin(k) * 6, 5, 3, k, 0, TAU); g.fill(); } g.fillStyle = '#f2b81c'; g.beginPath(); g.arc(cx, cy, 3, 0, TAU); g.fill(); } });
    const r = lcg(61), n = low ? 80 : 240, mx = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
    for (let v = 0; v < 4; v++) {
      const geo = new THREE.PlaneGeometry(0.1, 0.1); geo.translate(0, 0.12, 0);
      const uv = geo.attributes.uv, ox = (v % 2) * 0.5, oy = (v >> 1) * 0.5;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, ox + uv.getX(i) * 0.5, oy + uv.getY(i) * 0.5);
      const mesh = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ map: ft, alphaTest: 0.5, side: THREE.DoubleSide }), n);
      for (let i = 0; i < n; i++) {
        let x, z; do { x = LX0 * 0.9 + r() * (LX1 - LX0) * 0.9; z = SHORE_Z + 0.1 + r() * 9; } while (Math.abs(x) < 1.5 && z < 4.2 && z > -1.9);
        p.set(x, 0, z); s.setScalar(0.7 + r() * 0.8); q.setFromEuler(new THREE.Euler(0, r() * 3, 0)); mx.compose(p, q, s); mesh.setMatrixAt(i, mx);
      }
      root.add(mesh);
    }
  }

  // ---- motes drifting in the golden light (pollen, midges) ---------------------------------------------------------------------------------------
  { const n = low ? 24 : 70, g = new THREE.BufferGeometry(), P = new Float32Array(n * 3), r = lcg(91);
    for (let i = 0; i < n; i++) { P[i * 3] = (r() - 0.5) * 6; P[i * 3 + 1] = 0.3 + r() * 2.6; P[i * 3 + 2] = -3 + r() * 9; }
    g.setAttribute('position', new THREE.BufferAttribute(P, 3));
    const pts = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xfff1c4, size: 0.035, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    pts.frustumCulled = false; root.add(pts); W.motes = { pts, base: P.slice() };
  }

  // ---- skittles and the pin -------------------------------------------------------------------------------------------------------------------
  // Geometry: a turned cylinder whose top is cut at an angle (the number sits on the cut, facing +z = the thrower). Origin at the
  // geometric centre, long axis +y, the cut face toward +z.
  const woodSide = tex(128, 256, (g, w, h) => {
    const r = lcg(13);
    g.fillStyle = '#e9c98c'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) { const x = r() * w; g.strokeStyle = `rgba(${r() < 0.5 ? '150,100,52' : '255,236,190'},${0.12 + r() * 0.22})`; g.lineWidth = 0.8 + r() * 2.2; g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + (r() - 0.5) * 10, h * 0.3, x + (r() - 0.5) * 14, h * 0.7, x + (r() - 0.5) * 8, h); g.stroke(); }
    const sh = g.createLinearGradient(0, 0, w, 0); sh.addColorStop(0, 'rgba(255,255,255,0.18)'); sh.addColorStop(0.5, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(60,30,6,0.28)');
    g.fillStyle = sh; g.fillRect(0, 0, w, h);
  });
  const numTex = [];
  const numberTex = (n) => {
    if (numTex[n]) return numTex[n];
    numTex[n] = tex(128, 128, (g, w, h) => {
      const r = lcg(n + 7);
      g.fillStyle = '#efd6a0'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 26; i++) { g.strokeStyle = `rgba(${r() < 0.5 ? '170,118,60' : '255,240,200'},${0.15 + r() * 0.25})`; g.lineWidth = 0.8 + r() * 2; g.beginPath(); const y = r() * h; g.moveTo(0, y); g.bezierCurveTo(w * 0.3, y + (r() - 0.5) * 10, w * 0.7, y + (r() - 0.5) * 10, w, y + (r() - 0.5) * 6); g.stroke(); }
      if (n > 0) {
        g.save(); g.translate(w / 2, h / 2); g.scale(1, 1.0);
        g.font = `900 ${n > 9 ? 62 : 78}px Fredoka, 'Avenir Next', 'Arial Black', sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillStyle = 'rgba(70,40,10,0.35)'; g.fillText(String(n), 1.5, 3);
        g.fillStyle = '#1b130c'; g.fillText(String(n), 0, 1);
        g.restore();
      }
      // a red painted ring near the rim, like the lacquered edge of a real set
      g.strokeStyle = n > 0 ? 'rgba(190,40,30,0.0)' : 'rgba(190,40,30,0.9)'; g.lineWidth = 10; g.beginPath(); g.arc(w / 2, h / 2, w * 0.42, 0, TAU); g.stroke();
    });
    return numTex[n];
  };
  // Builds { side, top } geometries for a cylinder of radius R and long-side length L (centre at origin).
  const cutCylinder = (R, L, seg = 22) => {
    const P = [], N = [], U = [], I = [];
    const yTop = (zl) => L / 2 - SLANT * (zl + R);   // highest at -z (the back), lowest at +z (toward the thrower)
    // side wall: bottom ring (y = -L/2) and top rim (y = yTop)
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * TAU, c = Math.cos(a), s = Math.sin(a), zl = s * R;
      P.push(c * R, -L / 2, s * R); N.push(c, 0, s); U.push(i / seg, 0);
      P.push(c * R, yTop(zl), s * R); N.push(c, 0, s); U.push(i / seg, 1);
    }
    for (let i = 0; i < seg; i++) { const a = i * 2; I.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const side = new THREE.BufferGeometry();
    side.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); side.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); side.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2)); side.setIndex(I);
    // the cut face: a fan with uv = the disc mapped to 0..1 (v up toward -z so the numeral reads upright from the thrower)
    const P2 = [], N2 = [], U2 = [], I2 = [];
    const nn = new THREE.Vector3(0, 1, SLANT).normalize();
    const rim = R * 0.93;
    P2.push(0, yTop(0), 0); N2.push(nn.x, nn.y, nn.z); U2.push(0.5, 0.5);
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * TAU, c = Math.cos(a), s = Math.sin(a);
      P2.push(c * R, yTop(s * R), s * R); N2.push(nn.x, nn.y, nn.z); U2.push(0.5 + (c * R) / (2 * rim), 0.5 + (s * R) / (2 * rim) * -1 + 0.0);
    }
    for (let i = 1; i <= seg; i++) I2.push(0, i + 1, i);
    const top = new THREE.BufferGeometry();
    top.setAttribute('position', new THREE.Float32BufferAttribute(P2, 3)); top.setAttribute('normal', new THREE.Float32BufferAttribute(N2, 3)); top.setAttribute('uv', new THREE.Float32BufferAttribute(U2, 2)); top.setIndex(I2);
    return { side, top };
  };
  const skG = cutCylinder(SK_RM, SK_HM), pinG = cutCylinder(PIN_RM, PIN_LEN);
  const sideM = std({ map: woodSide, roughness: 0.62 });
  const topMats = [];
  const topMat = (n) => topMats[n] || (topMats[n] = std({ map: numberTex(n), roughness: 0.55 }));
  const bandTex = tex(128, 256, (g, w, h) => {
    const r = lcg(13);
    g.fillStyle = '#e2bf80'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) { const x = r() * w; g.strokeStyle = `rgba(${r() < 0.5 ? '140,92,46' : '255,232,180'},${0.12 + r() * 0.22})`; g.lineWidth = 0.8 + r() * 2.2; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + (r() - 0.5) * 10, h); g.stroke(); }
    g.fillStyle = '#c42d22'; g.fillRect(0, h * 0.16, w, h * 0.09); g.fillRect(0, h * 0.74, w, h * 0.09);
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, h * 0.25, w, 2); g.fillRect(0, h * 0.74 - 2, w, 2);
    const sh = g.createLinearGradient(0, 0, w, 0); sh.addColorStop(0, 'rgba(255,255,255,0.18)'); sh.addColorStop(0.5, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(60,30,6,0.28)');
    g.fillStyle = sh; g.fillRect(0, 0, w, h);
  });
  const pinSideM = std({ map: bandTex, roughness: 0.58 });
  const woodShadow = (m) => { m.castShadow = true; m.receiveShadow = true; return m; };
  W.makeSkittle = (num) => {
    const g = new THREE.Group();
    const s = woodShadow(new THREE.Mesh(skG.side, sideM)), t = woodShadow(new THREE.Mesh(skG.top, topMat(num)));
    g.add(s, t);
    return g;
  };
  W.makePin = () => {
    const g = new THREE.Group();
    g.add(woodShadow(new THREE.Mesh(pinG.side, pinSideM)), woodShadow(new THREE.Mesh(pinG.top, topMat(0))));
    return g;
  };

  // ---- ambient animation: birch sway, glitter, smoke, motes -----------------------------------------------------------------------------------
  W.update = (dt, t) => {
    for (const s of W.sway) s.g.rotation.z = Math.sin(t * 0.7 + s.ph) * s.amp + Math.sin(t * 1.9 + s.ph * 2) * s.amp * 0.4;
    for (const m of W.glints) { const u = m.userData; m.material.opacity = Math.max(0, Math.sin(t * u.sp + u.ph)) * u.base * 0.9; }
    for (const m of W.smokes) {
      const u = m.userData, k = (t * 0.1 + u.ph) % 1;
      m.position.set(u.x + k * 1.3 + Math.sin(t * 0.5 + u.ph * 9) * 0.12 * k, u.y + k * 2.4, u.z); m.scale.setScalar(0.3 + k * 1.3);
      m.material.opacity = Math.sin(Math.PI * k) * 0.42;
    }
    if (W.motes) {
      const p = W.motes.pts.geometry.attributes.position, b = W.motes.base;
      for (let i = 0; i < p.count; i++) p.setXYZ(i, b[i * 3] + Math.sin(t * 0.3 + i) * 0.35, b[i * 3 + 1] + Math.sin(t * 0.43 + i * 1.7) * 0.25, b[i * 3 + 2] + Math.cos(t * 0.27 + i * 0.6) * 0.35);
      p.needsUpdate = true;
    }
    if (W.boat) W.boat.rotation.z = Math.sin(t * 0.9) * 0.018;
  };

  // ---- the scenery kit behind it all: a peach midsummer sky, the far shore, a band of birches, drifting clouds ---------------------------------
  W.scenery = null;
  try {
    W.scenery = V3.buildScenery({
      culture: 'north-european', timeOfDay: 'dusk', quality: low ? 'low' : quality === 'medium' ? 'low' : 'medium', wind: 0.5, clouds: 0.5, seed: 9, radius: 140,
      layers: [
        { t: 'sky', id: 'sky-peach' },
        { t: 'backdrop', id: 'bd-nordic-village', mix: ['bd-forest'] },
        { t: 'band', id: 'band-birch', r: 95, h: 22, arc: [-175, -5] },
        { t: 'cutouts', id: 'tr-round-tree', count: 6, r: [60, 80], arc: [-165, -15], scale: [10, 16], seed: 4, sway: 0.5 },
      ],
    });
    W.scenery.group.position.y = -0.04;
    stage.scene.add(W.scenery.group);
    W.scenery.ready.catch((e) => console.warn('scenery failed', e));
  } catch (e) { console.warn('scenery unavailable', e); }
  W.dispose = () => {};
  return W;
}

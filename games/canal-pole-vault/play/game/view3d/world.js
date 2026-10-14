// The polder world: flat green country, a straight canal with a sand bed on the far bank, reeds, windmills, farmhouses, poplars, cows and a small crowd.
// Coordinates: z runs along the jump (the board is z = 0, the canal is z in 0..W, the sand bed starts at z = W), +Y is up, X is across the jump
// (the jumper's left is +X). Everything is generated from fixed seeds with small canvas textures: no image files.
// buildWorld(...).setVenue(venue) rebuilds the per-canal parts.

const rnd = (seed) => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

function texCanvas(doc, w, h, draw) { const c = doc.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); return c; }

export function buildWorld(V3, stage) {
  const { THREE } = V3;
  const doc = globalThis.document;
  const root = new THREE.Group(); root.name = 'polder';
  const venueGroup = new THREE.Group(); venueGroup.name = 'venue';
  root.add(venueGroup);
  const std = (c, r = 0.85, m = 0, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m, ...o });
  const lam = (c, o = {}) => new THREE.MeshLambertMaterial({ color: c, ...o });
  const out = { root, venueGroup, venueId: '', mills: [], reeds: [], crowd: null, flagMarker: null, windsock: null, water: null, board: null };
  stage.add(root);
  const R = rnd(20261012);

  // ---- sky: gradient, soft warm horizon, clouds
  const skyTex = new THREE.CanvasTexture(texCanvas(doc, 4, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#2a6fc0'); gr.addColorStop(0.4, '#5fa4e0'); gr.addColorStop(0.7, '#a9d2ee'); gr.addColorStop(0.9, '#eaf1ee'); gr.addColorStop(1, '#f5efdc');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  }));
  skyTex.colorSpace = THREE.SRGBColorSpace;
  stage.scene.background = skyTex;
  stage.scene.fog = new THREE.Fog(0xdbe8ef, 120, 900);
  const cloudTex = new THREE.CanvasTexture(texCanvas(doc, 256, 96, (g, w, h) => {
    for (let i = 0; i < 16; i++) { const x = w * (0.15 + 0.7 * R()), y = h * (0.4 + 0.25 * R()), r = h * (0.22 + 0.3 * R()); const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,0.85)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }
  }));
  cloudTex.colorSpace = THREE.SRGBColorSpace;
  out.clouds = [];
  for (let i = 0; i < 14; i++) {
    const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, transparent: true, depthWrite: false, fog: false, opacity: 0.85 }));
    const a = R() * Math.PI * 2, d = 600 + R() * 500;
    m.position.set(Math.cos(a) * d, 130 + R() * 120, Math.sin(a) * d); m.scale.set(300 + R() * 260, 100 + R() * 70, 1); root.add(m); out.clouds.push({ m, a, d, s: 0.002 + R() * 0.004 });
  }

  // ---- the polder: a huge flat meadow with mown stripes and drainage ditches
  const grassTex = new THREE.CanvasTexture(texCanvas(doc, 256, 256, (g, w, h) => {
    g.fillStyle = '#6fae52'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? 'rgba(40,110,40,0.22)' : 'rgba(170,220,110,0.18)'; g.fillRect((i * w) / 8, 0, w / 8 + 1, h); }
    const img = g.getImageData(0, 0, w, h); let s = 11;
    for (let i = 0; i < img.data.length; i += 4) { s = (s * 1664525 + 1013904223) >>> 0; const n = ((s >>> 24) - 128) * 0.1; img.data[i] += n; img.data[i + 1] += n * 1.2; img.data[i + 2] += n * 0.6; }
    g.putImageData(img, 0, 0);
  }));
  grassTex.colorSpace = THREE.SRGBColorSpace; grassTex.wrapS = grassTex.wrapT = THREE.RepeatWrapping; grassTex.repeat.set(160, 160); grassTex.anisotropy = 4;
  const groundMat = std(0xffffff, 0.95, 0, { map: grassTex });

  // water: the canal itself (a long strip along X), rebuilt per venue; the base level of the polder ditches is the same colour
  const waterTex = new THREE.CanvasTexture(texCanvas(doc, 256, 256, (g, w, h) => {
    g.fillStyle = '#2c7fa6'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) { g.strokeStyle = `rgba(${200 + (i % 3) * 20},240,255,${0.05 + (i % 5) * 0.03})`; g.lineWidth = 1 + (i % 3); const x = (i * 53) % w, y = (i * 97) % h; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 14, y - 3, x + 30, y); g.stroke(); }
  }));
  waterTex.colorSpace = THREE.SRGBColorSpace; waterTex.wrapS = waterTex.wrapT = THREE.RepeatWrapping;
  out.waterTex = waterTex;

  const label = (txt, color = '#12202e', bg = '#f4f1e4') => {
    const t = new THREE.CanvasTexture(texCanvas(doc, 128, 64, (g, w, h) => { g.fillStyle = bg; g.fillRect(0, 0, w, h); g.fillStyle = color; g.font = '900 44px Georgia, serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, w / 2, h / 2 + 3); g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 4; g.strokeRect(0, 0, w, h); }));
    t.colorSpace = THREE.SRGBColorSpace; return t;
  };

  function disposeGroup(g) {
    g.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; for (const m of ms) { if (m.map && m.map !== waterTex) m.map.dispose(); m.dispose(); } } });
    while (g.children.length) g.remove(g.children[0]);
  }

  // ---- things that do not depend on the canal: windmills, farmhouses, poplars, cows (placed relative to the canal when it is built)
  function windmill(x, z, s, yaw) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(1.7 * s, 2.7 * s, 9 * s, 8), std(0xf0e6d2, 0.85)); body.position.y = 4.5 * s; body.castShadow = true;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(3.0 * s, 3.2 * s, 1.4 * s, 8), std(0x6b4a34, 0.9)); base.position.y = 0.7 * s;
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.1 * s, 2.0 * s, 2.6 * s, 8), std(0x5a3a2a, 0.9)); cap.position.y = 10.2 * s;
    g.add(body, base, cap);
    const hub = new THREE.Group(); hub.position.set(0, 9.2 * s, 2.1 * s);
    const sailM = std(0xf3efe2, 0.8), frameM = std(0x4a3828, 0.9);
    for (let k = 0; k < 4; k++) {
      const arm = new THREE.Group(); arm.rotation.z = k * Math.PI / 2;
      const spar = new THREE.Mesh(new THREE.BoxGeometry(0.22 * s, 9.4 * s, 0.22 * s), frameM); spar.position.y = 4.7 * s;
      const sail = new THREE.Mesh(new THREE.BoxGeometry(1.7 * s, 6.4 * s, 0.06 * s), sailM); sail.position.set(0.95 * s, 5.4 * s, 0.1 * s);
      arm.add(spar, sail); hub.add(arm);
    }
    g.add(hub);
    g.position.set(x, 0.4, z); g.rotation.y = yaw || 0;
    out.mills.push(hub);
    return g;
  }
  function farmhouse(x, z, w, d, hgt, yaw) {
    const g = new THREE.Group();
    const walls = new THREE.Mesh(new THREE.BoxGeometry(w, hgt, d), lam(0xb6553a)); walls.position.y = hgt / 2;
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.78 * w, hgt * 0.75, 4, 1), lam(0x3a3f4a)); roof.position.y = hgt + hgt * 0.34; roof.rotation.y = Math.PI / 4; roof.scale.set(1, 1, d / w * 1.06);
    g.add(walls, roof); g.position.set(x, 0.45, z); g.rotation.y = yaw || 0; return g;
  }

  out.setVenue = (V) => {
    if (out.venueId === V.id) return;
    out.venueId = V.id;
    disposeGroup(venueGroup); out.mills = []; out.reeds = [];
    const Rv = rnd(500 + Math.round(V.W * 10));
    const W = V.W, SL = V.sandLen || 11;

    // the polder on both sides of the canal (the water level is y = 0, the meadow 0.45 above it) and the dark bed under the water
    {
      const gn = new THREE.Mesh(new THREE.PlaneGeometry(3000, 1500), groundMat); gn.rotation.x = -Math.PI / 2; gn.position.set(0, 0.45, -750); gn.receiveShadow = true; venueGroup.add(gn);
      const gf = new THREE.Mesh(new THREE.PlaneGeometry(3000, 1500), groundMat); gf.rotation.x = -Math.PI / 2; gf.position.set(0, 0.45, W + SL + 750); gf.receiveShadow = true; venueGroup.add(gf);
      for (const sx of [-1, 1]) { const gs = new THREE.Mesh(new THREE.PlaneGeometry(1500, SL), groundMat); gs.rotation.x = -Math.PI / 2; gs.position.set(sx * (6 + 750), 0.45, W + SL / 2); gs.receiveShadow = true; venueGroup.add(gs); }
      const bed = new THREE.Mesh(new THREE.PlaneGeometry(3000, W + 1), std(0x1d4b63, 1)); bed.rotation.x = -Math.PI / 2; bed.position.set(0, -2.2, W / 2); venueGroup.add(bed);
    }
    // the canal: water strip with banks
    const water = new THREE.Mesh(new THREE.PlaneGeometry(900, W), std(0xffffff, 0.25, 0.05, { map: waterTex }));
    water.rotation.x = -Math.PI / 2; water.position.set(0, 0.0, W / 2);
    waterTex.repeat.set(900 / 12, W / 12);
    water.receiveShadow = true; venueGroup.add(water); out.water = water;
    // the canal bed shows at the edges as dark water; banks: raised grass strips along the water edge
    const bankM = std(0x5f9a45, 0.95);
    const nb = new THREE.Mesh(new THREE.BoxGeometry(900, 0.45, 12), bankM); nb.position.set(0, 0.22, -6.0); nb.receiveShadow = true; venueGroup.add(nb);
    // the run-up: a timber runway on the near bank with lane lines, ending in the board
    const runway = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.12, 30), std(0xa87a4a, 0.8)); runway.position.set(0, 0.5, -15.0); runway.receiveShadow = true; venueGroup.add(runway);
    const planksTex = new THREE.CanvasTexture(texCanvas(doc, 64, 256, (g, w, h) => { g.fillStyle = '#b9854f'; g.fillRect(0, 0, w, h); for (let i = 0; i < 16; i++) { g.fillStyle = i % 2 ? 'rgba(80,50,20,0.25)' : 'rgba(255,230,180,0.14)'; g.fillRect(0, i * 16, w, 15); g.fillStyle = 'rgba(40,24,10,0.45)'; g.fillRect(0, i * 16 + 15, w, 1); } }));
    planksTex.colorSpace = THREE.SRGBColorSpace; planksTex.wrapS = planksTex.wrapT = THREE.RepeatWrapping; planksTex.repeat.set(1, 8);
    runway.material = std(0xffffff, 0.8, 0, { map: planksTex });
    const beat = (zz) => { const m = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.02, 0.07), new THREE.MeshBasicMaterial({ color: 0xf4f1e4 })); m.position.set(0, 0.57, zz); return m; };
    for (let zz = -24; zz < 0; zz += 4) venueGroup.add(beat(zz));
    const boardM = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.2, 0.55), std(0xf7f3e6, 0.5)); boardM.position.set(0, 0.55, -0.1); boardM.castShadow = true; venueGroup.add(boardM);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.02, 0.1), new THREE.MeshBasicMaterial({ color: 0xd9402e })); stripe.position.set(0, 0.66, -0.25); venueGroup.add(stripe);
    out.board = boardM;
    // the start mark 24 m back
    const start = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.03, 0.18), new THREE.MeshBasicMaterial({ color: 0x4aa0e0 })); start.position.set(0, 0.57, -24.0); venueGroup.add(start);

    // the sand bed on the far bank, rising gently out of the water; distance marks beside it
    const sandTex = new THREE.CanvasTexture(texCanvas(doc, 128, 128, (g, w, h) => {
      g.fillStyle = '#e2cf9a'; g.fillRect(0, 0, w, h);
      const img = g.getImageData(0, 0, w, h); let s = 5;
      for (let i = 0; i < img.data.length; i += 4) { s = (s * 1664525 + 1013904223) >>> 0; const n = ((s >>> 24) - 128) * 0.22; img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n * 0.7; }
      g.putImageData(img, 0, 0);
    }));
    sandTex.colorSpace = THREE.SRGBColorSpace; sandTex.wrapS = sandTex.wrapT = THREE.RepeatWrapping; sandTex.repeat.set(8, 6);
    const sg = new THREE.PlaneGeometry(12, SL, 1, 10); sg.rotateX(-Math.PI / 2);
    const sp = sg.attributes.position;
    for (let i = 0; i < sp.count; i++) { const zz = sp.getZ(i) + SL / 2; sp.setY(i, Math.min(0.62, 0.15 + zz * 0.5)); }
    sg.computeVertexNormals();
    const sand = new THREE.Mesh(sg, std(0xffffff, 0.95, 0, { map: sandTex })); sand.position.set(0, 0, W + SL / 2); sand.receiveShadow = true; venueGroup.add(sand);
    // water-to-sand slope: a short wedge so the edge is not a hole
    const wedge = new THREE.Mesh(new THREE.BoxGeometry(12, 0.3, 0.6), std(0xcdb987, 0.95)); wedge.position.set(0, 0.07, W - 0.1); venueGroup.add(wedge);
    // distance boards (measured from the board) every 2 m on the sand, at the right edge
    for (let d = Math.ceil((W + 1) / 2) * 2; d <= W + SL - 1; d += 2) {
      const lab = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.5), new THREE.MeshBasicMaterial({ map: label(String(d), '#12202e', d < W + 2 ? '#ffd36a' : '#f4f1e4'), side: THREE.DoubleSide }));
      lab.position.set(6.6, 0.6 + Math.min(0.5, (d - W) * 0.3), d); lab.rotation.y = -Math.PI / 2;
      venueGroup.add(lab);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.6, 5), std(0x333b44)); post.position.set(6.6, 0.3, d); venueGroup.add(post);
      const tape = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.01, 0.06), new THREE.MeshBasicMaterial({ color: 0x1b2a3a })); tape.position.set(-6, Math.min(0.62, 0.15 + (d - W) * 0.5) + 0.02, d); venueGroup.add(tape);
    }
    // far-bank grass beyond the sand and a low dike with poplars
    const far = new THREE.Mesh(new THREE.BoxGeometry(900, 0.5, 40), bankM); far.position.set(0, 0.22, W + SL + 20); venueGroup.add(far);

    // reeds along both edges (instanced thin blades), swaying in the wind
    {
      const NR = 520;
      const g = new THREE.PlaneGeometry(0.12, 2.0, 1, 3); g.translate(0, 1.0, 0);
      const mat = new THREE.MeshLambertMaterial({ color: 0x7e9a4a, side: THREE.DoubleSide });
      const im = new THREE.InstancedMesh(g, mat, NR);
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), ps = new THREE.Vector3(), c = new THREE.Color();
      const base = [];
      for (let i = 0; i < NR; i++) {
        const side = Rv() < 0.5 ? 0 : 1;
        const x = (Rv() - 0.5) * 120;
        if (Math.abs(x) < 4.5 && side === 0) continue;                    // keep the runway end clear
        const z = side === 0 ? -0.35 - Rv() * 0.7 : W + 0.15 + Rv() * 0.8 - (Math.abs(x) < 7 ? 3 : 0);
        if (side === 1 && Math.abs(x) < 7) continue;                      // the sand bed stays clear
        const y = 0.45;
        const s = 0.7 + Rv() * 1.0;
        base.push({ x, y, z: side === 0 ? z : W - 0.1 + Rv() * 0.5, s, ph: Rv() * 6.28, yaw: Rv() * 3.14 });
        c.setRGB(0.42 + Rv() * 0.12, 0.55 + Rv() * 0.12, 0.24 + Rv() * 0.1); im.setColorAt(base.length - 1, c);
      }
      im.count = base.length;
      out.reeds = { im, base, m4, q, e, sc, ps };
      im.frustumCulled = false; venueGroup.add(im);
      out.stepReeds = (t, wind) => {
        const o = out.reeds; if (!o.base) return;
        for (let i = 0; i < o.base.length; i++) {
          const b = o.base[i];
          const sway = Math.sin(t * 1.6 + b.ph) * (0.05 + 0.04 * Math.abs(wind ? wind.cross : 0));
          o.e.set(sway, b.yaw, sway * 0.5); o.q.setFromEuler(o.e); o.m4.compose(o.ps.set(b.x, b.y, b.z), o.q, o.sc.set(1, b.s, 1));
          o.im.setMatrixAt(i, o.m4);
        }
        o.im.instanceMatrix.needsUpdate = true;
      };
      out.stepReeds(0, null);
    }

    // windmills on the far polder, one with its sails turning; farmhouses and poplar rows
    venueGroup.add(windmill(-26, W + SL + 18, 1.5, 0.3), windmill(48, W + SL + 70, 1.9, -0.2), windmill(-90, W + SL + 120, 1.7, 0.1));
    venueGroup.add(windmill(70, -80, 1.6, 0.5));
    for (const [x, z, w, d, h, yaw] of [[24, W + SL + 30, 12, 8, 4.2, 0.1], [-48, W + SL + 44, 14, 8, 4.6, -0.15], [90, W + SL + 60, 12, 9, 4.4, 0.2], [-70, -50, 12, 8, 4.0, 0.1], [60, -40, 13, 8, 4.4, -0.2], [-30, W + SL + 100, 10, 7, 3.8, 0.05]]) venueGroup.add(farmhouse(x, z, w, d, h, yaw));
    {
      const NT = 260;
      const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.1, 0.15, 3.2, 5), lam(0x5b4630), NT);
      const crown = new THREE.InstancedMesh(new THREE.SphereGeometry(1.0, 8, 6), lam(0xffffff), NT);
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3(), c = new THREE.Color();
      let used = 0;
      const place = (x, z, s) => {
        if (used >= NT) return;
        m4.compose(ps.set(x, 0.45 + 1.6 * s, z), q.identity(), sc.set(s, s, s)); trunk.setMatrixAt(used, m4);
        m4.compose(ps.set(x, 0.45 + 6.4 * s, z), q.identity(), sc.set(1.5 * s, 5.0 * s, 1.5 * s)); crown.setMatrixAt(used, m4);
        c.setRGB(0.16 + Rv() * 0.1, 0.34 + Rv() * 0.14, 0.14 + Rv() * 0.08); crown.setColorAt(used, c);
        used++;
      };
      // rows of poplars along two far ditches and a lane
      for (let i = 0; i < 40; i++) place(-170 + i * 8.5 + Rv() * 2, W + SL + 50 + Rv() * 3, 0.9 + Rv() * 0.5);
      for (let i = 0; i < 36; i++) place(-150 + i * 9 + Rv() * 2, -70 - Rv() * 3, 0.9 + Rv() * 0.5);
      for (let i = 0; i < 24; i++) place(110 + Rv() * 3, -80 + i * 11, 0.9 + Rv() * 0.5);
      for (let i = 0; i < 24; i++) place(-110 - Rv() * 3, -80 + i * 11 + 4, 0.9 + Rv() * 0.5);
      trunk.count = used; crown.count = used; trunk.frustumCulled = false; crown.frustumCulled = false; venueGroup.add(trunk, crown);
      const crownBase = [];
      for (let i = 0; i < used; i++) { crown.getMatrixAt(i, m4); crownBase.push(m4.clone()); }
      const sq = new THREE.Quaternion(), se = new THREE.Euler(), tp = new THREE.Vector3(), ts = new THREE.Vector3(), tq = new THREE.Quaternion();
      let swayT = 0;
      out.stepTrees = (t, wind) => {
        if (t - swayT < 0.05) return; swayT = t;   // 20 Hz is plenty for a slow sway
        const gust = 0.018 + 0.02 * Math.min(1, Math.hypot(wind ? wind.head : 0.4, wind ? wind.cross : 0.3) / 2);
        for (let i = 0; i < used; i++) {
          crownBase[i].decompose(tp, tq, ts);
          const a = Math.sin(t * 0.9 + i * 1.7) * gust, b2 = Math.cos(t * 0.7 + i * 0.9) * gust * 0.6;
          se.set(a, 0, b2); sq.setFromEuler(se);
          // sway about the foot of the crown: shift the top sideways with the lean
          const lean = ts.y * 0.9;
          m4.compose(tp.clone().add(new THREE.Vector3(Math.sin(b2) * lean * 0.5, 0, Math.sin(a) * lean * 0.5)), sq, ts);
          crown.setMatrixAt(i, m4);
        }
        crown.instanceMatrix.needsUpdate = true;
      };
    }
    // cows in the meadows: rounded bodies, heads, horns-free muzzles and four legs each (instanced), patched black and white
    {
      const NC = 16;
      const bodyG = new THREE.CapsuleGeometry(0.42, 0.9, 4, 10); bodyG.rotateX(Math.PI / 2); bodyG.translate(0, 1.0, 0);
      const headG = new THREE.SphereGeometry(0.24, 10, 8); headG.scale(0.9, 0.95, 1.25); headG.translate(0, 1.2, 0.95);
      const legG = new THREE.CylinderGeometry(0.07, 0.055, 0.7, 6); legG.translate(0, 0.35, 0);
      const body = new THREE.InstancedMesh(bodyG, lam(0xffffff), NC), head = new THREE.InstancedMesh(headG, lam(0xe9e2d4), NC);
      const legs = new THREE.InstancedMesh(legG, lam(0x3a3430), NC * 4);
      const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), ps = new THREE.Vector3(), c = new THREE.Color(), lp = new THREE.Vector3();
      for (let i = 0; i < NC; i++) {
        const x = (Rv() - 0.5) * 120 + (Rv() < 0.5 ? 20 : -20), z = W + SL + 6 + Rv() * 40, yaw = Rv() * 6.28, s = 0.9 + Rv() * 0.25;
        e.set(0, yaw, 0); q.setFromEuler(e);
        m4.compose(ps.set(x, 0.45, z), q, sc.set(s, s, s)); body.setMatrixAt(i, m4); head.setMatrixAt(i, m4);
        let k = 0;
        for (const [lx, lz] of [[0.22, 0.55], [-0.22, 0.55], [0.22, -0.55], [-0.22, -0.55]]) { lp.set(lx * s, 0, lz * s).applyQuaternion(q); m4.compose(ps.set(x + lp.x, 0.45, z + lp.z), q, sc.set(s, s, s)); legs.setMatrixAt(i * 4 + k++, m4); }
        c.set(Rv() < 0.55 ? 0x1f1f1f : Rv() < 0.6 ? 0xf2efe6 : 0x8b5a3a); body.setColorAt(i, c);
      }
      for (const m of [body, head, legs]) { m.frustumCulled = false; venueGroup.add(m); }
    }
    // a footbridge over a side ditch, a boat, a sock on a pole: small human details
    {
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 6, 6), std(0xcfd8e0)); mast.position.set(-8, 3.4, W + 3); venueGroup.add(mast);
      const sockG = new THREE.CylinderGeometry(0.28, 0.12, 1.6, 10, 1, true);
      sockG.translate(0, -0.8, 0); sockG.rotateZ(Math.PI / 2);
      const sock = new THREE.Mesh(sockG, new THREE.MeshBasicMaterial({ color: 0xff7a2f, side: THREE.DoubleSide }));
      sock.position.set(-8, 6.2, W + 3); venueGroup.add(sock); out.windsock = sock;
      // a pavilion with the judge's table on the near side of the sand
      const hut = new THREE.Mesh(new THREE.BoxGeometry(4.6, 2.6, 3.0), std(0xe9edf0, 0.7)); hut.position.set(11, 1.75, W + 3); hut.castShadow = true; venueGroup.add(hut);
      const roofH = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.25, 3.6), std(0x35516e)); roofH.position.set(11, 3.18, W + 3); venueGroup.add(roofH);
      const win = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.0, 2.2), new THREE.MeshBasicMaterial({ color: 0x4a7ea6 })); win.position.set(8.66, 1.9, W + 3); venueGroup.add(win);
    }
    // spectators are real 3D people (view3d athletes at LOD), added by the presenter; no stick or box figures anywhere
    out.crowd = null;
    // the forecast flag: a plain orange pennant on a short pole that stands where the jump would touch down
    {
      const g = new THREE.Group();
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.6, 6), std(0xf4f1e4)); pole.position.y = 0.8; g.add(pole);
      const pen = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.4), new THREE.MeshBasicMaterial({ color: 0xff8a2a, side: THREE.DoubleSide })); pen.position.set(0.36, 1.35, 0); g.add(pen);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.05, 6, 24), new THREE.MeshBasicMaterial({ color: 0xffc857 })); ring.rotation.x = Math.PI / 2; ring.position.y = 0.05; g.add(ring);
      g.visible = false; venueGroup.add(g); out.flagMarker = g;
    }
  };

  out.step = (t, dt, wind) => {
    for (const hub of out.mills) hub.rotation.z += dt * 0.22;
    if (out.waterTex) { out.waterTex.offset.x = (t * 0.004) % 1; out.waterTex.offset.y = (t * 0.01) % 1; }
    for (const c of out.clouds) { c.a += c.s * dt * 0.05; c.m.position.x = Math.cos(c.a) * c.d; c.m.position.z = Math.sin(c.a) * c.d; }
    if (out.windsock && wind) { out.windsock.rotation.y = Math.atan2(wind.cross, -wind.head) + Math.PI / 2; out.windsock.rotation.z = -0.15 - 0.3 * clamp(Math.hypot(wind.head, wind.cross) / 2, 0, 1); }
    if (out.stepReeds) out.stepReeds(t, wind);
    if (out.stepTrees) out.stepTrees(t, wind);
  };
  return out;
}

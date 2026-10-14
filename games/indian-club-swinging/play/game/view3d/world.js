// The akhara courtyard: a raked sand pit with a brick curb, a flagstone yard, a plastered arcade at dusk with hanging lamps, a club stand and a
// water pot, light shafts, floating dust and sand puffs. World metres: +X right, +Y up, +Z toward the camera, the athlete stands at the origin.
// Everything is generated from small canvases and primitives (no image files). The presenter only calls update(t, dt) and puff(x, z).
const rnd = (seed) => { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; };

export function buildWorld(V3, stage, buildClip) {
  const { THREE } = V3;
  const doc = globalThis.document;
  const root = new THREE.Group(); root.name = 'akhara';
  const R = rnd(20261013);
  const cv = (w, h, draw) => { const c = doc.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); return c; };
  const tex = (c, rep, srgb = true) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); } t.anisotropy = 4; return t; };
  const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0, ...o });
  const out = { root, flames: [], lights: [], motes: null, puffs: [], beams: [] };
  stage.scene.add(root);

  // ---- sky behind the arches (also the scene background above the wall)
  const skyC = cv(8, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#08222c'); gr.addColorStop(0.35, '#14485a'); gr.addColorStop(0.62, '#4f7f78'); gr.addColorStop(0.82, '#e0a064'); gr.addColorStop(1, '#f3c27c');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
  const skyTex = tex(skyC);
  stage.scene.background = skyTex;
  stage.scene.fog = new THREE.Fog(0x2b2018, 9, 30);

  // ---- distant view through the arches: tree line and rooftops in silhouette on the sky
  const farC = cv(1024, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#12404f'); gr.addColorStop(0.5, '#5a8a78'); gr.addColorStop(0.8, '#f0b070'); gr.addColorStop(1, '#f6c98a');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    const sun = g.createRadialGradient(w * 0.62, h * 0.78, 4, w * 0.62, h * 0.78, h * 0.7); sun.addColorStop(0, 'rgba(255,230,160,0.9)'); sun.addColorStop(1, 'rgba(255,200,120,0)');
    g.fillStyle = sun; g.fillRect(0, 0, w, h);
    g.fillStyle = '#233a30';
    for (let x = -20; x < w + 20; x += 18 + R() * 20) { const r = 22 + R() * 30, y = h * 0.84 - R() * 14; g.beginPath(); g.arc(x, y, r, 0, 6.3); g.fill(); }
    g.fillStyle = '#16251f'; g.fillRect(0, h * 0.86, w, h * 0.14);
    g.fillStyle = '#2b2a2c';                                               // rooftops
    for (let i = 0; i < 6; i++) { const x = 40 + i * 170 + R() * 60, bw = 60 + R() * 50, bh = 30 + R() * 40; g.fillRect(x, h * 0.86 - bh, bw, bh); g.beginPath(); g.moveTo(x - 6, h * 0.86 - bh); g.lineTo(x + bw / 2, h * 0.86 - bh - 22); g.lineTo(x + bw + 6, h * 0.86 - bh); g.fill(); }
  });
  const farT = tex(farC);
  const far = new THREE.Mesh(new THREE.PlaneGeometry(40, 10), new THREE.MeshBasicMaterial({ map: farT, fog: false }));
  far.position.set(0, 4.3, -11); root.add(far);

  // ---- floor: flagstones
  const floorC = cv(512, 512, (g, w, h) => {
    g.fillStyle = '#3a2a1e'; g.fillRect(0, 0, w, h);
    const n = 4, sz = w / n;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const v = 80 + R() * 40; g.fillStyle = `rgb(${v + 28},${v + 4},${v - 22})`;
      g.fillRect(i * sz + 3, j * sz + 3, sz - 6, sz - 6);
      for (let k = 0; k < 40; k++) { g.fillStyle = `rgba(${R() > 0.5 ? '255,230,190' : '30,16,8'},${0.04 + R() * 0.07})`; g.fillRect(i * sz + R() * sz, j * sz + R() * sz, 2 + R() * 14, 2 + R() * 8); }
    }
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(36, 36), std({ map: tex(floorC, [18, 18]), roughness: 0.92 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; root.add(floor);

  // ---- the pit: raked sand with concentric rake lines, a brick curb around it
  const PIT_R = 1.5;
  const sandC = cv(1024, 1024, (g, w, h) => {
    g.fillStyle = '#d6a96c'; g.fillRect(0, 0, w, h);
    const cx = w / 2, cy = h / 2;
    for (let r = 6; r < w * 0.5; r += 7) {
      g.strokeStyle = (r / 7) % 2 ? 'rgba(120,76,32,0.22)' : 'rgba(255,236,190,0.22)'; g.lineWidth = 3;
      g.beginPath(); g.arc(cx, cy, r + (R() - 0.5) * 1.5, 0, 6.3); g.stroke();
    }
    for (let i = 0; i < 5000; i++) { g.fillStyle = `rgba(${R() > 0.5 ? '255,240,200' : '90,54,22'},${0.05 + R() * 0.12})`; g.fillRect(R() * w, R() * h, 1 + R() * 2, 1 + R() * 2); }
    const vg = g.createRadialGradient(cx, cy, w * 0.18, cx, cy, w * 0.5); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(60,30,10,0.35)');
    g.fillStyle = vg; g.fillRect(0, 0, w, h);
  });
  const sand = new THREE.Mesh(new THREE.CircleGeometry(PIT_R, 64), std({ map: tex(sandC), roughness: 1 }));
  sand.rotation.x = -Math.PI / 2; sand.position.y = 0.012; sand.receiveShadow = true; root.add(sand);
  const brickC = cv(512, 64, (g, w, h) => {
    g.fillStyle = '#7a3a22'; g.fillRect(0, 0, w, h);
    for (let row = 0; row < 2; row++) for (let i = 0; i < 16; i++) {
      const x = i * 32 + (row ? 16 : 0), v = R() * 30;
      g.fillStyle = `rgb(${150 + v},${72 + v * 0.5},${42 + v * 0.3})`; g.fillRect(x + 1.5, row * 32 + 1.5, 29, 29);
    }
  });
  const curbPts = [[PIT_R, 0], [PIT_R, 0.13], [PIT_R + 0.04, 0.17], [PIT_R + 0.16, 0.17], [PIT_R + 0.2, 0.13], [PIT_R + 0.2, 0]].map((p) => new THREE.Vector2(p[0], p[1]));
  const curb = new THREE.Mesh(new THREE.LatheGeometry(curbPts, 72), std({ map: tex(brickC, [4, 1]), roughness: 0.8 }));
  curb.castShadow = true; curb.receiveShadow = true; root.add(curb);

  // ---- the arcade: a plastered wall with six round arches, a plinth and a cornice
  const WALL_Z = -4.6, BAYS = 13, BAY_W = 2.4, WALL_H = 4.1;
  {
    const total = BAYS * BAY_W, x0 = -total / 2;
    const sh = new THREE.Shape(); sh.moveTo(x0, 0); sh.lineTo(x0 + total, 0); sh.lineTo(x0 + total, WALL_H); sh.lineTo(x0, WALL_H); sh.lineTo(x0, 0);
    for (let b = 0; b < BAYS; b++) {
      const cx = x0 + (b + 0.5) * BAY_W, hw = 0.72, hs = 2.35, p = new THREE.Path();
      p.moveTo(cx - hw, 0.0); p.lineTo(cx + hw, 0.0); p.lineTo(cx + hw, hs); p.absarc(cx, hs, hw, 0, Math.PI, false); p.lineTo(cx - hw, 0.0);
      sh.holes.push(p);
    }
    const plasterC = cv(256, 256, (g, w, h) => {
      g.fillStyle = '#8c5f3a'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(${R() > 0.5 ? '210,170,120' : '50,26,12'},${0.03 + R() * 0.05})`; g.fillRect(R() * w, R() * h, 4 + R() * 40, 2 + R() * 20); }
    });
    const wall = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.55, bevelEnabled: false }), std({ map: tex(plasterC, [0.25, 0.25]), roughness: 0.95 }));
    // extrude uvs are in metres, so the repeat above makes one texture tile per 4 m
    wall.position.set(0, 0, WALL_Z); wall.receiveShadow = true; root.add(wall);
    const corn = new THREE.Mesh(new THREE.BoxGeometry(total + 0.3, 0.28, 0.9), std({ color: 0x7a4a2a, roughness: 0.85 })); corn.position.set(0, WALL_H + 0.1, WALL_Z + 0.3); root.add(corn);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(total + 0.6, 0.12, 1.5), std({ color: 0x3c2418 })); roof.position.set(0, WALL_H + 0.3, WALL_Z + 0.3); root.add(roof);
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(total, 0.4, 0.62), std({ color: 0x8a6240, roughness: 0.9 })); plinth.position.set(0, 0.2, WALL_Z + 0.28); root.add(plinth);
    // hanging lamps in the arches: brass cups with a warm glow
    const cupM = std({ color: 0xd9a43c, metalness: 0.9, roughness: 0.3, emissive: 0xff9a30, emissiveIntensity: 0.5 });
    for (const b of [1, 3, 5]) {
      const cx = x0 + (b + 0.5) * BAY_W, y = 3.0;
      const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.8, 6), std({ color: 0x2a1a0a })); chain.position.set(cx, y + 0.4, WALL_Z + 0.32); root.add(chain);
      const cup = new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 8, 0, 6.3, 0, 1.9), cupM); cup.position.set(cx, y, WALL_Z + 0.32); cup.rotation.x = Math.PI; root.add(cup);
      addFlame(cx, y + 0.02, WALL_Z + 0.33, 0.34, false);
    }
  }
  // ---- props: floor lamps, a stand of spare clubs, a water pot
  function addFlame(x, y, z, size, light) {
    const g = cv(64, 64, (c, w, h) => { const r = c.createRadialGradient(32, 32, 1, 32, 32, 32); r.addColorStop(0, 'rgba(255,248,210,1)'); r.addColorStop(0.25, 'rgba(255,190,80,0.8)'); r.addColorStop(1, 'rgba(255,120,30,0)'); c.fillStyle = r; c.fillRect(0, 0, 64, 64); });
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex(g), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
    sp.position.set(x, y, z); sp.scale.set(size, size, 1); root.add(sp);
    const f = { sp, size, ph: R() * 6.3, light: null };
    if (light) { const pl = new THREE.PointLight(0xffa850, 2.4, 6, 2); pl.position.set(x, y + 0.05, z + 0.1); root.add(pl); f.light = pl; out.lights.push(pl); }
    out.flames.push(f);
    return f;
  }
  const brass = std({ color: 0xc89a3a, metalness: 0.9, roughness: 0.32 });
  for (const sx of [-1, 1]) {                                               // two brass lamp stands flanking the pit
    const x = sx * 2.05, z = -1.4;
    const stand = new THREE.Mesh(new THREE.LatheGeometry([[0.0, 0], [0.16, 0], [0.16, 0.03], [0.05, 0.08], [0.03, 0.2], [0.04, 0.9], [0.02, 1.0], [0.11, 1.08], [0.13, 1.16], [0.0, 1.16]].map((p) => new THREE.Vector2(p[0], p[1])), 20), brass);
    stand.position.set(x, 0, z); stand.castShadow = true; root.add(stand);
    addFlame(x, 1.22, z, 0.42, true);
  }
  {                                                                         // a stand with three spare clubs, left
    const g = new THREE.Group(); g.position.set(-1.72, 0, -1.0);
    const wood = std({ color: 0x5a3018, roughness: 0.7 });
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.2), wood); base.position.y = 0.06; base.castShadow = true; g.add(base);
    g.userData.slots = [-0.15, 0, 0.15];
    out.clubStand = g; root.add(g);
  }
  {                                                                         // clay water pot, right
    const pot = new THREE.Mesh(new THREE.LatheGeometry([[0, 0], [0.12, 0], [0.22, 0.12], [0.26, 0.28], [0.2, 0.42], [0.1, 0.5], [0.12, 0.56], [0.15, 0.58], [0.1, 0.57], [0.0, 0.45]].map((p) => new THREE.Vector2(p[0], p[1])), 24), std({ color: 0xb4582c, roughness: 0.75 }));
    pot.position.set(1.7, 0, -1.1); pot.castShadow = true; pot.receiveShadow = true; root.add(pot);
  }

  // ---- light shafts from the arches (additive soft planes) and dust
  const beamC = cv(64, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(255,214,150,0.55)'); gr.addColorStop(1, 'rgba(255,214,150,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    const gx = g.createLinearGradient(0, 0, w, 0); gx.addColorStop(0, 'rgba(0,0,0,1)'); gx.addColorStop(0.5, 'rgba(0,0,0,0)'); gx.addColorStop(1, 'rgba(0,0,0,1)'); g.globalCompositeOperation = 'destination-out'; g.fillStyle = gx; g.fillRect(0, 0, w, h); });
  const beamT = tex(beamC);
  for (let i = 0; i < 4; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.9 + R() * 0.5, 5.2), new THREE.MeshBasicMaterial({ map: beamT, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide }));
    m.position.set(-3.6 + i * 2.4 + R() * 0.4, 2.6, -2.2 - R() * 1.2); m.rotation.z = -0.32; m.rotation.y = 0.2; root.add(m); out.beams.push({ m, ph: R() * 6.3 });
  }
  {
    const N = 130, pos = new Float32Array(N * 3), seed = [];
    for (let i = 0; i < N; i++) { pos[i * 3] = (R() - 0.5) * 7; pos[i * 3 + 1] = R() * 3.6; pos[i * 3 + 2] = -3 + R() * 5; seed.push({ s: 0.02 + R() * 0.05, ph: R() * 6.3 }); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const dot = cv(32, 32, (c) => { const r = c.createRadialGradient(16, 16, 0, 16, 16, 16); r.addColorStop(0, 'rgba(255,236,190,1)'); r.addColorStop(1, 'rgba(255,220,150,0)'); c.fillStyle = r; c.fillRect(0, 0, 32, 32); });
    const pts = new THREE.Points(g, new THREE.PointsMaterial({ map: tex(dot), size: 0.05, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true }));
    pts.frustumCulled = false; root.add(pts); out.motes = { pts, pos, seed };
  }
  // sand puffs: a small pool of soft brown sprites that grow and fade where the weight lands
  {
    const c = cv(64, 64, (g) => { const r = g.createRadialGradient(32, 32, 2, 32, 32, 32); r.addColorStop(0, 'rgba(226,190,136,0.9)'); r.addColorStop(1, 'rgba(226,190,136,0)'); g.fillStyle = r; g.fillRect(0, 0, 64, 64); });
    const t = tex(c);
    for (let i = 0; i < 8; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, opacity: 0 })); sp.visible = false; root.add(sp);
      out.puffs.push({ sp, age: 9, x: 0, z: 0 });
    }
  }
  let puffI = 0;
  out.puff = (x, z, n = 1, strength = 1) => {
    for (let k = 0; k < n; k++) {
      const p = out.puffs[puffI++ % out.puffs.length];
      p.age = 0; p.x = x + (R() - 0.5) * 0.1; p.z = z + (R() - 0.5) * 0.1; p.str = strength; p.vx = (R() - 0.5) * 0.25; p.sp.visible = true;
    }
  };
  out.update = (t, dt) => {
    for (const f of out.flames) {
      const k = 0.85 + 0.15 * Math.sin(t * 9.1 + f.ph) * Math.sin(t * 5.3 + f.ph * 1.7) + 0.06 * Math.sin(t * 23 + f.ph);
      f.sp.scale.set(f.size * (0.92 + 0.12 * k), f.size * (1.0 + 0.2 * k), 1);
      if (f.light) f.light.intensity = 2.2 * k + 0.4;
    }
    for (const b of out.beams) b.m.material.opacity = 0.13 + 0.05 * Math.sin(t * 0.4 + b.ph);
    if (out.motes) {
      const { pos, seed, pts } = out.motes;
      for (let i = 0; i < seed.length; i++) {
        pos[i * 3 + 1] += seed[i].s * dt; if (pos[i * 3 + 1] > 3.8) pos[i * 3 + 1] = 0.1;
        pos[i * 3] += Math.sin(t * 0.4 + seed[i].ph) * 0.02 * dt;
      }
      pts.geometry.attributes.position.needsUpdate = true;
    }
    for (const p of out.puffs) {
      if (p.age > 1.4) { p.sp.visible = false; continue; }
      p.age += dt; const k = p.age / 1.4;
      p.sp.position.set(p.x + p.vx * p.age, 0.04 + 0.1 * Math.sqrt(k), p.z);
      const s = 0.12 + 0.55 * Math.sqrt(k); p.sp.scale.set(s, s * 0.7, 1);
      p.sp.material.opacity = 0.5 * p.str * (1 - k) * (1 - k);
    }
  };
  // icon mode: a golden haze that thickens with distance (depth of field look) and a low sun glowing behind the athlete
  {
    const gl = cv(256, 256, (g) => { const r = g.createRadialGradient(128, 128, 4, 128, 128, 128); r.addColorStop(0, 'rgba(255,240,190,0.95)'); r.addColorStop(0.35, 'rgba(255,196,100,0.5)'); r.addColorStop(1, 'rgba(255,150,60,0)'); g.fillStyle = r; g.fillRect(0, 0, 256, 256); });
    const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex(gl), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
    sun.scale.set(3.2, 3.2, 1); sun.position.set(0, 1.9, -2.4); sun.visible = false; root.add(sun);
    out.setIcon = (on) => {
      sun.visible = !!on;
      stage.scene.fog = on ? new THREE.Fog(0x082a32, 7, 17) : new THREE.Fog(0x2b2018, 9, 30);
    };
  }
  out.WALL_Z = WALL_Z; out.PIT_R = PIT_R;
  return out;
}

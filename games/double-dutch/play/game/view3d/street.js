// The street of Double Dutch: a dusk Brooklyn block. Brownstone fronts with real relief (brick bump, recessed lit windows, stone sills,
// lintels, cornices, stoops with iron railings, fire escapes), trees in pits, a streetlamp that lights the pavement, string lights,
// a boombox, chalk drawings, a bag and bottle. Everything is procedural (seeded generators, no Math.random), no image files.
// Built once; update() only moves the bulbs, speaker cones, lamp glow and tree sway.
const TAU = Math.PI * 2;
const lcg = (seed) => { let x = seed >>> 0; return () => (x = (Math.imul(x, 1664525) + 1013904223) >>> 0) / 4294967296; };

export function buildStreet({ THREE, B, stage, quality = 'medium' }) {
  const world = new THREE.Group(); world.name = 'street'; stage.scene.add(world);
  const hi = quality === 'high';
  const texOf = (w, h, draw, rep, srgb = true) => {
    const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
    return t;
  };
  const grain = (g, w, h, amp, seed) => {
    const img = g.getImageData(0, 0, w, h), r = lcg(seed);
    for (let i = 0; i < img.data.length; i += 4) { const n = (r() - 0.5) * amp; img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n; }
    g.putImageData(img, 0, 0);
  };
  const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0, ...o });
  const box = (w, h, d, x, y, z, ry = 0) => { const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(1, 1, 1)); return { geo: new THREE.BoxGeometry(w, h, d), m }; };
  const boxR = (w, h, d, x, y, z, rx, rz = 0) => { const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, 0, rz)), new THREE.Vector3(1, 1, 1)); return { geo: new THREE.BoxGeometry(w, h, d), m }; };

  // ---------------------------------------------------------------- sky and far skyline (one big plane)
  {
    const t = texOf(1024, 512, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, '#120a33'); gr.addColorStop(0.4, '#3b1d6e'); gr.addColorStop(0.7, '#b8497f'); gr.addColorStop(0.9, '#ff9a64'); gr.addColorStop(1, '#ffc58a');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
      const r = lcg(5);
      g.fillStyle = '#fff'; for (let i = 0; i < 90; i++) { g.globalAlpha = 0.2 + r() * 0.6; g.fillRect(r() * w, r() * h * 0.5, 1.6, 1.6); } g.globalAlpha = 1;
      for (let i = 0; i < 6; i++) { g.fillStyle = `rgba(255,160,150,${0.05 + r() * 0.06})`; g.beginPath(); g.ellipse(r() * w, h * (0.45 + r() * 0.25), 140 + r() * 160, 9 + r() * 10, 0, 0, TAU); g.fill(); }
      g.fillStyle = 'rgba(255,238,205,0.95)'; g.beginPath(); g.arc(w * 0.74, h * 0.2, 20, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,238,205,0.12)'; g.beginPath(); g.arc(w * 0.74, h * 0.2, 54, 0, TAU); g.fill();
      for (let layer = 0; layer < 2; layer++) {
        g.fillStyle = layer ? '#1c0f3d' : '#2f1a58';
        for (let x = -10, i = 0; x < w + 40; i++) {
          const bw = 30 + r() * 46, bh = (layer ? 60 : 100) + r() * 90;
          g.fillRect(x, h - bh - 10, bw, bh + 12);
          g.fillStyle = 'rgba(255,205,120,0.5)';
          for (let wy = h - bh; wy < h - 14; wy += 14) for (let wx = x + 5; wx < x + bw - 6; wx += 11) if (r() < 0.25) g.fillRect(wx, wy, 3, 5);
          g.fillStyle = layer ? '#1c0f3d' : '#2f1a58'; x += bw + 3;
        }
      }
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(150, 60), new THREE.MeshBasicMaterial({ map: t, fog: false, depthWrite: false }));
    m.position.set(0, 22, -46); world.add(m);
  }

  // ---------------------------------------------------------------- brownstones
  const PAL = [['#8a4636', '#6b3226'], ['#6f4a63', '#52364a'], ['#4d6677', '#374c5a'], ['#9b6540', '#744826'], ['#58705c', '#3f5543'], ['#7e3d52', '#5c2a3c']];
  const FW = 5.0, FH = 13.0, FZ = -7.0, WB = [1.95, 4.85, 7.75, 10.55];
  const WIN = { w: 1.05, h: 1.9 };
  const lamps = [];   // emissive window materials may pulse: kept for update
  const iron = std({ color: 0x15101f, roughness: 0.5, metalness: 0.5 });
  const stone = std({ color: 0x9d8f88, roughness: 0.95 });
  const stoneDark = std({ color: 0x9a8c86, roughness: 0.95 });
  const nBuild = hi ? 13 : 11;
  const facadeCache = [];
  const facade = (idx) => {
    if (facadeCache[idx]) return facadeCache[idx];
    const [c1, c2] = PAL[idx % PAL.length], W = 512, H = 1024;
    const X = (m) => (m / FW) * W, Y = (m) => (1 - m / FH) * H;
    const rnd = lcg(100 + idx * 17);
    const wins = [];       // [xCentre, yBottom]
    for (let f = 0; f < WB.length; f++) for (const wx of (f === 0 ? [1.15] : [1.15, 3.85])) wins.push([wx, WB[f], WIN.h]);
    wins.push([1.15, 0.25, 0.9]);                   // garden-level window; the door sits at x = 3.85
    const doorX = 3.85;
    const col = texOf(W, H, (g) => {
      const gr = g.createLinearGradient(0, 0, W, 0); gr.addColorStop(0, c1); gr.addColorStop(1, c2); g.fillStyle = gr; g.fillRect(0, 0, W, H);
      // brick courses
      const bh = 7.4, bw = 17;
      for (let y = 0, row = 0; y < H; y += bh, row++) for (let x = -(row % 2) * bw / 2; x < W; x += bw) {
        g.fillStyle = `rgba(${rnd() < 0.5 ? '0,0,0' : '255,255,255'},${0.025 + rnd() * 0.075})`; g.fillRect(x + 1, y + 1, bw - 2, bh - 2);
      }
      g.strokeStyle = 'rgba(20,8,10,0.38)'; g.lineWidth = 1; g.beginPath(); for (let y = 0; y < H; y += bh) { g.moveTo(0, y); g.lineTo(W, y); } g.stroke();
      // darker plinth, cornice shadow, soot
      g.fillStyle = 'rgba(0,0,0,0.3)'; g.fillRect(0, Y(0.9), W, Y(0) - Y(0.9));
      const sg = g.createLinearGradient(0, 0, 0, H); sg.addColorStop(0, 'rgba(0,0,0,0.35)'); sg.addColorStop(0.1, 'rgba(0,0,0,0)'); sg.addColorStop(0.9, 'rgba(0,0,0,0)'); sg.addColorStop(1, 'rgba(0,0,0,0.3)'); g.fillStyle = sg; g.fillRect(0, 0, W, H);
      // floor bands (stone string courses)
      g.fillStyle = 'rgba(210,190,170,0.5)'; for (const fy of WB.slice(1)) g.fillRect(0, Y(fy - 0.4), W, 7);
      // windows: recessed dark glass with a faint sky reflection, sash cross bar
      for (const [wx, wy, wh] of wins) {
        const x = X(wx - WIN.w / 2), y = Y(wy + wh), w = X(WIN.w), h = Y(wy) - y;
        const gg = g.createLinearGradient(0, y, 0, y + h); gg.addColorStop(0, '#46346a'); gg.addColorStop(1, '#1a1030'); g.fillStyle = gg; g.fillRect(x, y, w, h);
        g.fillStyle = '#d9d1c4'; g.fillRect(x - 3, y - 3, w + 6, 4); g.fillRect(x - 3, y + h - 1, w + 6, 4); g.fillRect(x - 3, y - 3, 4, h + 6); g.fillRect(x + w - 1, y - 3, 4, h + 6);
        g.fillRect(x + w / 2 - 2, y, 4, h); g.fillRect(x, y + h * 0.46, w, 4);
      }
      // front door
      const doorTop = 1.35 + 2.2, dY = Y(doorTop), dH = Y(1.35) - dY;
      g.fillStyle = '#d9d1c4'; g.fillRect(X(doorX - 0.68), dY - 8, X(1.36), dH + 8);
      g.fillStyle = idx % 2 ? '#2b1a38' : '#1f3a46'; g.fillRect(X(doorX - 0.55), dY, X(1.1), dH);
      g.fillStyle = '#ffd98a'; g.fillRect(X(doorX - 0.43), dY + 7, X(0.86), dH * 0.28);          // transom glow
      g.strokeStyle = 'rgba(0,0,0,0.5)'; g.lineWidth = 3; g.strokeRect(X(doorX - 0.4), dY + dH * 0.36, X(0.8), dH * 0.58);
      g.fillStyle = '#d6b25a'; g.fillRect(X(doorX + 0.32), Y(2.45), 6, 6);
      grain(g, W, H, 14, 9 + idx);
    });
    const bump = texOf(W, H, (g) => {
      g.fillStyle = '#8a8a8a'; g.fillRect(0, 0, W, H);
      const bh = 7.4, bw = 17, r = lcg(7 + idx);
      for (let y = 0, row = 0; y < H; y += bh, row++) for (let x = -(row % 2) * bw / 2; x < W; x += bw) { const v = 150 + r() * 70; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(x + 1.5, y + 1.5, bw - 3, bh - 3); }
      for (const [wx, wy, wh] of wins) { g.fillStyle = '#303030'; g.fillRect(X(wx - WIN.w / 2), Y(wy + wh), X(WIN.w), Y(wy) - Y(wy + wh)); }
      g.fillStyle = '#4a4a4a'; g.fillRect(X(doorX - 0.55), Y(1.35 + 2.2), X(1.1), Y(1.35) - Y(3.55));
    }, null, false);
    const lit = texOf(W, H, (g) => {
      g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
      const r = lcg(31 + idx * 13);
      for (const [wx, wy, wh] of wins) {
        if (r() < 0.38) continue;
        const x = X(wx - WIN.w / 2) + 2, y = Y(wy + wh) + 2, w = X(WIN.w) - 4, h = Y(wy) - Y(wy + wh) - 4;
        const gg = g.createLinearGradient(0, y, 0, y + h); gg.addColorStop(0, '#ffe3a1'); gg.addColorStop(1, '#ffb15e'); g.fillStyle = gg; g.fillRect(x, y, w, h);
        g.fillStyle = 'rgba(120,40,40,0.55)'; if (r() < 0.6) { g.fillRect(x, y, w * 0.28, h); g.fillRect(x + w * 0.72, y, w * 0.28, h); }   // curtains
        if (r() < 0.3) { g.fillStyle = 'rgba(40,16,40,0.7)'; g.beginPath(); g.ellipse(x + w * (0.3 + r() * 0.4), y + h * 0.75, w * 0.14, h * 0.2, 0, 0, TAU); g.fill(); }      // a silhouette
        g.fillStyle = '#6b4a2a'; g.fillRect(x + w / 2 - 2, y, 4, h); g.fillRect(x, y + h * 0.46, w, 4);
      }
      g.fillStyle = '#ffd98a'; g.fillRect(X(doorX - 0.43), Y(3.55) + 7, X(0.86), (Y(1.35) - Y(3.55)) * 0.28);
    });
    const mat = std({ map: col, bumpMap: bump, bumpScale: 2.2, emissiveMap: lit, emissive: 0xffffff, emissiveIntensity: 0.95, roughness: 0.92 });
    const trim = [];
    for (const [wx, wy, wh] of wins) {
      trim.push(box(WIN.w + 0.32, 0.1, 0.28, wx - FW / 2, wy - 0.05, 0.14));                 // sill
      trim.push(box(WIN.w + 0.3, 0.2, 0.14, wx - FW / 2, wy + wh + 0.1, 0.07));           // lintel
    }
    trim.push(box(1.7, 0.16, 0.5, doorX - FW / 2, 1.35 + 2.4, 0.25));                              // door hood
    trim.push(box(FW + 0.5, 0.42, 0.62, 0, FH - 0.21, 0.31));                                       // cornice
    trim.push(box(FW + 0.3, 0.22, 0.4, 0, FH - 0.6, 0.2));                                          // under-cornice band
    for (let i = 0; i < 10; i++) trim.push(box(0.2, 0.2, 0.22, -FW / 2 + 0.3 + i * (FW - 0.6) / 9, FH - 0.5, 0.3));   // brackets
    const geo = B.mergeGeos(trim);
    const out = { mat, geo };
    facadeCache[idx] = out;
    return out;
  };
  const buildings = new THREE.Group(); world.add(buildings);
  const stoopParts = [], ironParts = [];
  for (let i = -Math.floor(nBuild / 2); i <= Math.floor(nBuild / 2); i++) {
    const idx = ((i + 20) * 5 + 2) % PAL.length, f = facade(idx), x = i * FW, r = lcg(900 + i * 31);
    const body = new THREE.Mesh(new THREE.BoxGeometry(FW - 0.04, FH, 6), f.mat);
    // only the front face uses the facade map: give the box a dark side material
    body.material = [std({ color: 0x1b1030 }), std({ color: 0x1b1030 }), std({ color: 0x1b1030 }), std({ color: 0x1b1030 }), f.mat, std({ color: 0x1b1030 })];
    body.position.set(x, FH / 2, FZ - 3); body.receiveShadow = true; buildings.add(body);
    const trim = new THREE.Mesh(f.geo, stone); trim.position.set(x, 0, FZ); trim.castShadow = true; trim.receiveShadow = true; buildings.add(trim);
    const doorX = x + 3.85 - FW / 2;
    // stoop: seven steps up to the door, side cheeks and iron railings
    for (let s = 0; s < 7; s++) stoopParts.push(box(1.7, 0.19, 0.3, doorX, 0.095 + s * 0.19, FZ + 1.9 - s * 0.26 + 0.0 - 0.0));
    stoopParts.push(box(1.7, 0.19 * 7, 0.6, doorX, 0.665, FZ + 0.3));
    for (const sx of [-0.9, 0.9]) {
      stoopParts.push(box(0.12, 0.9, 2.3, doorX + sx, 0.65, FZ + 1.05));
      for (let p = 0; p < 7; p++) ironParts.push(box(0.025, 0.9, 0.025, doorX + sx * 0.97, (p + 1) * 0.19 + 0.45, FZ + 1.9 - p * 0.26));
      ironParts.push(boxR(0.045, 0.045, 2.24, doorX + sx * 0.97, 1.66, FZ + 1.0, 0.64));
    }
    // area railing along the garden-level window
    for (let p = 0; p < 12; p++) ironParts.push(box(0.025, 0.9, 0.025, x - FW / 2 + 0.35 + p * 0.22, 0.95, FZ + 0.9));
    ironParts.push(box(2.6, 0.05, 0.05, x - FW / 2 + 1.7, 1.4, FZ + 0.9));
    // fire escape on some fronts
    if (r() < 0.45) {
      for (let f2 = 1; f2 <= 3; f2++) {
        const y = WB[f2] + 0.05, cx = x - FW / 2 + 1.15;
        ironParts.push(box(1.7, 0.05, 0.85, cx, y, FZ + 0.5));
        for (let p = 0; p < 8; p++) ironParts.push(box(0.025, 0.9, 0.025, cx - 0.82 + p * 0.235, y + 0.47, FZ + 0.92));
        ironParts.push(box(1.7, 0.04, 0.04, cx, y + 0.93, FZ + 0.92));
        ironParts.push(boxR(0.05, 3.3, 0.05, cx + 1.45, y - 1.5, FZ + 0.62, 0, 0.5));
        ironParts.push(boxR(0.05, 3.3, 0.05, cx + 1.6, y - 1.5, FZ + 0.62, 0, 0.5));
      }
    }
  }
  { const sm = new THREE.Mesh(B.mergeGeos(stoopParts), stone); sm.castShadow = true; sm.receiveShadow = true; world.add(sm);
    const im = new THREE.Mesh(B.mergeGeos(ironParts), iron); im.castShadow = false; world.add(im); }

  // ---------------------------------------------------------------- pavement, kerb, chalk
  const slab = texOf(512, 512, (g, w, h) => {
    g.fillStyle = '#6a5a82'; g.fillRect(0, 0, w, h);
    const r = lcg(777);
    for (let i = 0; i < 220; i++) { g.globalAlpha = 0.05 + r() * 0.06; g.fillStyle = r() < 0.5 ? '#4e3f66' : '#8a7aa6'; g.beginPath(); g.ellipse(r() * w, r() * h, 8 + r() * 40, 6 + r() * 26, r() * 3, 0, TAU); g.fill(); }
    g.globalAlpha = 1; grain(g, w, h, 26, 777);
    g.strokeStyle = 'rgba(12,5,26,0.62)'; g.lineWidth = 4; g.strokeRect(1, 1, w - 2, h - 2); g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.stroke();
    g.strokeStyle = 'rgba(12,5,26,0.3)'; g.lineWidth = 1.5; g.beginPath(); for (let i = 0; i < 5; i++) { let x = r() * w, y = r() * h; g.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (r() - 0.5) * 40; y += (r() - 0.2) * 30; g.lineTo(x, y); } } g.stroke();
    g.fillStyle = 'rgba(230,230,200,0.5)'; for (let i = 0; i < 9; i++) { g.beginPath(); g.arc(r() * w, r() * h, 2 + r() * 2, 0, TAU); g.fill(); }        // gum
  }, [14, 14]);
  const slabBump = texOf(256, 256, (g, w, h) => { g.fillStyle = '#9a9a9a'; g.fillRect(0, 0, w, h); grain(g, w, h, 60, 3); g.fillStyle = '#222'; g.fillRect(0, 0, w, 3); g.fillRect(0, 0, 3, h); g.fillRect(w / 2, 0, 2, h); g.fillRect(0, h / 2, w, 2); }, [28, 28], false);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(90, 40), std({ map: slab, bumpMap: slabBump, bumpScale: 1.5, roughness: 0.88 }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(0, 0, -2); ground.receiveShadow = true; world.add(ground);
  // kerb and the road beyond it (seen at the foot of a tall portrait screen)
  {
    const kerb = new THREE.Mesh(new THREE.BoxGeometry(90, 0.16, 0.34), stone); kerb.position.set(0, 0.08, 4.9); kerb.receiveShadow = true; world.add(kerb);
    const road = texOf(256, 256, (g, w, h) => { g.fillStyle = '#2a2236'; g.fillRect(0, 0, w, h); grain(g, w, h, 30, 12); }, [12, 6]);
    const rd = new THREE.Mesh(new THREE.PlaneGeometry(90, 20), std({ map: road, roughness: 1 })); rd.rotation.x = -Math.PI / 2; rd.position.set(0, -0.004, 15); rd.receiveShadow = true; world.add(rd);
  }
  const decal = (w, h, draw, x, z, rot = 0, op = 1) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: texOf(Math.round(512 * Math.min(1, w / h)) + 2, Math.round(512 * Math.min(1, h / w)) + 2, (g, cw, ch) => draw(g, cw, ch)), transparent: true, opacity: op, depthWrite: false, fog: true }));
    m.rotation.x = -Math.PI / 2; m.rotation.z = rot; m.position.set(x, 0.006, z); m.renderOrder = 2; world.add(m); return m;
  };
  const chalk = (g, w, h, fn, lw = 6) => { const r = lcg(w + h); g.lineCap = 'round'; g.lineJoin = 'round'; for (let k = 0; k < 2; k++) { g.lineWidth = lw * (k ? 0.6 : 1); g.strokeStyle = `rgba(255,255,255,${k ? 0.55 : 0.82})`; fn(g, (r() - 0.5) * 2.2); } };
  // lamp pool of light on the pavement
  decal(11, 11, (g, w, h) => { const r = g.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w / 2); r.addColorStop(0, 'rgba(255,200,120,0.5)'); r.addColorStop(1, 'rgba(255,200,120,0)'); g.fillStyle = r; g.fillRect(0, 0, w, h); }, 3.4, -0.4);
  // hopscotch, tall: numbered boxes with an arc at the top
  decal(1.15, 3.7, (g, w, h) => {
    const rows = [[1], [1], [2], [1], [2], [1], [2]], ch = h / 8.7, cw = w * 0.45;
    chalk(g, w, h, (gg, j) => {
      let y = h - ch * 0.4;
      for (const rw of rows) { y -= ch; rw.forEach((_, i) => { const x = rw.length === 1 ? (w - cw) / 2 : w / 2 - cw + i * cw; gg.strokeRect(x + 4 + j, y + 4 + j, cw - 8, ch - 8); }); }
      gg.beginPath(); gg.arc(w / 2 + j, y - ch * 0.1, cw * 0.95, Math.PI, TAU); gg.closePath(); gg.stroke();
    }, 8);
    g.fillStyle = 'rgba(255,255,255,0.85)'; g.font = '800 46px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    let y = h - ch * 0.4, n = 1; for (const rw of rows) { y -= ch; rw.forEach((_, i) => { const x = rw.length === 1 ? (w - cw) / 2 : w / 2 - cw + i * cw; g.fillText(String(n++), x + cw / 2, y + ch / 2 + 2); }); }
  }, -2.0, 2.55, 0.1, 0.95);
  decal(1.9, 1.9, (g, w, h) => { chalk(g, w, h, (gg) => { gg.beginPath(); gg.arc(w / 2, h / 2, w * 0.17, 0, TAU); gg.stroke(); for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; gg.beginPath(); gg.moveTo(w / 2 + Math.cos(a) * w * 0.24, h / 2 + Math.sin(a) * w * 0.24); gg.lineTo(w / 2 + Math.cos(a) * w * 0.38, h / 2 + Math.sin(a) * w * 0.38); gg.stroke(); } }, 9); }, 1.35, 2.35, 0.2, 0.9);
  decal(1.9, 1.3, (g, w, h) => { chalk(g, w, h, (gg) => { for (const [cx, cy, sc] of [[0.3, 0.55, 1], [0.7, 0.45, 0.7]]) { const x = w * cx, y = h * cy, r = w * 0.1 * sc; gg.beginPath(); gg.moveTo(x, y + r * 1.2); gg.bezierCurveTo(x - r * 2.2, y - r * 0.3, x - r * 0.9, y - r * 1.6, x, y - r * 0.5); gg.bezierCurveTo(x + r * 0.9, y - r * 1.6, x + r * 2.2, y - r * 0.3, x, y + r * 1.2); gg.stroke(); } }, 8); }, -3.9, 1.5, -0.2, 0.8);
  decal(2.4, 1.0, (g, w, h) => { chalk(g, w, h, (gg) => { gg.font = '800 90px system-ui'; gg.textAlign = 'center'; gg.textBaseline = 'middle'; gg.strokeText('DOUBLE', w * 0.5, h * 0.3); gg.strokeText('DUTCH', w * 0.5, h * 0.72); }, 5); }, 3.9, 3.2, 0.12, 0.62);
  // two chalk marks where the turners stand
  for (const sx of [-1, 1]) decal(0.8, 0.5, (g, w, h) => { chalk(g, w, h, (gg) => { gg.beginPath(); gg.ellipse(w / 2, h / 2, w * 0.42, h * 0.4, 0, 0, TAU); gg.stroke(); }, 7); }, sx * 1.72, 0, 0, 0.5);

  // ---------------------------------------------------------------- street trees, hydrant, bins
  const trees = [];
  {
    const leaf = [std({ color: 0x24503a, roughness: 1 }), std({ color: 0x2f6648, roughness: 1 }), std({ color: 0x1c4430, roughness: 1 })];
    const bark = std({ color: 0x3a2a24 });
    for (const [tx, tz, s] of [[-9.3, -4.4, 0.8], [9.6, -4.8, 0.85]]) {
      const g = new THREE.Group(); g.position.set(tx, 0, tz); g.scale.setScalar(s); world.add(g);
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 3.2, 8), bark); trunk.position.y = 1.6; trunk.castShadow = true; g.add(trunk);
      const pit = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, 1.2), std({ color: 0x241a22 })); pit.position.y = 0.04; g.add(pit);
      const crown = new THREE.Group(); crown.position.y = 3.6; g.add(crown);
      const r = lcg(tx * 10 + 99);
      for (let i = 0; i < 14; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.45 + r() * 0.4, 12, 9), leaf[i % 3]); m.position.set((r() - 0.5) * 2.6, (r() - 0.3) * 1.7, (r() - 0.5) * 2.2); m.castShadow = true; crown.add(m); }
      trees.push({ crown, ph: tx });
    }
    const hy = new THREE.Group(); hy.position.set(-4.6, 0, 1.9); world.add(hy);
    const red = std({ color: 0xc0262e, roughness: 0.5, metalness: 0.2 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.55, 14), red); body.position.y = 0.3; body.castShadow = true; hy.add(body);
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 8), red); cap.position.y = 0.58; hy.add(cap);
    for (const sx of [-1, 1]) { const n = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.12, 10), red); n.rotation.z = Math.PI / 2; n.position.set(sx * 0.13, 0.36, 0); hy.add(n); }
  }

  // ---------------------------------------------------------------- string lights and the lamp
  const bulbCols = [0xffd23f, 0xff3fa4, 0x35d0ff, 0x7be26a, 0xff8a1f];
  const bulbs = [];
  {
    const sg = new THREE.SphereGeometry(0.08, 10, 8);
    for (const [z, y0, x0, x1] of [[-4.4, 5.6, -15, 15], [-2.0, 4.8, -15, 15]]) {
      const pts = [], n = 4;
      for (let i = 0; i <= 64; i++) { const u = i / 64, seg = (u * n) % 1; pts.push(new THREE.Vector3(x0 + (x1 - x0) * u, y0 - Math.sin(Math.PI * seg) * 0.55 + 0.1, z)); }
      world.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x0c0618 })));
      for (let i = 0; i < 24; i++) { const u = (i + 0.5) / 24, seg = (u * n) % 1; const m = new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ color: bulbCols[i % 5] })); m.position.set(x0 + (x1 - x0) * u, y0 - Math.sin(Math.PI * seg) * 0.55, z); world.add(m); bulbs.push(m); }
    }
  }
  const lamp = { light: null, glow: null };
  {
    const g = new THREE.Group(); g.position.set(5.4, 0, -1.4); world.add(g);
    const m = std({ color: 0x1a1226, roughness: 0.45, metalness: 0.6 });
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.5, 10), m); base.position.y = 0.25; g.add(base);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 4.4, 10), m); pole.position.y = 2.5; pole.castShadow = true; g.add(pole);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.06, 0.06), m); arm.position.set(-0.3, 4.65, 0); g.add(arm);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10), new THREE.MeshBasicMaterial({ color: 0xfff0c4 })); head.position.set(-0.66, 4.55, 0); g.add(head);
    const hood = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.32, 0.18, 14), m); hood.position.set(-0.66, 4.78, 0); g.add(hood);
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 10), new THREE.MeshBasicMaterial({ color: 0xffc070, transparent: true, opacity: 0.18, depthWrite: false })); glow.position.copy(head.position); g.add(glow);
    lamp.glow = glow;
    if (quality !== 'low') { const pl = new THREE.PointLight(0xffc27a, 2.4, 11, 1.6); pl.position.set(5.4 - 0.66, 4.4, -1.4); world.add(pl); lamp.light = pl; }
  }

  // ---------------------------------------------------------------- boombox and the kids' bag
  const speakers = [];
  {
    const bx = new THREE.Group(); bx.position.set(-3.1, 0, 1.2); bx.rotation.y = 0.55; world.add(bx);
    const body = new THREE.Mesh(B.roundedBox ? B.roundedBox(0.6, 0.26, 0.17, 0.03) : new THREE.BoxGeometry(0.6, 0.26, 0.17), std({ color: 0x2a2140, roughness: 0.45, metalness: 0.2 })); body.position.y = 0.13; body.castShadow = true; bx.add(body);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.012, 6, 16, Math.PI), std({ color: 0x9a8cc0, metalness: 0.7, roughness: 0.3 })); handle.position.set(0, 0.26, 0); bx.add(handle);
    const deck = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 0.012), std({ color: 0x0c0a14, roughness: 0.3 })); deck.position.set(0, 0.13, 0.088); bx.add(deck);
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.38, 5), std({ color: 0xcfc6e0, metalness: 0.8, roughness: 0.3 })); ant.position.set(0.24, 0.43, -0.04); ant.rotation.z = -0.4; bx.add(ant);
    for (const sx of [-0.2, 0.2]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.01, 6, 20), std({ color: 0xb8aedc, metalness: 0.7, roughness: 0.3 })); ring.position.set(sx, 0.13, 0.09); bx.add(ring);
      const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.058, 0.025, 20), new THREE.MeshStandardMaterial({ color: 0x14101f, roughness: 0.6, emissive: 0xb04a86, emissiveIntensity: 0.6 })); sp.rotation.x = Math.PI / 2; sp.position.set(sx, 0.13, 0.092); bx.add(sp); speakers.push(sp);
    }
  }
  {
    const bag = new THREE.Group(); bag.position.set(2.9, 0, 1.7); bag.rotation.y = -0.5; world.add(bag);
    const bm = std({ color: 0x1fb8a6, roughness: 0.75 });
    const body = new THREE.Mesh(B.roundedBox(0.36, 0.46, 0.2, 0.06), bm); body.position.y = 0.23; body.castShadow = true; bag.add(body);
    const pocket = new THREE.Mesh(B.roundedBox(0.28, 0.2, 0.06, 0.03), std({ color: 0xff8a1f, roughness: 0.75 })); pocket.position.set(0, 0.17, 0.12); bag.add(pocket);
    const strap = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.012, 6, 14, Math.PI), std({ color: 0x14786d })); strap.position.set(0, 0.46, 0); bag.add(strap);
    const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.22, 12), std({ color: 0x35d0ff, roughness: 0.25, metalness: 0.1 })); bottle.position.set(0.32, 0.11, 0.08); bottle.castShadow = true; bag.add(bottle);
  }

  return {
    group: world, bulbs, speakers, trees, lamp, buildings,
    update(t, pulse) {
      bulbs.forEach((b, i) => { b.scale.setScalar(0.85 + 0.4 * pulse * ((i % 2) ? 1 : 0.6)); });
      speakers.forEach((sp, i) => { const s = 1 + 0.16 * pulse; sp.scale.set(s, 1, s); sp.material.emissiveIntensity = 0.5 + 0.9 * pulse + i * 0; });
      trees.forEach((tr) => { tr.crown.rotation.z = Math.sin(t * 0.8 + tr.ph) * 0.012; tr.crown.rotation.x = Math.cos(t * 0.6 + tr.ph) * 0.01; });
      if (lamp.light) lamp.light.intensity = 2.4 + Math.sin(t * 13.1) * 0.04 + Math.sin(t * 5.3) * 0.03;
    },
  };
}

// The 3D hall for Mas Wrestling: three real lit settings (Festival Meadow, Winter Hall, Grand Arena), each with tiered wooden stands full of
// crowd3d spectators in Sakha winter dress (fur hats, long coats), carved banners that flutter, a felt mat with an ornament border, a carved
// wooden block with real grain and worn foot marks, and a turned wooden stick with grip rings that bows under load.
// Everything is primitives + small canvas textures (nothing to download). The presenter reads the sim and calls update().
import { GEOM } from './athlete.js';

export const UPM = 240;            // 2D world units per metre (the bridge between the flat overlay and the 3D scene)

const HALL = {
  meadow: { light: 'day', sky: 0x9ccbea, key: 0xfff0d8, keyI: 2.7, hemi: 1.0, rim: 0xcfe2ff, rimI: 1.1, exposure: 1.02, cold: false, floor: '#c79a5e', seam: '#6b4524' },
  winter: { light: 'indoor', sky: 0x2a1a10, key: 0xffd9a8, keyI: 2.5, hemi: 0.8, rim: 0xbfd2ff, rimI: 1.5, exposure: 1.0, cold: true, floor: '#b88a52', seam: '#5a3a18' },
  arena: { light: 'night', sky: 0x070c1c, key: 0xdfe8ff, keyI: 3.0, hemi: 0.55, rim: 0x7f9bff, rimI: 1.5, exposure: 1.05, cold: true, floor: '#8a6a47', seam: '#3d2c1a' },
};
const rngOf = (seed) => { let s = seed >>> 0 || 1; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; };

export function buildHall(THREE, stage, V3) {
  const root = new THREE.Group(); root.name = 'hall';
  const doc = globalThis.document;
  const cvs = (w, h) => { const c = doc.createElement('canvas'); c.width = w; c.height = h; return c; };
  const tex = (c, { repeat = null, srgb = true, aniso = 8 } = {}) => {
    const t = new THREE.CanvasTexture(c);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
    t.anisotropy = aniso;
    return t;
  };
  const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.82, metalness: 0, ...o });
  const disposables = [];
  const keep = (x) => { disposables.push(x); return x; };
  const B3 = V3.board3d;

  // ---------------------------------------------------------------- textures
  // wood: planks (vertical strips of the canvas), per-plank tone, long grain, cathedral arcs, knots, seams; worn patches; also the bump source.
  function woodCanvas(w, h, { base = '#c79a5e', dark = '#5a3a18', seed = 1, planks = 8, knots = 3, seam = true, wear = null } = {}) {
    const c = cvs(w, h), g = c.getContext('2d'), r = rngOf(seed);
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    const pw = w / planks;
    for (let i = 0; i < planks; i++) {
      const tone = (r() - 0.5) * 0.22;
      g.fillStyle = tone > 0 ? `rgba(255,236,200,${tone})` : `rgba(30,14,4,${-tone})`;
      g.fillRect(i * pw, 0, pw, h);
      for (let k = 0; k < 70; k++) {
        const x = i * pw + r() * pw, a = 0.05 + r() * 0.16;
        g.strokeStyle = `rgba(${40 + (r() * 30) | 0},${20 + (r() * 16) | 0},8,${a})`; g.lineWidth = 0.6 + r() * 1.6;
        g.beginPath(); g.moveTo(x, 0);
        g.bezierCurveTo(x + (r() - 0.5) * pw * 0.25, h * 0.3, x + (r() - 0.5) * pw * 0.25, h * 0.7, x + (r() - 0.5) * pw * 0.12, h); g.stroke();
      }
      for (let k = 0; k < 4; k++) {
        const cx = i * pw + pw * (0.25 + r() * 0.5), cy = r() * h;
        for (let m = 0; m < 6; m++) { g.strokeStyle = `rgba(60,32,10,${0.05 + r() * 0.07})`; g.lineWidth = 1.1; g.beginPath(); g.ellipse(cx, cy, pw * (0.08 + m * 0.07), h * (0.1 + m * 0.12), 0, 0, Math.PI * 2); g.stroke(); }
      }
      for (let k = 0; k < knots; k++) {
        if (r() > 0.45) continue;
        const cx = i * pw + pw * (0.2 + r() * 0.6), cy = r() * h, rr = pw * (0.05 + r() * 0.06);
        for (let m = 3; m >= 0; m--) { g.fillStyle = `rgba(${50 - m * 8},${26 - m * 4},8,${0.5 - m * 0.08})`; g.beginPath(); g.ellipse(cx, cy, rr * (1 + m * 0.5), rr * (1.7 + m * 0.9), 0, 0, Math.PI * 2); g.fill(); }
      }
      if (seam) { g.fillStyle = dark; g.fillRect(i * pw, 0, 2.2, h); g.fillStyle = 'rgba(255,225,170,0.18)'; g.fillRect(i * pw + 2.2, 0, 1.2, h); }
    }
    if (wear) for (const wr of wear) {
      const gr = g.createRadialGradient(wr.x * w, wr.y * h, 1, wr.x * w, wr.y * h, wr.r * w);
      gr.addColorStop(0, 'rgba(40,20,6,0.5)'); gr.addColorStop(1, 'rgba(40,20,6,0)');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    }
    return c;
  }
  const woodMat = (o, mo = {}) => {
    const c = woodCanvas(o.w || 512, o.h || 512, o), m = std({ map: keep(tex(c, { repeat: o.repeat })), roughness: 0.62, ...mo });
    m.bumpMap = keep(tex(c, { repeat: o.repeat, srgb: false })); m.bumpScale = 0.6;
    return m;
  };
  // an ornament in the Sakha manner: a lozenge with four horn curls and a seed at the centre (original, abstract)
  function ornament(g, cx, cy, s, col, lw = 0.07) {
    g.strokeStyle = col; g.fillStyle = col; g.lineWidth = s * lw; g.lineCap = 'round'; g.lineJoin = 'round';
    g.beginPath(); g.moveTo(cx, cy - s); g.lineTo(cx + s * 0.62, cy); g.lineTo(cx, cy + s); g.lineTo(cx - s * 0.62, cy); g.closePath(); g.stroke();
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
      g.beginPath(); g.arc(cx + sx * s * 1.0, cy + sy * s * 0.4, s * 0.3, 0, Math.PI * 1.5); g.stroke();
    }
    g.beginPath(); g.arc(cx, cy, s * 0.14, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.moveTo(cx, cy - s * 0.45); g.lineTo(cx + s * 0.22, cy); g.lineTo(cx, cy + s * 0.45); g.lineTo(cx - s * 0.22, cy); g.closePath(); g.stroke();
  }
  function bannerCanvas(seed, a, b, gold = '#f2c14e') {
    const w = 256, h = 512, c = cvs(w, h), g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, a); gr.addColorStop(1, b); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(0,0,0,0.07)'; g.lineWidth = 1;
    for (let x = 0; x < w; x += 4) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    for (let y = 0; y < h; y += 4) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    g.strokeStyle = gold; g.lineWidth = 7; g.strokeRect(14, 14, w - 28, h - 28);
    g.lineWidth = 2.5; g.strokeRect(26, 26, w - 52, h - 52);
    const r = rngOf(seed);
    ornament(g, w / 2, h * 0.3, 56, gold, 0.06);
    ornament(g, w / 2, h * 0.66, 38, '#f4efe0', 0.07);
    for (let k = 0; k < 5; k++) { g.fillStyle = gold; g.beginPath(); g.moveTo(40 + k * 44, h - 34); g.lineTo(62 + k * 44, h - 70 - r() * 10); g.lineTo(84 + k * 44, h - 34); g.closePath(); g.fill(); }
    return c;
  }
  function feltCanvas() {
    const w = 1024, h = 560, c = cvs(w, h), g = c.getContext('2d'), r = rngOf(9);
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#e4d3a6'); gr.addColorStop(1, '#d4c196'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(${120 + (r() * 80) | 0},${100 + (r() * 60) | 0},60,${0.05 + r() * 0.1})`; g.fillRect(r() * w, r() * h, 1 + r() * 2, 1); }
    g.strokeStyle = 'rgba(120,100,60,0.12)'; g.lineWidth = 1;
    for (let x = 0; x < w; x += 6) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
    for (let y = 0; y < h; y += 6) { g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
    const bw = 34;
    g.strokeStyle = '#9c2f1d'; g.lineWidth = bw; g.strokeRect(bw, bw, w - 2 * bw, h - 2 * bw);
    g.strokeStyle = '#1f5a62'; g.lineWidth = 8; g.strokeRect(bw * 2.1, bw * 2.1, w - 4.2 * bw, h - 4.2 * bw);
    g.strokeStyle = '#d8b25a'; g.lineWidth = 3; g.strokeRect(bw * 0.4, bw * 0.4, w - 0.8 * bw, h - 0.8 * bw);
    for (let k = 0; k < 11; k++) { ornament(g, 110 + k * 80.4, bw, 13, '#f4e7c4', 0.1); ornament(g, 110 + k * 80.4, h - bw, 13, '#f4e7c4', 0.1); }
    for (let k = 0; k < 5; k++) { ornament(g, bw, 90 + k * 95, 13, '#f4e7c4', 0.1); ornament(g, w - bw, 90 + k * 95, 13, '#f4e7c4', 0.1); }
    for (const sx of [-1, 1]) {
      const gx = w / 2 + sx * w * 0.2;
      const rg = g.createRadialGradient(gx, h / 2, 10, gx, h / 2, 120); rg.addColorStop(0, 'rgba(90,70,40,0.22)'); rg.addColorStop(1, 'rgba(90,70,40,0)');
      g.fillStyle = rg; g.fillRect(gx - 140, h / 2 - 140, 280, 280);
    }
    g.strokeStyle = 'rgba(90,70,40,0.22)'; g.lineWidth = 2;
    for (let k = 0; k < 26; k++) { const x = w / 2 + (r() - 0.5) * 360, y = h / 2 + (r() - 0.5) * 150; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 60, y + (r() - 0.5) * 8); g.stroke(); }
    return c;
  }
  function logCanvas() {
    const w = 512, h = 128, c = cvs(w, h), g = c.getContext('2d'), r = rngOf(31);
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#7a4a24'); gr.addColorStop(0.5, '#a8703a'); gr.addColorStop(1, '#5a3418'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 160; k++) { g.strokeStyle = `rgba(30,14,4,${0.08 + r() * 0.18})`; g.lineWidth = 0.7 + r(); const y = r() * h; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(w * 0.3, y + (r() - 0.5) * 6, w * 0.7, y + (r() - 0.5) * 6, w, y + (r() - 0.5) * 4); g.stroke(); }
    return c;
  }
  const softDot = (() => {
    const c = cvs(64, 64), g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.45, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return keep(tex(c, { aniso: 1 }));
  })();

  // ---------------------------------------------------------------- the props common to every hall
  const matY = GEOM.matY;
  const feltC = feltCanvas();
  const matTop = std({ map: keep(tex(feltC)), bumpMap: keep(tex(feltC, { srgb: false })), bumpScale: 0.25, roughness: 0.95 });
  const matSide = std({ color: 0xcdbf98 });
  const mat = new THREE.Mesh(B3.roundedBox(3.9, matY, 2.2, 0.018, 4), matSide);
  mat.position.set(0, matY / 2, 0); mat.receiveShadow = true;
  const matSurface = new THREE.Mesh(new THREE.PlaneGeometry(3.88, 2.18), matTop);
  matSurface.rotation.x = -Math.PI / 2; matSurface.position.set(0, matY + 0.0006, 0); matSurface.receiveShadow = true;
  root.add(mat, matSurface);
  const under = new THREE.Mesh(new THREE.BoxGeometry(4.15, 0.012, 2.45), std({ color: 0x2a1a0c, roughness: 0.9 }));
  under.position.y = 0.006; under.receiveShadow = true; root.add(under);

  // the block: carved upright with a base plate, real grain, worn foot hollows on both faces, brass pins
  const block = new THREE.Group();
  {
    const bodyMat = woodMat({ w: 512, h: 512, base: '#c9964f', dark: '#5a3a18', seed: 77, planks: 4, knots: 0, seam: false, wear: [{ x: 0.3, y: 0.34, r: 0.14 }, { x: 0.7, y: 0.34, r: 0.14 }] }, { roughness: 0.55 });
    const body = new THREE.Mesh(B3.roundedBox(0.11, 0.5, 0.6, 0.022, 4), bodyMat);
    body.position.set(0, matY + 0.25, 0); body.castShadow = true; body.receiveShadow = true;
    const baseM = woodMat({ w: 256, h: 256, base: '#a97b45', dark: '#4a2e12', seed: 78, planks: 3, knots: 0 }, { roughness: 0.6 });
    const base = new THREE.Mesh(B3.roundedBox(0.34, 0.06, 0.7, 0.02, 4), baseM);
    base.position.set(0, matY + 0.03, 0); base.castShadow = true; base.receiveShadow = true;
    const cap = new THREE.Mesh(B3.roundedBox(0.125, 0.03, 0.64, 0.012, 3), std({ color: 0xe2b87a, roughness: 0.5 }));
    cap.position.set(0, matY + 0.515, 0); cap.castShadow = true;
    const brass = std({ color: 0xc9a24a, roughness: 0.3, metalness: 0.9 });
    block.add(body, base, cap);
    for (const sz of [-0.26, 0.26]) for (const sy of [0.12, 0.40]) {
      const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.125, 12), brass);
      pin.rotation.z = Math.PI / 2; pin.position.set(0, matY + sy, sz); block.add(pin);
    }
  }
  root.add(block);

  // the stick: seven turned segments that follow a bow (the bar flexes under a hard pull), carved collars, grip rings, brass ferrules
  const STICK_LEN = 1.28, SEG = 7;
  const stick = new THREE.Group();
  const holders = [];
  {
    const sm = woodMat({ w: 256, h: 256, base: '#c99a58', dark: '#7a4a1e', seed: 5, planks: 2, knots: 0, seam: false, repeat: [4, 1] }, { roughness: 0.38 });
    const brass = std({ color: 0xd2ab52, roughness: 0.25, metalness: 0.95 });
    const R = 0.0205, L = STICK_LEN / SEG;
    const hold = (x, mesh) => { const g = new THREE.Group(); g.userData.x = x; g.add(mesh); stick.add(g); holders.push(g); };
    const cyl = (r, len, m) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 20), m); o.rotation.z = Math.PI / 2; o.castShadow = true; o.receiveShadow = true; return o; };
    for (let i = 0; i < SEG; i++) hold(-STICK_LEN / 2 + L * (i + 0.5), cyl(R, L * 1.02, sm));
    for (const s of [-1, 1]) {
      hold(s * 0.03, cyl(0.0262, 0.014, sm));
      for (const x of [0.195, 0.205, 0.215]) hold(s * x, cyl(x === 0.205 ? 0.0268 : 0.0236, 0.01, sm));
      hold(s * 0.45, cyl(0.0262, 0.014, sm)); hold(s * 0.465, cyl(0.0236, 0.01, sm));
      hold(s * (STICK_LEN / 2 - 0.035), cyl(0.0272, 0.05, brass));
      const capm = new THREE.Mesh(new THREE.SphereGeometry(0.0235, 14, 10), brass); capm.scale.x = 0.7; capm.castShadow = true;
      hold(s * (STICK_LEN / 2 + 0.002), capm);
    }
  }
  root.add(stick);

  // ---------------------------------------------------------------- per-hall dressing
  function bannerMesh(seed, a, b, w = 0.9, h = 1.8, flutter = 0.07) {
    const geo = new THREE.PlaneGeometry(w, h, 6, 12);
    const m = std({ map: keep(tex(bannerCanvas(seed, a, b))), side: THREE.DoubleSide, roughness: 0.9 });
    const mesh = new THREE.Mesh(geo, m);
    const base = geo.attributes.position.array.slice();
    const ph = (seed * 1.7) % 6.28;
    mesh.userData.update = (t, k = 1) => {
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = base[i * 3], y = base[i * 3 + 1];
        const hang = (h / 2 - y) / h;
        p.setZ(i, Math.sin(t * 1.9 + x * 3.1 + hang * 4.5 + ph) * flutter * hang * k + Math.sin(t * 0.7 + ph) * 0.03 * hang);
      }
      p.needsUpdate = true; geo.computeVertexNormals();
    };
    return mesh;
  }
  function stands(g, { z0 = -3.1, rows = 4, width = 11, rise = 0.46, depth = 0.8, dark = '#4a2e14', light = '#8a5a2c' } = {}) {
    const pm = woodMat({ w: 512, h: 128, base: light, dark, seed: 12, planks: 5, knots: 1, repeat: [3, 1] }, { roughness: 0.75 });
    const rm = woodMat({ w: 256, h: 256, base: dark, dark: '#1a0e04', seed: 14, planks: 3, knots: 0 }, { roughness: 0.85 });
    for (let r = 0; r < rows; r++) {
      const y = r * rise + 0.2, z = z0 - r * depth;
      const seat = new THREE.Mesh(new THREE.BoxGeometry(width, 0.07, depth * 0.62), pm);
      seat.position.set(0, y + 0.22, z - depth * 0.1); seat.castShadow = true; seat.receiveShadow = true; g.add(seat);
      const riser = new THREE.Mesh(new THREE.BoxGeometry(width, rise + 0.2, 0.06), rm);
      riser.position.set(0, y / 2 + 0.1, z + depth * 0.22); riser.receiveShadow = true; g.add(riser);
      const board = new THREE.Mesh(new THREE.BoxGeometry(width, 0.05, depth * 0.36), pm);
      board.position.set(0, y - 0.02, z + depth * 0.05); g.add(board);
    }
    const tall = rows * rise + 0.2;
    for (const sx of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, tall + 1.0, 0.14), rm); post.position.set(sx * width / 2, (tall + 1.0) / 2, z0 - rows * depth + depth * 0.5); post.castShadow = true; g.add(post);
    }
    // a solid front barrier hung with an ornament band (hides the seated legs, frames the picture)
    const bar = new THREE.Mesh(new THREE.BoxGeometry(width, 0.95, 0.12), rm); bar.position.set(0, 0.475, z0 + 0.42); bar.castShadow = true; bar.receiveShadow = true; g.add(bar);
    const bc = cvs(1024, 96), q = bc.getContext('2d');
    q.fillStyle = '#1f4a56'; q.fillRect(0, 0, 1024, 96);
    q.fillStyle = '#9c2f1d'; q.fillRect(0, 0, 1024, 10); q.fillRect(0, 86, 1024, 10);
    for (let k = 0; k < 16; k++) ornament(q, 32 + k * 64, 48, 26, '#f2c14e', 0.07);
    const band = new THREE.Mesh(new THREE.PlaneGeometry(width - 0.2, 0.62), std({ map: keep(tex(bc)), roughness: 0.9 }));
    band.position.set(0, 0.5, z0 + 0.485); g.add(band);
    const top = new THREE.Mesh(new THREE.BoxGeometry(width + 0.1, 0.06, 0.2), pm); top.position.set(0, 0.97, z0 + 0.42); g.add(top);
  }
  function birch(g, x, z, h, seed, leaf) {
    const r = rngOf(seed);
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.11, h, 8), std({ color: 0xece6d4, roughness: 0.8 }));
    trunk.position.set(x, h / 2, z); trunk.castShadow = true; g.add(trunk);
    for (let k = 0; k < 7; k++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.05 + r() * 0.05, 0.15), std({ color: 0x2c2a26, roughness: 0.9 }));
      b.position.set(x, 0.6 + k * (h / 8) + r() * 0.2, z); b.rotation.y = r() * 3; g.add(b);
    }
    for (let k = 0; k < 6; k++) {
      const blob = new THREE.Mesh(new THREE.SphereGeometry(0.9 + r() * 0.5, 9, 7), std({ color: leaf[(r() * leaf.length) | 0], roughness: 0.95 }));
      blob.position.set(x + (r() - 0.5) * 1.1, h * 0.8 + r() * 1.3, z + (r() - 0.5) * 0.9); blob.scale.y = 0.8; blob.castShadow = k < 2; g.add(blob);
    }
  }
  function serge(g, x, z) {            // a carved hitching post with a horsehair tassel (the festival's own landmark)
    const wood = woodMat({ w: 128, h: 512, base: '#b88245', dark: '#4a2a0e', seed: 41, planks: 2, knots: 1, seam: false }, { roughness: 0.6 });
    const prof = [[0.0, 0], [0.16, 0], [0.16, 0.08], [0.11, 0.14], [0.11, 0.9], [0.14, 0.96], [0.14, 1.02], [0.1, 1.08], [0.1, 1.9], [0.13, 1.96], [0.13, 2.02], [0.085, 2.1], [0.085, 2.45], [0.11, 2.52], [0.0, 2.6]];
    const post = new THREE.Mesh(B3.lathe(prof, 20), wood);
    post.position.set(x, 0, z); post.castShadow = true; g.add(post);
    const out = [];
    for (let k = 0; k < 7; k++) {
      const geo = new THREE.PlaneGeometry(0.035, 0.9, 1, 6);
      const m = new THREE.Mesh(geo, std({ color: k % 2 ? 0xf2efe6 : 0xdcd6c6, side: THREE.DoubleSide, roughness: 0.9 }));
      m.position.set(x + (k - 3) * 0.04, 2.0, z + 0.14);
      const base = geo.attributes.position.array.slice();
      m.userData.update = (t) => { const p = geo.attributes.position; for (let i = 0; i < p.count; i++) { const hang = (0.45 - base[i * 3 + 1]) / 0.9; p.setX(i, base[i * 3] + Math.sin(t * 2.4 + hang * 3 + k) * 0.06 * hang); p.setZ(i, Math.sin(t * 1.7 + hang * 2 + k * 2) * 0.05 * hang); } p.needsUpdate = true; };
      g.add(m); out.push(m);
    }
    return out;
  }

  function build(id) {
    const H = HALL[id];
    const g = new THREE.Group(); g.name = 'hall-' + id;
    const upd = [];
    const floorM = woodMat({ w: 1024, h: 512, base: H.floor, dark: H.seam, seed: 11 + id.length, planks: 8, knots: 0, repeat: [5, 4] }, { roughness: id === 'arena' ? 0.4 : 0.7 });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(24, 18), floorM);
    floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, -3); floor.receiveShadow = true; g.add(floor);
    if (id === 'meadow') {
      const grass = new THREE.Mesh(new THREE.PlaneGeometry(140, 90), std({ color: 0x7ea860, roughness: 1 }));
      grass.rotation.x = -Math.PI / 2; grass.position.set(0, -0.03, -30); g.add(grass);
      floor.scale.set(0.58, 0.5, 1); floor.position.set(0, 0.002, -1.8);
      const edge = new THREE.Mesh(new THREE.BoxGeometry(14.2, 0.12, 9.2), std({ color: 0x5a3a18 })); edge.position.set(0, -0.06, -1.8); g.add(edge);
      const skyC = cvs(8, 256), q = skyC.getContext('2d'), gr = q.createLinearGradient(0, 0, 0, 256);
      gr.addColorStop(0, '#5f9fd6'); gr.addColorStop(0.5, '#b9dcef'); gr.addColorStop(0.58, '#e8efe0'); gr.addColorStop(1, '#d6e6c8'); q.fillStyle = gr; q.fillRect(0, 0, 8, 256);
      const sky = new THREE.Mesh(new THREE.SphereGeometry(70, 24, 12), new THREE.MeshBasicMaterial({ map: keep(tex(skyC)), side: THREE.BackSide, fog: false, toneMapped: false }));
      g.add(sky);
      for (const [x, z, s, c] of [[-18, -40, 16, 0x7a9a78], [10, -46, 20, 0x8aa888], [34, -38, 14, 0x6c8c6a], [-40, -36, 18, 0x86a484]]) {
        const hill = new THREE.Mesh(new THREE.SphereGeometry(s, 16, 8), std({ color: c, roughness: 1 })); hill.scale.y = 0.35; hill.position.set(x, -s * 0.15, z); g.add(hill);
      }
      const leaf = [0x6aa05a, 0x7bb264, 0x5a9050, 0x88bb70];
      const rb = rngOf(5);
      for (let k = 0; k < 14; k++) birch(g, -12.5 + k * 1.9 + rb() * 0.8, -9 - rb() * 4, 5 + rb() * 2.5, 100 + k, leaf);
      stands(g, { z0: -4.0, rows: 3, width: 9.5, dark: '#5a3a1a', light: '#a67a42' });
      const posts = [...serge(g, -3.5, -2.0), ...serge(g, 3.5, -2.0)];
      posts.forEach((m) => upd.push((t) => m.userData.update(t)));
      const cols = [0xd8582a, 0xf2c14e, 0x1f6f78, 0xf4efe0, 0x5876b8, 0x7a9a3a];
      const tri = new THREE.Shape(); tri.moveTo(-0.11, 0); tri.lineTo(0.11, 0); tri.lineTo(0, -0.26); tri.closePath();
      const triGeo = new THREE.ShapeGeometry(tri);
      const flags = [];
      for (let k = 0; k <= 26; k++) {
        const u = k / 26, x = -3.5 + 7.0 * u, y = 2.5 - 0.5 * (1 - Math.pow(2 * u - 1, 2));
        const f = new THREE.Mesh(triGeo, std({ color: cols[k % cols.length], side: THREE.DoubleSide, roughness: 0.9 }));
        f.position.set(x, y - 0.02, -1.88); g.add(f); f.userData.u = k; flags.push(f);
      }
      const rope = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(Array.from({ length: 12 }, (_, i) => { const u = i / 11; return new THREE.Vector3(-3.5 + 7.0 * u, 2.5 - 0.5 * (1 - Math.pow(2 * u - 1, 2)), -1.88); })), 30, 0.012, 5), std({ color: 0x3a2a1a }));
      g.add(rope);
      upd.push((t) => { for (const f of flags) { f.rotation.y = Math.sin(t * 2.1 + f.userData.u * 0.7) * 0.35; f.rotation.z = Math.sin(t * 1.3 + f.userData.u) * 0.06; } });
      for (let k = 0; k < 3; k++) {
        const b = bannerMesh(40 + k, ['#1f6f78', '#a8322a', '#2c5a3a'][k], ['#124a52', '#702018', '#173a24'][k], 0.9, 1.6, 0.08);
        b.position.set(-2.6 + k * 2.6, 3.9, -7.2); g.add(b); upd.push((t) => b.userData.update(t, 1.1));
      }
      const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot, color: 0xfff1c0, fog: false, depthWrite: false, transparent: true, opacity: 0.85 }));
      sun.scale.set(9, 9, 1); sun.position.set(14, 14, -42); g.add(sun);
    } else {
      const wallZ = id === 'winter' ? -9.4 : -11;
      const logM = std({ map: keep(tex(logCanvas(), { repeat: [3, 1] })), roughness: 0.78 });
      const darkM = std({ color: 0x1d2236, roughness: 0.6 });
      const nLogs = 17;
      for (let k = 0; k < nLogs; k++) {
        const log = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 26, 14), id === 'arena' ? darkM : logM);
        log.rotation.z = Math.PI / 2; log.position.set(0, 0.2 + k * 0.36, wallZ); g.add(log);
      }
      for (const sx of [-1, 1]) for (let k = 0; k < nLogs; k++) {
        const log = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 18, 12), id === 'arena' ? darkM : logM);
        log.rotation.x = Math.PI / 2; log.position.set(sx * 9.5, 0.2 + k * 0.36, -2); g.add(log);
      }
      stands(g, { z0: -4.0, rows: id === 'arena' ? 5 : 4, width: 12.5, dark: id === 'arena' ? '#2a1a10' : '#4a2e14', light: id === 'arena' ? '#6a4a2a' : '#8a5a2c' });
      const beamM = woodMat({ w: 256, h: 128, base: '#6a4220', dark: '#2a1608', seed: 61, planks: 2, knots: 0 }, {});
      for (let k = -3; k <= 3; k++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.34, 14), beamM); b.position.set(k * 2.8, 6.4, -3); g.add(b); }
      if (id === 'winter') {
        const c = cvs(256, 192), q = c.getContext('2d'), gr = q.createLinearGradient(0, 0, 0, 192);
        gr.addColorStop(0, '#9ab8d8'); gr.addColorStop(0.7, '#e8f0f6'); gr.addColorStop(1, '#f6f9fb'); q.fillStyle = gr; q.fillRect(0, 0, 256, 192);
        const r = rngOf(3);
        for (let k = 0; k < 9; k++) { const x = r() * 256, h = 50 + r() * 50; q.fillStyle = '#24493a'; q.beginPath(); q.moveTo(x, 192 - h); q.lineTo(x - 22, 192); q.lineTo(x + 22, 192); q.fill(); q.fillStyle = '#eef4f6'; q.beginPath(); q.moveTo(x, 192 - h); q.lineTo(x - 11, 192 - h * 0.55); q.lineTo(x + 11, 192 - h * 0.55); q.fill(); }
        for (let k = 0; k < 40; k++) { q.fillStyle = 'rgba(255,255,255,0.8)'; q.fillRect(r() * 256, r() * 192, 2, 2); }
        const winM = new THREE.MeshBasicMaterial({ map: keep(tex(c)), toneMapped: false, fog: false });
        const frM = std({ color: 0x2b1a0e });
        for (let k = -2; k <= 2; k++) {
          const w = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.3), winM); w.position.set(k * 3.6, 3.2, wallZ + 0.24); g.add(w);
          const fr = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.5, 0.1), frM); fr.position.set(k * 3.6, 3.2, wallZ + 0.18); g.add(fr);
          const m1 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.3, 0.04), frM); m1.position.set(k * 3.6, 3.2, wallZ + 0.3); g.add(m1);
          const m2 = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.06, 0.04), frM); m2.position.set(k * 3.6, 3.2, wallZ + 0.3); g.add(m2);
        }
      }
      const ban = id === 'winter' ? [['#a8322a', '#5a1810'], ['#1f6f78', '#124048'], ['#d8b25a', '#7a5a1a'], ['#2c5a3a', '#173a24']] : [['#7a2a8a', '#3a1244'], ['#1f5fae', '#0f2f5a'], ['#c8202a', '#600c12'], ['#d8b25a', '#7a5a1a']];
      for (let k = 0; k < 8; k++) {
        const c = ban[k % ban.length];
        const b = bannerMesh(60 + k * 3, c[0], c[1], 1.0, 2.2, 0.06);
        b.position.set(-8.4 + k * 2.4, 5.0, wallZ + 0.5); g.add(b); upd.push((t) => b.userData.update(t, 0.8));
      }
      const lampM = new THREE.MeshBasicMaterial({ color: id === 'arena' ? 0xcfe0ff : 0xffcf8a, toneMapped: false });
      const halos = [];
      for (const [lx, ly] of [[-4.2, 4.5], [0, 4.8], [4.2, 4.5]]) {
        const globe = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 10), lampM); globe.position.set(lx, ly, -1.0); g.add(globe);
        const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 6.0 - ly, 5), std({ color: 0x1a1a1a })); chain.position.set(lx, ly + (6.0 - ly) / 2, -1.0); g.add(chain);
        const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot, color: id === 'arena' ? 0x9ab8ff : 0xffb860, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
        halo.scale.set(2.2, 2.2, 1); halo.position.copy(globe.position); g.add(halo); halos.push(halo);
      }
      upd.push((t) => halos.forEach((hl, k) => { hl.material.opacity = 0.5 + 0.08 * Math.sin(t * 7.3 + k * 2) + 0.05 * Math.sin(t * 13.1 + k); }));
      if (id === 'arena') {
        const bc = cvs(8, 128), q = bc.getContext('2d'), gr = q.createLinearGradient(0, 0, 0, 128);
        gr.addColorStop(0, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); q.fillStyle = gr; q.fillRect(0, 0, 8, 128);
        const beamTex = keep(tex(bc, { aniso: 1 }));
        for (const [bx, rz] of [[-3.2, 0.22], [0, 0], [3.2, -0.22]]) {
          const cone = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 1.5, 6.4, 20, 1, true), new THREE.MeshBasicMaterial({ map: beamTex, color: 0xcfe0ff, transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false }));
          cone.position.set(bx, 3.3, -0.4); cone.rotation.z = rz; g.add(cone);
        }
        const ring = new THREE.Mesh(new THREE.RingGeometry(2.45, 2.55, 64), new THREE.MeshBasicMaterial({ color: 0x7fb4ff, transparent: true, opacity: 0.55, fog: false }));
        ring.rotation.x = -Math.PI / 2; ring.position.set(0, 0.014, 0); ring.scale.set(1.0, 0.62, 1); g.add(ring);
      }
    }
    return { group: g, upd };
  }

  // ---------------------------------------------------------------- crowd (instanced humans in Sakha dress)
  const CULT = V3.CULTURES;
  if (CULT && !CULT.sakha) {
    CULT.sakha = {
      skin: [['east', 6], ['fair', 2], ['olive', 1]], hair: [['black', 7], ['dkbrown', 2], ['grey', 1]],
      hats: [[7, 6], [0, 1], [8, 1.2], [3, 1]], womenHat: [[7, 5], [5, 2], [0, 1]],
      garment: [[2, 5], [1, 4], [0, 0.2]], womanGarment: [[2, 3], [1, 3], [3, 2]],
      top: ['#34506b', '#6e2e28', '#3f5a45', '#8a6a3a', '#d6cdb8', '#4a3a52', '#2a3c55', '#7a5230', '#5a4a3a', '#23364a'], bottom: ['#23262c', '#3a3329', '#2a3342', '#4a4036'],
      scarf: 0.4, patterns: [[0, 3], [1, 3], [3, 2]], flag: ['#a8322a', '#1f5a78', '#d8b25a'],
    };
  }
  let crowd = null;
  function makeCrowd(id, quality) {
    if (crowd) { try { crowd.dispose(); } catch { /* ignore */ } crowd = null; }
    try {
      const rows = id === 'arena' ? 5 : id === 'winter' ? 4 : 3, per = id === 'meadow' ? 24 : 30, width = id === 'meadow' ? 9.0 : 12.0;
      crowd = V3.createCrowd3d(stage, {
        stands: [{ center: [0, 0.2, -4.0], yaw: 0, rows, perRow: per, width, rise: 0.46, rowDepth: 0.8, curve: 0, focus: [0, 1.0, 0], standing: 0.12, fill: 0.92 }],
        seed: 17 + id.length, culture: 'sakha', quality: quality === 'low' ? 'low' : quality === 'medium' ? 'medium' : 'high', cold: HALL[id].cold, excitement: 0.25,
        props: { flag: 0, phone: 0.04, child: 0.05 }, kids: 0.1,
      });
    } catch (e) { console.warn('crowd3d unavailable', e); crowd = null; }
  }

  // ---------------------------------------------------------------- particles (dust under the hips, breath fog, snap sparks)
  const FX_N = 56;
  const fx = [];
  const fxGroup = new THREE.Group(); root.add(fxGroup);
  for (let i = 0; i < FX_N; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot, color: 0xffffff, transparent: true, opacity: 0, depthWrite: false, fog: false }));
    s.visible = false; fxGroup.add(s);
    fx.push({ s, life: 0, max: 1, vx: 0, vy: 0, vz: 0, size: 0.2, grow: 1, a: 0.5 });
  }
  let fxAt = 0;
  function emit(x, y, z, o = {}) {
    const p = fx[fxAt++ % FX_N];
    p.s.visible = true; p.s.position.set(x, y, z); p.life = 0; p.max = o.life ?? 0.9;
    p.vx = o.vx ?? 0; p.vy = o.vy ?? 0.1; p.vz = o.vz ?? 0; p.size = o.size ?? 0.2; p.grow = o.grow ?? 1.8; p.a = o.a ?? 0.45;
    p.s.material.color.set(o.color ?? 0xe8dcc0); p.s.material.blending = o.add ? THREE.AdditiveBlending : THREE.NormalBlending;
    p.s.scale.set(p.size, p.size, 1);
  }
  function stepFx(dt) {
    for (const p of fx) {
      if (!p.s.visible) continue;
      p.life += dt;
      if (p.life >= p.max) { p.s.visible = false; continue; }
      const u = p.life / p.max;
      p.s.position.x += p.vx * dt; p.s.position.y += p.vy * dt; p.s.position.z += p.vz * dt;
      p.vx *= 0.97; p.vz *= 0.97; p.vy *= 0.985;
      const sz = p.size * (1 + (p.grow - 1) * u);
      p.s.scale.set(sz, sz, 1);
      p.s.material.opacity = p.a * (u < 0.15 ? u / 0.15 : (1 - u) * 1.1);
    }
  }

  // ---------------------------------------------------------------- the API
  let cur = '', curBuild = null, curQ = 'high';
  function setHall(id, force = false, quality = curQ) {
    if (!HALL[id]) id = 'winter';
    if (id === cur && !force) return;
    if (curBuild) { root.remove(curBuild.group); curBuild.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }
    cur = id; curQ = quality;
    const H = HALL[id];
    curBuild = build(id);
    root.add(curBuild.group);
    stage.setLighting(H.light, { key: H.key, keyI: H.keyI, hemi: H.hemi, rim: H.rim, rimI: H.rimI, exposure: H.exposure });
    stage.setSky(H.sky, null);
    makeCrowd(id, quality);
    stage.invalidate();
  }

  // the stick from the sim (metres): centre, tilt, and how much it bows under load
  function setStick(c, ang, bow = 0) {
    stick.position.set(c.x, c.y, 0);
    stick.rotation.z = ang;
    const half = STICK_LEN / 2;
    for (const hd of holders) {
      const u = hd.userData.x / half;
      hd.position.set(hd.userData.x, -bow * (1 - u * u), 0);
      hd.rotation.z = Math.atan(2 * bow * u / half);
    }
  }

  function update(dt, t, o = {}) {
    if (curBuild) for (const f of curBuild.upd) f(t);
    if (crowd) { crowd.setExcitement(o.excite ?? 0.3); crowd.update(dt); }
    stepFx(dt);
  }

  return {
    root, setHall, update, setStick, emit, block, stick, mat, get hall() { return cur; },
    get crowd() { return crowd; },
    setQuality(q) { curQ = q; if (crowd) crowd.setQuality(q === 'low' ? 'low' : q === 'medium' ? 'medium' : 'high'); },
    cold() { return HALL[cur] ? HALL[cur].cold : false; },
    dispose() { for (const d of disposables) { try { d.dispose(); } catch { /* ignore */ } } if (crowd) crowd.dispose(); },
  };
}

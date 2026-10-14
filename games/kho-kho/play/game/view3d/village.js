// The village school ground round the court: whitewashed boundary wall with a marigold garland, wooden benches, a school verandah, neem
// trees, floodlight masts and a line of bunting. Metres, court centre at the origin, +x right, +z down (towards the viewer in portrait).
// Presentation only; nothing here is read back by the simulation.
import { THREE } from '../vendor3d/index.js';
import { plasterTexture, surroundTile, gritMap } from './ground.js';

const TAU = Math.PI * 2;
function lcg(seed) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }
const tex = (canvas, repeat = [1, 1], srgb = true) => {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); t.anisotropy = 4;
  return t;
};
const shadowed = (m, cast = true, recv = true) => { m.castShadow = cast; m.receiveShadow = recv; return m; };

/**
 * `half` = { x, z } the playing area half-extent in metres. Returns { group, update(t), setQuality(q), lamps[], bounds }.
 */
export function buildVillage({ half, quality = 'medium' }) {
  const group = new THREE.Group(); group.name = 'village';
  const R = lcg(11);
  const hx = half.x + 0.95, hz = half.z + 0.95;       // the wall ring
  const out = { group, hx, hz, lamps: [], flags: null, update() {}, setQuality() {} };

  // ---- ground all round: packed earth, tiled, with a grit bump so the low sun rakes it
  const surround = tex(surroundTile(512), [44, 44]);
  const bump = tex(gritMap(256), [176, 176], false);
  const ground = shadowed(new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshLambertMaterial({ map: surround, bumpMap: bump, bumpScale: 1.4, color: '#d8b9a0' })), false, true);
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.004; group.add(ground);

  // ---- boundary wall: whitewashed brick with a red-ochre dado and a rounded coping
  const plaster = tex(plasterTexture(256, 128), [4, 1]);
  const wallMat = new THREE.MeshStandardMaterial({ map: plaster, roughness: 0.92, color: '#fff6e6' });
  const dadoMat = new THREE.MeshStandardMaterial({ color: '#a8472b', roughness: 0.9 });
  const copeMat = new THREE.MeshStandardMaterial({ color: '#e9dfca', roughness: 0.85 });
  const WH = 0.46, WT = 0.24;
  const seg = (cx, cz, lx, lz) => {
    const w = new THREE.Mesh(new THREE.BoxGeometry(lx, WH * 0.8, lz), wallMat); w.position.set(cx, WH * 0.4 + 0.12, cz);
    const d = new THREE.Mesh(new THREE.BoxGeometry(lx + 0.02, 0.14, lz + 0.02), dadoMat); d.position.set(cx, 0.07, cz);
    const c = new THREE.Mesh(new THREE.BoxGeometry(lx + 0.06, 0.07, lz + 0.06), copeMat); c.position.set(cx, WH * 0.8 + 0.12 + 0.035, cz);
    for (const m of [w, d, c]) { shadowed(m, true, true); group.add(m); }
  };
  seg(0, -hz, 2 * hx + WT, WT); seg(0, hz, 2 * hx + WT, WT); seg(-hx, 0, WT, 2 * hz); seg(hx, 0, WT, 2 * hz);

  // ---- marigold garland draped along the coping (instanced beads, sagging between the posts)
  const beads = quality === 'low' ? 140 : 260;
  const gm = new THREE.InstancedMesh(new THREE.SphereGeometry(0.055, 8, 6), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.7 }), beads);
  const cols = ['#ff9a1f', '#ffb52e', '#ffc933', '#f27a12', '#ffd84a'];
  const m4 = new THREE.Matrix4(), c3 = new THREE.Color(), perim = 4 * (hx + hz);
  for (let i = 0; i < beads; i++) {
    let s = (i / beads) * perim * 2, x, z, side = 0;
    s %= perim;
    const w = 2 * hx, l = 2 * hz;
    if (s < w) { x = -hx + s; z = -hz; side = 0; } else if (s < w + l) { x = hx; z = -hz + (s - w); side = 1; } else if (s < 2 * w + l) { x = hx - (s - w - l); z = hz; side = 2; } else { x = -hx; z = hz - (s - 2 * w - l); side = 3; }
    const sag = Math.abs(Math.sin(s * 0.9)) * 0.06;
    m4.makeTranslation(x + (side === 1 ? 0.1 : side === 3 ? -0.1 : 0) + (R() - 0.5) * 0.04, WH * 0.8 + 0.18 - sag + (R() - 0.5) * 0.04, z + (side === 0 ? -0.1 : side === 2 ? 0.1 : 0) + (R() - 0.5) * 0.04);
    gm.setMatrixAt(i, m4); gm.setColorAt(i, c3.set(cols[(R() * cols.length) | 0]));
  }
  gm.castShadow = false; group.add(gm);

  // ---- wooden benches just outside the wall (the first row of spectators sits on them)
  const benchWood = new THREE.MeshStandardMaterial({ color: '#7a4a28', roughness: 0.78 });
  const bench = (cx, cz, len, alongX) => {
    const g = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(len, 0.05, 0.34), benchWood); seat.position.y = 0.42;
    g.add(seat);
    for (const t of [-0.45, 0.45]) { for (const s of [-1, 1]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.42, 0.06), benchWood); leg.position.set(t * len * 0.9, 0.21, s * 0.13); g.add(leg); } }
    g.traverse((m) => { if (m.isMesh) shadowed(m); });
    g.position.set(cx, 0, cz); if (!alongX) g.rotation.y = Math.PI / 2; group.add(g);
  };
  const BO = 0.75;
  bench(0, -hz - BO, 2 * hx * 0.9, true); bench(0, hz + BO, 2 * hx * 0.9, true);
  bench(-hx - BO, 0, 2 * hz * 0.72, false); bench(hx + BO, 0, 2 * hz * 0.72, false);
  out.benchOffset = BO;

  // ---- the school: a long verandah building at the far end
  {
    const g = new THREE.Group();
    const bw = 15, bh = 3.1, bd = 4.2;
    const wall = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), new THREE.MeshStandardMaterial({ map: tex(plasterTexture(256, 128, '#f6e9cc', 8), [5, 1]), roughness: 0.95, color: '#fff3dc' }));
    wall.position.y = bh / 2; g.add(wall);
    const dado = new THREE.Mesh(new THREE.BoxGeometry(bw + 0.04, 0.8, bd + 0.04), new THREE.MeshStandardMaterial({ color: '#2f6f8f', roughness: 0.9 })); dado.position.y = 0.4; g.add(dado);
    const tileCv = (() => { const c = globalThis.document.createElement('canvas'); c.width = 128; c.height = 128; const g = c.getContext('2d'); g.fillStyle = '#7a3018'; g.fillRect(0, 0, 128, 128); const r = lcg(4);
      for (let y = 0; y < 128; y += 8) for (let x = 0; x < 128; x += 8) { g.fillStyle = `rgba(${120 + (r() * 60 | 0)},${50 + (r() * 24 | 0)},${26},0.55)`; g.fillRect(x + 1, y + 1, 6, 6); }
      g.strokeStyle = 'rgba(40,16,8,0.5)'; g.lineWidth = 1; for (let x = 0; x <= 128; x += 8) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 128); g.stroke(); } return c; })();
    const roofMat = new THREE.MeshLambertMaterial({ map: tex(tileCv, [8, 3]), color: '#a85a3c' });
    const rw = bw + 1.2, rd = bd + 2.2, rh = 1.15;
    const prof = new THREE.Shape(); prof.moveTo(-rd / 2, 0); prof.lineTo(rd / 2, 0); prof.lineTo(0.35, rh); prof.lineTo(-0.35, rh); prof.closePath();
    const roofGeo = new THREE.ExtrudeGeometry(prof, { depth: rw, bevelEnabled: false }); roofGeo.translate(0, 0, -rw / 2); roofGeo.rotateY(Math.PI / 2);
    const roof = new THREE.Mesh(roofGeo, roofMat); roof.position.set(0, bh, 0.5); g.add(roof);
    // uv for the extrusion are in metres: repeat accordingly
    roofMat.map.repeat.set(1 / 1.2, 1 / 1.2);
    // verandah pillars and arched openings drawn as dark recesses with blue shutters
    const pillarMat = new THREE.MeshStandardMaterial({ color: '#eadfc6', roughness: 0.85 });
    for (let i = 0; i <= 8; i++) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, bh, 12), pillarMat); p.position.set(-bw / 2 + (bw * i) / 8, bh / 2, bd / 2 + 1.0); g.add(p); }
    const rail = new THREE.Mesh(new THREE.BoxGeometry(bw, 0.07, 0.07), pillarMat); rail.position.set(0, 0.95, bd / 2 + 1.0); g.add(rail);
    for (let i = 0; i < 7; i++) {
      const x = -bw / 2 + 1 + i * (bw - 2) / 6;
      const dark = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.9, 0.06), new THREE.MeshStandardMaterial({ color: '#1c1410', roughness: 1 })); dark.position.set(x, 1.55, bd / 2 + 0.02); g.add(dark);
      const sh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.8, 0.05), new THREE.MeshStandardMaterial({ color: '#2f78b5', roughness: 0.7 })); sh.position.set(x - 0.3, 1.55, bd / 2 + 0.07); g.add(sh);
      const sh2 = sh.clone(); sh2.position.x = x + 0.3; g.add(sh2);
    }
    // the floor of the verandah, a step lower than the roof shade
    const floor = new THREE.Mesh(new THREE.BoxGeometry(bw, 0.2, 2.2), new THREE.MeshStandardMaterial({ color: '#b9a78a', roughness: 0.95 })); floor.position.set(0, 0.1, bd / 2 + 1.1); g.add(floor);
    g.traverse((m) => { if (m.isMesh) shadowed(m, true, true); });
    g.position.set(0.5, 0, -hz - 5.6); out.school = g; group.add(g);
  }

  // ---- neem / banyan trees: lumpy lit canopies on forked trunks
  const trunkMat = new THREE.MeshStandardMaterial({ color: '#4d3622', roughness: 1 });
  const canopyGeo = (seed) => {
    const rr = lcg(seed), geo = new THREE.SphereGeometry(1, 16, 12), p = geo.attributes.position;
    const col = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      const n = Math.sin(x * 3.1 + seed) * Math.cos(z * 2.7 - seed) * 0.16 + Math.sin(y * 5.3 + x * 2.0) * 0.1 + (rr() - 0.5) * 0.05;
      const s = 1 + n; p.setXYZ(i, x * s, y * s * 0.82, z * s);
      const l = 0.55 + 0.45 * (y * 0.5 + 0.5) + n * 0.8;
      col[i * 3] = (0.05 + 0.10 * l); col[i * 3 + 1] = (0.12 + 0.20 * l); col[i * 3 + 2] = 0.035 + 0.05 * l;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.computeVertexNormals();
    return geo;
  };
  const canopyMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 });
  const tree = (x, z, s, seed) => {
    const g = new THREE.Group();
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.16 * s, 0.26 * s, 2.4 * s, 10), trunkMat); t.position.y = 1.2 * s; g.add(t);
    const rr = lcg(seed * 31 + 7);
    const lobes = [[0, 3.2, 0, 1.25], [0.95, 2.8, 0.3, 0.85], [-1.0, 2.9, -0.2, 0.9], [0.1, 3.9, -0.4, 0.8], [-0.3, 2.7, 1.0, 0.75], [0.7, 3.5, 0.7, 0.7], [-0.8, 3.6, 0.6, 0.65], [0.2, 2.4, -0.9, 0.7], [1.3, 3.2, -0.5, 0.6], [-1.3, 3.3, 0.4, 0.6]];
    lobes.forEach(([ox, oy, oz, rs], k) => {
      const c = new THREE.Mesh(canopyGeo(seed * 10 + k), canopyMat); c.scale.set(rs * s * (0.9 + rr() * 0.3), rs * s * (0.8 + rr() * 0.3), rs * s * (0.9 + rr() * 0.3)); c.position.set(ox * s, oy * s, oz * s); c.rotation.y = rr() * 6; g.add(c);
    });
    g.traverse((m) => { if (m.isMesh) shadowed(m, true, true); });
    g.position.set(x, 0, z); group.add(g);
  };
  tree(-hx - 4.6, -hz - 1.4, 1.25, 3); tree(hx + 4.9, -hz + 0.2, 1.05, 7); tree(-hx - 4.4, hz + 2.2, 1.0, 11); tree(hx + 4.6, hz + 3.4, 1.2, 5);
  if (quality !== 'low') { tree(-hx - 7.5, -2, 1.3, 13); tree(hx + 7.8, 1, 1.2, 17); }

  // ---- floodlight masts (the match is played at dusk) with warm glow
  const mastMat = new THREE.MeshStandardMaterial({ color: '#7d838c', roughness: 0.5, metalness: 0.6 });
  const lampMat = new THREE.MeshStandardMaterial({ color: '#fff6d8', emissive: '#ffe9ae', emissiveIntensity: 1.1, roughness: 0.4 });
  const housing = new THREE.MeshStandardMaterial({ color: '#2b2f36', roughness: 0.6, metalness: 0.5 });
  const glowCanvas = (() => { const c = globalThis.document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,240,190,0.95)'); gr.addColorStop(0.3, 'rgba(255,220,150,0.35)'); gr.addColorStop(1, 'rgba(255,200,120,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return c; })();
  const glowTex = new THREE.CanvasTexture(glowCanvas); glowTex.colorSpace = THREE.SRGBColorSpace;
  const mast = (x, z) => {
    const g = new THREE.Group();
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.11, 7.2, 10), mastMat); p.position.y = 3.6; g.add(p);
    const head = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.62, 0.16), housing); head.position.set(0, 7.3, 0); g.add(head);
    for (let i = 0; i < 6; i++) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.05, 14), lampMat); l.rotation.x = Math.PI / 2; l.position.set(-0.4 + (i % 3) * 0.4, 7.42 - Math.floor(i / 3) * 0.3, 0.1); g.add(l); }
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.55, toneMapped: false })); glow.scale.set(2.2, 2.2, 1); glow.position.set(0, 7.3, 0.4); g.add(glow);
    g.traverse((m) => { if (m.isMesh) shadowed(m, false, false); });
    g.position.set(x, 0, z); g.rotation.y = Math.atan2(-x, -z); group.add(g); out.lamps.push(g);
  };
  mast(-hx - 1.5, -hz - 1.4); mast(hx + 1.5, -hz - 1.4); mast(-hx - 1.5, hz + 1.4); mast(hx + 1.5, hz + 1.4);

  // ---- bunting between the masts: small pennants that flutter
  {
    const n = quality === 'low' ? 14 : 30, tri = new THREE.BufferGeometry();
    tri.setAttribute('position', new THREE.Float32BufferAttribute([-0.12, 0, 0, 0.12, 0, 0, 0, -0.26, 0], 3));
    tri.computeVertexNormals();
    // only the far side and the left side (what is 'far' on a portrait and on a landscape screen): a line on the near side would hang over the court
    const lines = [[-hx - 1.5, -hz - 1.4, hx + 1.5, -hz - 1.4], [-hx - 1.5, -hz - 1.4, -hx - 1.5, hz + 1.4]];
    const im = new THREE.InstancedMesh(tri, new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.8, side: THREE.DoubleSide }), n * lines.length);
    const pal = ['#ff5d73', '#ffd23f', '#3bd2c0', '#ff9f43', '#8e6cff', '#ffffff'];
    const base = []; let k = 0;
    for (const [x0, z0, x1, z1] of lines) for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n, sag = Math.sin(t * Math.PI) * 0.9;
      base.push({ x: x0 + (x1 - x0) * t, y: 6.7 - sag, z: z0 + (z1 - z0) * t, yaw: Math.atan2(x1 - x0, z1 - z0) + Math.PI / 2, ph: R() * TAU });
      im.setColorAt(k++, new THREE.Color(pal[(i + (R() * 2 | 0)) % pal.length]));
    }
    group.add(im);
    const o = new THREE.Object3D();
    out.update = (t) => {
      for (let i = 0; i < base.length; i++) {
        const b = base[i];
        o.position.set(b.x, b.y, b.z); o.rotation.set(Math.sin(t * 2.3 + b.ph) * 0.35, b.yaw, Math.sin(t * 1.7 + b.ph * 1.3) * 0.2); o.updateMatrix(); im.setMatrixAt(i, o.matrix);
      }
      im.instanceMatrix.needsUpdate = true;
    };
    out.flags = im;
    out.update(0);
  }
  return out;
}

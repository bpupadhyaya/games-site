// The village field of Bentengan in 3D: a mown lawn with chalk lines, two beaten-earth forts (rope ring on stakes, a tall wooden pole with a
// team pennant), two bamboo jail pens on straw, a bamboo fence, trees, thatched huts and hills. Everything is display only.
// World: metres, 34 court units to the metre. x east, y up, z south (court y grows toward +z); the human team's fort is at +z.
import { COURT, POLE, JAIL, FORT_R, JAIL_R, BOUNDS } from '../src/engine.js';

export const S = 34;                                   // court units per metre
export const wx = (X) => (X - COURT.w / 2) / S;
export const wz = (Y) => (Y - COURT.h / 2) / S;
export const cx = (x) => x * S + COURT.w / 2;          // world -> court
export const cz = (z) => z * S + COURT.h / 2;
const TAU = Math.PI * 2;
export const TEAM_COL = { H: { main: '#e8457f', dark: '#a8204f', light: '#ff9cc0', short: '#f3f3f3' }, C: { main: '#2b86dc', dark: '#134f93', light: '#9fd0ff', short: '#1d2c4d' } };
const hash = (i) => { let h = Math.imul(i | 0, 2654435761) ^ 0x9e3779b9; h = Math.imul(h ^ (h >>> 15), 2246822519); h ^= h >>> 13; return (h >>> 0) / 4294967296; };

function canvasTex(THREE, w, h, draw, { repeat = null, aniso = 8 } = {}) {
  const c = globalThis.document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = aniso;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  return t;
}

// Many small coloured pieces become ONE geometry (one draw call).
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

// ---------------------------------------------------------------- the painted ground (lawn, chalk, forts, jail floors)
function paintField(g, k) {   // k = pixels per court unit
  g.save(); g.scale(k, k);
  const r = (() => { let s = 31; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); })();
  const lawn = g.createLinearGradient(0, 0, 0, COURT.h); lawn.addColorStop(0, '#4fa83b'); lawn.addColorStop(0.5, '#5db747'); lawn.addColorStop(1, '#4a9d37');
  g.fillStyle = lawn; g.fillRect(0, 0, COURT.w, COURT.h);
  for (let i = 0; i < 12; i++) { g.fillStyle = i % 2 ? 'rgba(255,255,170,0.07)' : 'rgba(10,70,20,0.08)'; g.fillRect(0, i * 80, COURT.w, 80); }
  for (let i = 0; i < 5200; i++) { const light = r() > 0.45; g.fillStyle = light ? `rgba(220,255,150,${0.05 + r() * 0.12})` : `rgba(10,80,20,${0.05 + r() * 0.1})`; g.beginPath(); g.ellipse(r() * COURT.w, r() * COURT.h, 0.5 + r() * 1.4, 0.6 + r() * 3.2, r() * 3, 0, TAU); g.fill(); }
  for (let i = 0; i < 900; i++) { const x = 140 + r() * 440, y = 330 + r() * 300; g.fillStyle = `rgba(160,120,70,${0.02 + r() * 0.05})`; g.beginPath(); g.ellipse(x, y, 4 + r() * 18, 2 + r() * 8, r() * 3, 0, TAU); g.fill(); }
  // chalk: boundary, half-way line, centre circle
  g.lineCap = 'round'; g.strokeStyle = 'rgba(255,255,248,0.92)'; g.lineWidth = 3.4;
  g.beginPath(); g.rect(BOUNDS.x0, BOUNDS.y0, BOUNDS.x1 - BOUNDS.x0, BOUNDS.y1 - BOUNDS.y0); g.stroke();
  g.setLineDash([18, 14]); g.lineWidth = 2.6; g.strokeStyle = 'rgba(255,255,248,0.6)'; g.beginPath(); g.moveTo(BOUNDS.x0, COURT.h / 2); g.lineTo(BOUNDS.x1, COURT.h / 2); g.stroke(); g.setLineDash([]);
  g.beginPath(); g.arc(COURT.w / 2, COURT.h / 2, 46, 0, TAU); g.stroke();
  // forts: beaten earth
  for (const t of ['H', 'C']) {
    const p = POLE[t];
    const gr = g.createRadialGradient(p.x - 14, p.y - 14, 8, p.x, p.y, FORT_R + 8); gr.addColorStop(0, '#e2c08a'); gr.addColorStop(0.75, '#cfa765'); gr.addColorStop(0.93, '#b8914f'); gr.addColorStop(1, 'rgba(184,145,79,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(p.x, p.y, FORT_R + 8, 0, TAU); g.fill();
    for (let i = 0; i < 260; i++) { const a = r() * TAU, d = Math.sqrt(r()) * FORT_R; g.fillStyle = `rgba(110,70,30,${0.05 + r() * 0.12})`; g.beginPath(); g.ellipse(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d, 0.8 + r() * 2.2, 0.6 + r() * 1.6, r() * 3, 0, TAU); g.fill(); }
    g.fillStyle = 'rgba(120,80,40,0.35)'; g.beginPath(); g.arc(p.x, p.y, 16, 0, TAU); g.fill();
  }
  // jails: straw floor
  for (const t of ['H', 'C']) {
    const j = JAIL[t], s = JAIL_R * 0.95;
    const fl = g.createLinearGradient(j.x - s, j.y - s, j.x + s, j.y + s); fl.addColorStop(0, '#ead58f'); fl.addColorStop(1, '#c9ac5e');
    g.fillStyle = fl; g.fillRect(j.x - s, j.y - s, s * 2, s * 2);
    g.strokeStyle = 'rgba(120,90,20,0.45)'; g.lineWidth = 0.8;
    for (let i = 0; i < 90; i++) { const x = j.x - s + r() * s * 2, y = j.y - s + r() * s * 2, a = r() * 3; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * 9, y + Math.sin(a) * 9); g.stroke(); }
  }
  g.restore();
}

export function buildField(stage, THREE, { quality = 'high', icon = false } = {}) {
  const scene = stage.scene;
  const root = new THREE.Group(); scene.add(root);
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), Pv = new THREE.Vector3(), Sv = new THREE.Vector3(1, 1, 1);
  const mat = (x, y, z, sx = 1, sy = 1, sz = 1, ry = 0) => M.clone().compose(Pv.set(x, y, z), Q.setFromEuler(E.set(0, ry, 0)), Sv.set(sx, sy, sz));
  const UP = new THREE.Vector3(0, 1, 0), ONE = new THREE.Vector3(1, 1, 1);
  const cyl = (rt, rb, h, n = 8) => new THREE.CylinderGeometry(rt, rb, h, n, 1);
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const sph = (rad, a = 9, b = 7) => new THREE.SphereGeometry(rad, a, b);
  const items = [];
  const add = (geo, matrix, color, shade = 0.12) => items.push({ geo, matrix, color, shade });
  // a round bar between two ground points at height y
  const bar = (list, x0, z0, x1, z1, y, rr, color, shade = 0.08) => {
    const L = Math.hypot(x1 - x0, z1 - z0), dir = new THREE.Vector3(x1 - x0, 0, z1 - z0).normalize();
    list.push({ geo: cyl(rr, rr, L, 6), matrix: new THREE.Matrix4().compose(new THREE.Vector3((x0 + x1) / 2, y, (z0 + z1) / 2), new THREE.Quaternion().setFromUnitVectors(UP, dir), ONE), color, shade });
  };

  // ---- sky, haze
  scene.background = canvasTex(THREE, 8, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#3f86d6'); gr.addColorStop(0.5, '#86c3ee'); gr.addColorStop(0.85, '#d8edf5'); gr.addColorStop(1, '#eef7ee');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
  scene.fog = new THREE.Fog(0xcfe6ea, 40, 120);

  // ---- ground: surrounding grass + the painted field
  const outer = canvasTex(THREE, 512, 512, (g, w, h) => {
    g.fillStyle = '#4f9a3a'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 5000; i++) { const x = hash(i * 3) * w, y = hash(i * 3 + 1) * h, k = hash(i * 3 + 2); g.fillStyle = k < 0.45 ? 'rgba(30,100,35,0.35)' : k < 0.85 ? 'rgba(150,210,90,0.25)' : 'rgba(80,60,30,0.18)'; g.fillRect(x, y, 1.5 + k * 2, 2 + k * 6); }
  }, { repeat: [30, 30], aniso: quality === 'low' ? 2 : 8 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), new THREE.MeshStandardMaterial({ map: outer, roughness: 1, metalness: 0 }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(0, -0.012, 0); ground.receiveShadow = true; root.add(ground);
  // the painted lawn covers exactly the ground inside the fence (court x 10..710, y 52..928)
  const U0 = 10, U1 = 710, V0 = 52, V1 = 928;
  const res = quality === 'low' ? 0.9 : 1.5;
  const fieldTex = canvasTex(THREE, Math.round(COURT.w * res), Math.round(COURT.h * res), (g) => paintField(g, res), { aniso: quality === 'low' ? 2 : 8 });
  fieldTex.repeat.set((U1 - U0) / COURT.w, (V1 - V0) / COURT.h); fieldTex.offset.set(U0 / COURT.w, 1 - V1 / COURT.h);
  const field = new THREE.Mesh(new THREE.PlaneGeometry((U1 - U0) / S, (V1 - V0) / S), new THREE.MeshStandardMaterial({ map: fieldTex, roughness: 1, metalness: 0 }));
  field.position.set(wx((U0 + U1) / 2), 0, wz((V0 + V1) / 2));
  field.rotation.x = -Math.PI / 2; field.receiveShadow = true; field.position.y = 0.004; root.add(field);

  // ---- bamboo fence around the field
  const FX0 = wx(10), FX1 = wx(710), FZ0 = wz(52), FZ1 = wz(928), BAMB = '#dbc767', BAMB_D = '#9c8530';
  const post = (x, z, h = 1.15) => { add(cyl(0.045, 0.05, h, 7), mat(x, h / 2, z), BAMB); add(sph(0.05, 6, 4), mat(x, h, z), BAMB_D, 0.1); };
  const seg = (x0, z0, x1, z1, step = 1.25) => {
    const n = Math.max(1, Math.round(Math.hypot(x1 - x0, z1 - z0) / step));
    for (let i = 0; i <= n; i++) post(x0 + (x1 - x0) * i / n, z0 + (z1 - z0) * i / n);
    bar(items, x0, z0, x1, z1, 0.55, 0.03, BAMB_D); bar(items, x0, z0, x1, z1, 0.98, 0.03, BAMB_D);
  };
  seg(FX0, FZ0, FX1, FZ0); seg(FX0, FZ1, FX1, FZ1); seg(FX0, FZ0, FX0, FZ1); seg(FX1, FZ0, FX1, FZ1);

  // ---- trees, huts, hills beyond the fence
  const tree = (x, z, h, seed) => {
    add(cyl(0.12 * h / 4, 0.2 * h / 4, h * 0.45, 7), mat(x, h * 0.22, z), '#6b4a2a', 0.2);
    for (let i = 0; i < 6; i++) {
      const a = hash(seed * 9 + i) * TAU, d = hash(seed * 9 + i + 40) * h * 0.22, rr = h * (0.2 + hash(seed * 9 + i + 70) * 0.12);
      add(sph(rr, 8, 6), mat(x + Math.cos(a) * d, h * (0.55 + hash(seed * 7 + i) * 0.28), z + Math.sin(a) * d), i % 2 ? '#2f7d33' : '#3e9440', 0.25);
    }
  };
  const treeSpots = [[-13.5, -17.5, 6], [-9, -18, 5], [-4, -19, 5.5], [5, -18.5, 5], [10, -17.8, 6], [14, -17.5, 5.5], [-14.5, 17.5, 6], [-9.5, 18.5, 5], [9.5, 18.8, 5.5], [14, 17.5, 6],
    [-15.5, -6, 5], [-16, 5, 5.6], [15.8, -7, 5.4], [16.3, 4, 5], [-19, -12, 6.5], [19, 10, 6.5], [-18, 14, 6], [20, -13, 6.5]];
  treeSpots.forEach(([x, z, h], i) => { if ((quality === 'low' && i % 2) || (icon && (i < 6 || i > 9))) return; tree(x, z, h, i + 1); });
  const hut = (x, z, w, d, ry) => {
    add(box(w, 2.1, d), mat(x, 1.05, z, 1, 1, 1, ry), '#e9d9ab', 0.08);
    add(cyl(0.02, Math.hypot(w, d) * 0.72, 1.8, 4), mat(x, 3.0, z, 1, 1, 1, ry + Math.PI / 4), '#a98a3d', 0.2);
    add(box(0.55, 1.2, 0.06), mat(x, 0.6, z + d / 2 + 0.02, 1, 1, 1, 0), '#6b4a2a', 0.05);
  };
  if (!icon) { hut(-8, -22.5, 4.2, 3.4, 0.2); hut(-1.5, -24, 3.6, 3, -0.15); hut(7.5, -22, 4.4, 3.4, 0.1); hut(15, -23, 3.8, 3.2, -0.25); }
  const hill = (x, z, rx, ry, rz, col) => add(sph(1, 14, 8), mat(x, -0.1, z, rx, ry, rz), col, 0.04);
  hill(-30, -45, 30, 7, 14, '#4f9a52'); hill(14, -52, 36, 9, 14, '#5fa860'); hill(46, -42, 26, 6, 12, '#4b9250');
  const scenery = new THREE.Mesh(mergeColored(THREE, items), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 }));
  scenery.castShadow = quality !== 'low'; scenery.receiveShadow = true; root.add(scenery);

  // ---- forts (rope ring on stakes), poles with pennants, jail pens: per team, with team colour
  const flags = [];
  for (const t of ['H', 'C']) {
    const T = TEAM_COL[t], grp = new THREE.Group(); root.add(grp);
    const p = POLE[t], px = wx(p.x), pz = wz(p.y);
    const parts = [];
    const addp = (geo, matrix, color, shade = 0.1) => parts.push({ geo, matrix, color, shade });
    const R = FORT_R / S, nSt = 16;
    for (let i = 0; i < nSt; i++) {
      const a = i / nSt * TAU, x = px + Math.cos(a) * R, z = pz + Math.sin(a) * R;
      addp(cyl(0.035, 0.045, 0.42, 7), mat(x, 0.2, z), '#8a6a34', 0.2); addp(sph(0.045, 6, 4), mat(x, 0.43, z), T.main, 0.05);
      const a2 = (i + 1) / nSt * TAU, x2 = px + Math.cos(a2) * R, z2 = pz + Math.sin(a2) * R;
      bar(parts, x, z, x2, z2, 0.36, 0.02, '#f4efe0', 0.03); bar(parts, x, z, x2, z2, 0.22, 0.02, T.main, 0.03);
    }
    // the pole: a straight wooden pole with bamboo-style nodes, in a ring of stones
    addp(cyl(0.055, 0.075, 3.0, 9), mat(px, 1.5, pz), '#a67c3d', 0.2);
    for (let i = 1; i < 5; i++) addp(cyl(0.062, 0.062, 0.035, 9), mat(px, i * 0.6, pz), '#7a5726', 0.1);
    addp(sph(0.07, 8, 6), mat(px, 3.02, pz), '#d8b45a', 0.05);
    for (let i = 0; i < 9; i++) { const a = i / 9 * TAU; addp(sph(0.13, 6, 5), mat(px + Math.cos(a) * 0.32, 0.06, pz + Math.sin(a) * 0.32, 1, 0.6, 1), i % 2 ? '#a9a395' : '#8d877a', 0.25); }
    // jail pen: posts + two rails + slats, with a gate gap on the side toward the field centre
    const j = JAIL[t], jx = wx(j.x), jz = wz(j.y), hs = JAIL_R * 0.95 / S;
    const corners = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    const gapSide = t === 'H' ? 3 : 1;   // H jail is on the right: its left side (3) is open; C jail is on the left: its right side (1)
    corners.forEach(([sx, sz], i) => {
      const x = jx + sx * hs, z = jz + sz * hs;
      addp(cyl(0.05, 0.06, 1.35, 8), mat(x, 0.67, z), '#c9b25a', 0.15); addp(sph(0.07, 6, 5), mat(x, 1.36, z), T.main, 0.05);
      const nx = corners[(i + 1) % 4], x2 = jx + nx[0] * hs, z2 = jz + nx[1] * hs;
      if (i === gapSide) {
        for (const f of [0, 1]) for (const y of [0.45, 0.9]) {
          const a0 = f ? 0.78 : 0, a1 = f ? 1 : 0.22;
          bar(parts, x + (x2 - x) * a0, z + (z2 - z) * a0, x + (x2 - x) * a1, z + (z2 - z) * a1, y, 0.028, y > 0.6 ? T.main : '#c9b25a', 0.05);
        }
        return;
      }
      for (const y of [0.45, 0.9]) bar(parts, x, z, x2, z2, y, 0.028, y > 0.6 ? T.main : '#c9b25a', 0.05);
      for (let k = 1; k < 4; k++) addp(cyl(0.022, 0.022, 0.95, 6), mat(x + (x2 - x) * k / 4, 0.45, z + (z2 - z) * k / 4), '#d8c474', 0.1);
    });
    const mesh = new THREE.Mesh(mergeColored(THREE, parts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 }));
    mesh.castShadow = quality !== 'low'; mesh.receiveShadow = true; grp.add(mesh);
    // pennant: a cloth strip waving from the top of the pole, streaming toward +x
    const W = 0.85, Hh = 0.42, geo = new THREE.PlaneGeometry(W, Hh, 10, 1);
    const flag = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: T.dark, emissive: T.main, emissiveIntensity: 0.28, roughness: 0.8, metalness: 0, side: THREE.DoubleSide }));
    flag.castShadow = quality !== 'low'; flag.position.set(px + 0.06, 2.7, pz); if (icon) { flag.scale.set(1.5, 1.5, 1.5); flag.position.y = 2.55; flag.material.emissiveIntensity = 0.55; } grp.add(flag);
    flags.push({ geo, base: Float32Array.from(geo.attributes.position.array), phase: t === 'H' ? 0 : 1.7, W });
  }
  function update(t) {
    for (const d of flags) {
      const pos = d.geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const bx = d.base[i * 3], by = d.base[i * 3 + 1], u = (bx + d.W / 2) / d.W;   // 0 at the pole, 1 at the tip
        pos.setXYZ(i, d.W / 2 + bx, by * (1 - u * 0.55), Math.sin(t * 5 + d.phase - u * 6) * 0.1 * u + Math.sin(t * 2.1 + d.phase) * 0.05 * u);
      }
      pos.needsUpdate = true; d.geo.computeVertexNormals();
    }
  }
  update(0);
  return { root, update, S };
}

// Roadside furniture of the village lane, all procedural: cottages with brick/plaster walls and tiled roofs, hedgerows, trees, willows, reeds,
// gas lamps, market stalls, crates and barrels, sheds, bollards, stone walls, pines, poplars, banners. Each builder returns a THREE.Group
// made of a few merged meshes (one per material) and an optional per-frame `tick(t, wind)` for sway and flicker. Real-world sizes in metres.
import { tex, TILE, lcg } from './tex.js';

export function createPropKit(THREE) {
  const { Group, Mesh, BufferGeometry, Float32BufferAttribute, MeshLambertMaterial, MeshStandardMaterial, Matrix4, Vector3, Color, DoubleSide } = THREE;
  const M = {};
  const lam = (key, o) => (M[key] ||= new MeshLambertMaterial({ vertexColors: true, ...o }));
  const T = (n) => tex(THREE, n);

  // ---- geometry baking: parts are collected per material and merged into one mesh each -----------------------------------------------
  class Bake {
    constructor() { this.by = new Map(); }
    add(mat, geo, m4, color) {
      let e = this.by.get(mat); if (!e) { e = { pos: [], nor: [], uv: [], col: [] }; this.by.set(mat, e); }
      const g = geo.index ? geo.toNonIndexed() : geo.clone();
      if (m4) g.applyMatrix4(m4);
      const p = g.attributes.position.array, n = g.attributes.normal ? g.attributes.normal.array : null, u = g.attributes.uv ? g.attributes.uv.array : null;
      const cnt = p.length / 3, c = color ? new Color(color) : null;
      for (let i = 0; i < p.length; i++) e.pos.push(p[i]);
      for (let i = 0; i < cnt * 3; i++) e.nor.push(n ? n[i] : (i % 3 === 1 ? 1 : 0));
      for (let i = 0; i < cnt * 2; i++) e.uv.push(u ? u[i] : 0);
      for (let i = 0; i < cnt; i++) e.col.push(c ? c.r : 1, c ? c.g : 1, c ? c.b : 1);
      g.dispose();
    }
    build(group, { cast = true, receive = false } = {}) {
      for (const [mat, e] of this.by) {
        const g = new BufferGeometry();
        g.setAttribute('position', new Float32BufferAttribute(e.pos, 3)); g.setAttribute('normal', new Float32BufferAttribute(e.nor, 3));
        g.setAttribute('uv', new Float32BufferAttribute(e.uv, 2)); g.setAttribute('color', new Float32BufferAttribute(e.col, 3));
        const m = new Mesh(g, mat); m.castShadow = cast; m.receiveShadow = receive; group.add(m);
      }
      return group;
    }
  }
  const mx = (x = 0, y = 0, z = 0, ry = 0, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0) => {
    const m = new Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz)); m.scale(new Vector3(sx, sy, sz)); m.setPosition(x, y, z); return m;
  };
  // box with UVs in metres / TILE (so brick and tile texels have one size on every wall)
  function boxGeo(w, h, d, { top = true, bottom = false } = {}) {
    const pos = [], nor = [], uv = [];
    const face = (o, ax, ay, sx, sy, n) => {
      const a = [o[0], o[1], o[2]], b = [o[0] + ax[0] * sx, o[1] + ax[1] * sx, o[2] + ax[2] * sx], c = [b[0] + ay[0] * sy, b[1] + ay[1] * sy, b[2] + ay[2] * sy], d4 = [o[0] + ay[0] * sy, o[1] + ay[1] * sy, o[2] + ay[2] * sy];
      const U = (i, j) => [i * sx / TILE, j * sy / TILE];
      const q = [[a, U(0, 0)], [b, U(1, 0)], [c, U(1, 1)], [a, U(0, 0)], [c, U(1, 1)], [d4, U(0, 1)]];
      for (const [p, t] of q) { pos.push(...p); nor.push(...n); uv.push(...t); }
    };
    const x0 = -w / 2, x1 = w / 2, z0 = -d / 2, z1 = d / 2;
    face([x0, 0, z1], [1, 0, 0], [0, 1, 0], w, h, [0, 0, 1]);
    face([x1, 0, z0], [-1, 0, 0], [0, 1, 0], w, h, [0, 0, -1]);
    face([x1, 0, z1], [0, 0, -1], [0, 1, 0], d, h, [1, 0, 0]);
    face([x0, 0, z0], [0, 0, 1], [0, 1, 0], d, h, [-1, 0, 0]);
    if (top) face([x0, h, z1], [1, 0, 0], [0, 0, -1], w, d, [0, 1, 0]);
    if (bottom) face([x0, 0, z0], [1, 0, 0], [0, 0, 1], w, d, [0, -1, 0]);
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
    return g;
  }
  // gable roof: ridge along x. Returns slope geometry (tiles) and the two gable triangles (wall material)
  function roofGeos(w, d, rise, over = 0.3) {
    const W = w + over * 2, D = d + over * 2, hx = W / 2, hz = D / 2;
    const slope = [], sn = [], su = [], gab = [], gn = [], gu = [];
    const L = Math.hypot(hz, rise);
    const q = (a, b, c, d4, nrm) => { for (const [p, t] of [[a, [0, 0]], [b, [W / TILE, 0]], [c, [W / TILE, L / TILE]], [a, [0, 0]], [c, [W / TILE, L / TILE]], [d4, [0, L / TILE]]]) { slope.push(...p); sn.push(...nrm); su.push(...t); } };
    const nz = rise / L, ny = hz / L;
    q([-hx, 0, hz], [hx, 0, hz], [hx, rise, 0], [-hx, rise, 0], [0, ny, nz]);
    q([hx, 0, -hz], [-hx, 0, -hz], [-hx, rise, 0], [hx, rise, 0], [0, ny, -nz]);
    for (const sx of [-1, 1]) {
      const x = sx * (w / 2), gw = d / 2 * (1 - 0.0), nrm = [sx, 0, 0];
      const tri = sx > 0 ? [[x, 0, -gw], [x, 0, gw], [x, rise * (d / D), 0]] : [[x, 0, gw], [x, 0, -gw], [x, rise * (d / D), 0]];
      const uvs = [[0, 0], [d / TILE, 0], [d / 2 / TILE, rise * (d / D) / TILE]];
      tri.forEach((p, i) => { gab.push(...p); gn.push(...nrm); gu.push(...uvs[i]); });
    }
    const mk = (p, n, u) => { const g = new BufferGeometry(); g.setAttribute('position', new Float32BufferAttribute(p, 3)); g.setAttribute('normal', new Float32BufferAttribute(n, 3)); g.setAttribute('uv', new Float32BufferAttribute(u, 2)); return g; };
    return { slope: mk(slope, sn, su), gable: mk(gab, gn, gu) };
  }
  const sph = (r, ws = 10, hs = 8) => new THREE.SphereGeometry(r, ws, hs);
  const cyl = (rt, rb, h, s = 10) => new THREE.CylinderGeometry(rt, rb, h, s);
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);

  const mat = {
    brick: () => lam('brick', { map: T('brick') }),
    plaster: () => lam('plaster', { map: T('plaster') }),
    tiles: () => lam('tiles', { map: T('tiles'), side: DoubleSide }),
    wood: () => lam('wood', { map: T('wood') }),
    bark: () => lam('bark', { map: T('bark') }),
    stone: () => lam('stone', { map: T('cobble') }),
    hedge: () => lam('hedge', { map: T('hedge') }),
    flat: () => lam('flat', {}),
    glass: () => (M.glass ||= new MeshStandardMaterial({ color: 0x23394a, roughness: 0.25, metalness: 0.1, emissive: 0xffb255, emissiveIntensity: 0.35 })),
    iron: () => (M.iron ||= new MeshStandardMaterial({ color: 0x1d2024, roughness: 0.5, metalness: 0.7 })),
    lantern: () => (M.lantern ||= new MeshStandardMaterial({ color: 0xffe9a8, emissive: 0xffc860, emissiveIntensity: 1.1, roughness: 0.4 })),
    awning: () => lam('awning', { map: T('awning'), side: DoubleSide }),
  };
  const flat = (bk, geo, m4, color) => bk.add(mat.flat(), geo, m4, color);

  // ---- builders ------------------------------------------------------------------------------------------------------------------------
  const WALLS = [{ m: 'brick', c: 0xe6b8a0 }, { m: 'plaster', c: 0xf3ead6 }, { m: 'plaster', c: 0xeed9a8 }, { m: 'brick', c: 0xd9a58a }, { m: 'plaster', c: 0xdbe6e0 }];
  const ROOFS = [0xb86a5c, 0x7d8892, 0xa5624f, 0x5f6b78, 0xb07a4a];
  function house(R, kind) {
    const g = new Group(), bk = new Bake();
    const w = 3.8 + R() * 1.8, d = 3.0 + R() * 1.0, h = kind === 'shed' ? 2.0 : 2.6 + R() * 0.6, rise = kind === 'shed' ? 0.7 : 1.5 + R() * 0.4;
    const wall = kind === 'shed' ? { m: 'wood', c: 0xc9b79a } : WALLS[Math.floor(R() * WALLS.length)];
    bk.add(mat[wall.m](), boxGeo(w, h, d, { top: false }), null, wall.c);
    const roofC = kind === 'shed' ? 0x6b5a48 : ROOFS[Math.floor(R() * ROOFS.length)];
    const rg = roofGeos(w, d, rise, 0.32);
    bk.add(mat.tiles(), rg.slope, mx(0, h, 0), roofC);
    bk.add(mat[wall.m](), rg.gable, mx(0, h, 0), wall.c);
    // chimney stack with two pots
    if (kind !== 'shed') {
      const cx = (R() < 0.5 ? -1 : 1) * w * 0.28;
      bk.add(mat.brick(), boxGeo(0.5, 1.1, 0.5), mx(cx, h + rise * 0.55, -0.1), 0xc89078);
      flat(bk, cyl(0.1, 0.12, 0.3, 8), mx(cx - 0.12, h + rise * 0.55 + 1.2, -0.1), 0xb86a3c); flat(bk, cyl(0.1, 0.12, 0.3, 8), mx(cx + 0.12, h + rise * 0.55 + 1.2, -0.1), 0xb86a3c);
    }
    // door and windows on the +z (road side) wall
    const fz = d / 2 + 0.01;
    flat(bk, box(0.95, 1.9, 0.08), mx(-w * 0.2 + (R() - 0.5) * 0.4, 0.95, fz), kind === 'shed' ? 0x5a4630 : [0x2f5a4a, 0x6a2a2a, 0x2a3f6a, 0x4a3524][Math.floor(R() * 4)]);
    flat(bk, box(1.15, 0.12, 0.35), mx(-w * 0.2, 1.95, fz + 0.1), 0xece6d8);     // lintel
    flat(bk, box(1.1, 0.1, 0.5), mx(-w * 0.2, 0.05, fz + 0.2), 0xb8b2a4);        // step
    const win = (x, y) => {
      bk.add(mat.glass(), box(0.9, 0.9, 0.06), mx(x, y, fz + 0.01));
      flat(bk, box(1.08, 0.08, 0.12), mx(x, y + 0.5, fz + 0.04), 0xf4efe2); flat(bk, box(1.08, 0.08, 0.12), mx(x, y - 0.5, fz + 0.04), 0xf4efe2);
      flat(bk, box(0.08, 1.0, 0.12), mx(x - 0.5, y, fz + 0.04), 0xf4efe2); flat(bk, box(0.08, 1.0, 0.12), mx(x + 0.5, y, fz + 0.04), 0xf4efe2);
      flat(bk, box(0.05, 0.9, 0.1), mx(x, y, fz + 0.05), 0xf4efe2); flat(bk, box(0.9, 0.05, 0.1), mx(x, y, fz + 0.05), 0xf4efe2);
    };
    win(w * 0.22, 1.45);
    if (w > 4.6) win(w * 0.38 + 0.2 > w / 2 - 0.6 ? w * 0.36 : w * 0.38, 1.45);
    // window box with flowers or climbing roses
    if (kind !== 'shed' && R() < 0.7) {
      flat(bk, box(1.0, 0.18, 0.22), mx(w * 0.22, 0.88, fz + 0.15), 0x6a4a2c);
      for (let i = 0; i < 6; i++) flat(bk, sph(0.09 + R() * 0.03, 6, 5), mx(w * 0.22 - 0.4 + i * 0.16, 1.02 + R() * 0.06, fz + 0.15), [0xe34a5a, 0xffd24a, 0xf4f0e2, 0xff8fa8][Math.floor(R() * 4)]);
    }
    // front garden: low picket fence and a hedge
    if (kind !== 'shed') {
      const fy = 0.55, gz = d / 2 + 1.3, n = Math.round(w / 0.22);
      for (let i = 0; i <= n; i++) flat(bk, box(0.07, fy, 0.03), mx(-w / 2 + i * (w / n), fy / 2, gz), 0xf6f2e8);
      flat(bk, box(w, 0.06, 0.04), mx(0, 0.18, gz), 0xf6f2e8); flat(bk, box(w, 0.06, 0.04), mx(0, 0.42, gz), 0xf6f2e8);
    }
    bk.build(g, { cast: true, receive: false });
    g.userData.size = { w, d, h };
    return g;
  }
  function tree(R, kind) {
    const g = new Group(), bk = new Bake();
    const h = 3.2 + R() * 1.6, tw = 0.16 + R() * 0.08;
    bk.add(mat.bark(), cyl(tw * 0.7, tw, h * 0.62, 7), mx(0, h * 0.31, 0));
    const lc = [0x4f8a3a, 0x5d9a40, 0x3f7a35, 0x6aa648];
    const nb = kind === 'poplar' ? 5 : 5;
    for (let i = 0; i < nb; i++) {
      const a = R() * 6.28, rr = kind === 'poplar' ? 0.15 * R() : 0.7 * R(), y = kind === 'poplar' ? h * 0.35 + i * h * 0.15 : h * 0.62 + R() * 0.9;
      const s = kind === 'poplar' ? 0.5 + 0.25 * (1 - Math.abs(i - 2) / 3) : 0.95 + R() * 0.55;
      const geo = sph(1, 9, 7); const sc = kind === 'poplar' ? [s * 0.7, s * 1.4, s * 0.7] : [s, s * 0.82, s];
      flat(bk, geo, mx(Math.cos(a) * rr, y, Math.sin(a) * rr, 0, sc[0], sc[1], sc[2]), lc[Math.floor(R() * lc.length)]);
    }
    bk.build(g, { cast: true });
    g.userData.sway = 0.012 + R() * 0.01;
    return g;
  }
  function willow(R) {
    const g = new Group(), bk = new Bake();
    const h = 3.4 + R() * 0.8;
    bk.add(mat.bark(), cyl(0.14, 0.22, h * 0.6, 7), mx(0, h * 0.3, 0), 0xcab8a0);
    for (let i = 0; i < 4; i++) { const a = i * 1.7 + R(); flat(bk, sph(1, 8, 6), mx(Math.cos(a) * 0.5, h * 0.78 + R() * 0.3, Math.sin(a) * 0.5, 0, 1.2, 0.5, 1.2), 0x7fae58); }
    for (let i = 0; i < 26; i++) {      // hanging fronds
      const a = (i / 26) * 6.28 + R() * 0.3, rr = 0.9 + R() * 0.5, len = 1.6 + R() * 1.0;
      flat(bk, new THREE.CylinderGeometry(0, 0.07, len, 5), mx(Math.cos(a) * rr, h * 0.78 - len / 2 + 0.1, Math.sin(a) * rr, 0, 1, 1, 1, Math.PI), 0x8fbd62);
    }
    bk.build(g, { cast: true });
    g.userData.sway = 0.02;
    return g;
  }
  function hedge(R) {
    const g = new Group(), bk = new Bake();
    const len = 3 + R() * 3, n = Math.round(len / 0.8);
    for (let i = 0; i < n; i++) { const x = -len / 2 + (i + 0.5) * len / n; bk.add(mat.hedge(), sph(0.62 + R() * 0.12, 9, 6), mx(x, 0.45 + R() * 0.1, 0, 0, 1.15, 0.85, 0.95)); }
    bk.build(g, { cast: false });
    return g;
  }
  function lamp(R) {
    const g = new Group(), bk = new Bake();
    bk.add(mat.iron(), cyl(0.09, 0.15, 0.55, 8), mx(0, 0.28, 0));
    bk.add(mat.iron(), cyl(0.045, 0.06, 3.3, 8), mx(0, 2.0, 0));
    bk.add(mat.iron(), box(0.34, 0.08, 0.34), mx(0, 3.58, 0));
    bk.add(mat.lantern(), box(0.26, 0.4, 0.26), mx(0, 3.4, 0));
    bk.add(mat.iron(), new THREE.CylinderGeometry(0, 0.28, 0.2, 4), mx(0, 3.78, 0, Math.PI / 4));
    bk.add(mat.iron(), box(0.5, 0.04, 0.04), mx(0, 2.4, 0));
    bk.build(g, { cast: true });
    g.userData.glow = true;
    return g;
  }
  function stall(R) {
    const g = new Group(), bk = new Bake();
    const w = 2.4, d = 1.6;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) bk.add(mat.wood(), box(0.08, 2.3, 0.08), mx(sx * w / 2, 1.15, sz * d / 2));
    bk.add(mat.wood(), boxGeo(w, 0.9, 0.9), mx(0, 0, d / 2 - 0.5));
    const aw = new THREE.PlaneGeometry(w + 0.3, d + 0.5, 1, 1); aw.rotateX(-Math.PI / 2 + 0.22);
    bk.add(mat.awning(), aw, mx(0, 2.35, 0));
    const cols = [0xd8402c, 0xf2b630, 0x7fb83a, 0xe8873a];
    for (let i = 0; i < 9; i++) flat(bk, sph(0.1, 7, 5), mx(-0.9 + (i % 5) * 0.4 + (i > 4 ? 0.2 : 0), 0.98 + (i > 4 ? 0.12 : 0), d / 2 - 0.5 + (R() - 0.5) * 0.3), cols[(i + Math.floor(R() * 2)) % 4]);
    for (let i = 0; i < 2; i++) bk.add(mat.wood(), boxGeo(0.55, 0.45, 0.45), mx(-1.7 + i * 3.4, 0, 0.1 - i * 0.3, R() * 0.5));
    bk.build(g, { cast: true });
    return g;
  }
  function crate(R) {
    const g = new Group(), bk = new Bake();
    bk.add(mat.wood(), boxGeo(0.7, 0.6, 0.7), mx(0, 0, 0, R() * 0.6));
    bk.add(mat.wood(), boxGeo(0.62, 0.55, 0.62), mx(0.04, 0.6, 0.02, R() * 0.6));
    bk.add(mat.wood(), cyl(0.3, 0.3, 0.8, 12), mx(0.9, 0.4, 0.3));
    flat(bk, cyl(0.31, 0.31, 0.05, 12), mx(0.9, 0.2, 0.3), 0x2a2a2a); flat(bk, cyl(0.31, 0.31, 0.05, 12), mx(0.9, 0.6, 0.3), 0x2a2a2a);
    bk.build(g, { cast: true });
    return g;
  }
  function bollard(R) {
    const g = new Group(), bk = new Bake();
    bk.add(mat.iron(), cyl(0.12, 0.16, 0.7, 10), mx(0, 0.35, 0)); bk.add(mat.iron(), sph(0.13, 10, 6), mx(0, 0.72, 0));
    flat(bk, new THREE.TorusGeometry(0.14, 0.03, 6, 14), mx(0, 0.55, 0, 0, 1, 1, 1, Math.PI / 2), 0xb89a6a);
    bk.build(g, { cast: true });
    return g;
  }
  function rock(R) {
    const g = new Group(), bk = new Bake();
    bk.add(mat.stone(), new THREE.SphereGeometry(0.7 + R() * 0.4, 7, 5), mx(0, 0.3, 0, R() * 3, 1.2, 0.7, 1));
    bk.build(g, { cast: true });
    return g;
  }
  function stoneWall(R) {
    const g = new Group(), bk = new Bake();
    const len = 3.5 + R() * 2;
    bk.add(mat.stone(), boxGeo(len, 0.9, 0.5), mx(0, 0, 0), 0xcfc5b4);
    flat(bk, box(len + 0.05, 0.12, 0.58), mx(0, 0.95, 0), 0xa9a090);
    bk.build(g, { cast: true });
    return g;
  }
  function pine(R) {
    const g = new Group(), bk = new Bake();
    const h = 4 + R() * 2;
    bk.add(mat.bark(), cyl(0.12, 0.18, 1.2, 6), mx(0, 0.6, 0));
    for (let i = 0; i < 4; i++) flat(bk, new THREE.CylinderGeometry(0, 1.1 - i * 0.2, h * 0.34, 8), mx(0, 1.3 + i * h * 0.19, 0), [0x2f6a3a, 0x3a7a42, 0x2a5e34, 0x437f48][i]);
    bk.build(g, { cast: true });
    g.userData.sway = 0.01;
    return g;
  }
  function reed(R) {
    const g = new Group(), bk = new Bake();
    for (let i = 0; i < 16; i++) {
      const a = R() * 6.28, rr = R() * 0.4, h = 1.1 + R() * 0.9;
      flat(bk, new THREE.CylinderGeometry(0, 0.025, h, 4), mx(Math.cos(a) * rr, h / 2, Math.sin(a) * rr, 0, 1, 1, 1, (R() - 0.5) * 0.25, (R() - 0.5) * 0.25), 0x8a9a4a);
      if (R() < 0.4) flat(bk, cyl(0.04, 0.04, 0.22, 6), mx(Math.cos(a) * rr, h, Math.sin(a) * rr), 0x5a3a22);
    }
    bk.build(g, { cast: false });
    g.userData.sway = 0.04;
    return g;
  }
  function banner(R) {
    const g = new Group(), bk = new Bake();
    bk.add(mat.wood(), cyl(0.05, 0.06, 4.2, 6), mx(0, 2.1, 0));
    flat(bk, box(0.9, 0.5, 0.02), mx(0.47, 3.7, 0), [0xc9473a, 0xe6b23a, 0x2f7a8a][Math.floor(R() * 3)]);
    bk.build(g, { cast: true });
    return g;
  }
  function terrace(R) {   // a dry-stone terrace wall with a hawthorn on top
    const g = new Group(), bk = new Bake();
    const len = 4 + R() * 2;
    bk.add(mat.stone(), boxGeo(len, 1.1, 0.7), mx(0, 0, 0), 0xc4b8a2);
    for (let i = 0; i < 4; i++) bk.add(mat.hedge(), sph(0.55 + R() * 0.1, 8, 6), mx(-len / 2 + (i + 0.5) * len / 4, 1.35, 0, 0, 1.2, 0.8, 1));
    bk.build(g, { cast: true });
    return g;
  }

  const BUILDERS = { house: (R) => house(R, 'house'), shed: (R) => house(R, 'shed'), tree: (R) => tree(R, 'tree'), willow, bush: hedge, hedge, lamp, lantern: lamp, stall, crate, bollard, rock, pine, reed, bamboo: (R) => tree(R, 'poplar'), poplar: (R) => tree(R, 'poplar'), banner, terrace, wall: stoneWall, crowd: hedge };

  /** Build a prop of `kind` for `seed` (deterministic). */
  function build(kind, seed) {
    const R = lcg((seed * 7919 + 17) | 0);
    const fn = BUILDERS[kind] || BUILDERS.tree;
    return fn(R);
  }
  return { build, mat, Bake, boxGeo, mx, flat, sph, cyl, box, M };
}

// The village green as a real lit 3D scene: striped mown outfield, worn pitch strip with creases, rope on stakes with bunting on poles,
// a pavilion with veranda / clock turret / flag / tea table and urn, a church tower and spire, oaks, hedge, picnic benches, deck chairs
// with a seated crowd (shared crowd3d), cloud shadows drifting over the grass, dust and grass-clipping particles, a brass tea bell.
// Pure presentation: it never reads or writes the simulation. World metres (x across, y along the pitch, z up) map to three space as
// (x, z, -y); in landscape the whole static group is turned 90 degrees (the director places the people with the same mapping).
import { PITCH, FIELD_C, FIELD_R } from '../src/sim.js';

const TAU = Math.PI * 2;
const rng = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

export async function createGreen(V, stage, { quality = 'high' } = {}) {
  const T = V.THREE, doc = globalThis.document;
  const R = rng(20261013);
  const hi = quality === 'high', lo = quality === 'low';
  const aniso = Math.min(8, stage.renderer.capabilities.getMaxAnisotropy ? stage.renderer.capabilities.getMaxAnisotropy() : 4);
  const group = new T.Group(); group.name = 'green';
  const decals = new T.Group(); decals.name = 'decals';
  stage.add(group); stage.add(decals);
  const G = { group, land: false, t: 0, ready: false, shadowsOn: !!stage.renderer.shadowMap.enabled };
  const cx = FIELD_C.x, cy = FIELD_C.y;
  const Wpt = (x, y, z = 0) => new T.Vector3(x, z, -y);       // world -> three (portrait frame, local to the group)

  // ---------------------------------------------------------------- canvas textures
  const cv = (w, h) => { const c = doc.createElement('canvas'); c.width = w; c.height = h; return c; };
  const tex = (c, rep) => { const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.anisotropy = aniso; if (rep) { t.wrapS = t.wrapT = T.RepeatWrapping; t.repeat.set(rep[0], rep[1]); } return t; };
  const std = (o) => new T.MeshStandardMaterial({ roughness: 0.9, metalness: 0, ...o });

  // the mown outfield: bands 2.4 m apart across the pitch direction, fine blades, daisies, worn rope shade
  function grassCanvas(N) {
    const c = cv(N, N), g = c.getContext('2d'), SZ = 2 * (FIELD_R + 0.8), ppm = N / SZ, r = rng(7);
    const y0 = cy - SZ / 2, bw = 2.4;
    for (let row = 0; row < N; row++) {
      const y = y0 + (1 - row / N) * SZ, band = Math.floor((y - Math.floor(y0 / bw) * bw) / bw);
      g.fillStyle = band % 2 ? '#4c9a3a' : '#3d842f'; g.fillRect(0, row, N, 1);
    }
    // soft band edges: a slightly lighter lip where the mower turns
    g.globalAlpha = 0.5;
    for (let b = 0; b < SZ / bw + 1; b++) {
      const y = Math.floor(y0 / bw) * bw + b * bw, row = (1 - (y - y0) / SZ) * N;
      const gr = g.createLinearGradient(0, row - 5, 0, row + 5); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,230,0.12)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, row - 5, N, 10);
    }
    g.globalAlpha = 1;
    // blades: short strokes leaning with the mow direction
    const blades = hi ? 200000 : 80000;
    for (let i = 0; i < blades; i++) {
      const x = r() * N, y = r() * N, l = 1.5 + r() * 3 * ppm / 35, lean = (r() - 0.5) * 1.2;
      const lum = r();
      g.strokeStyle = lum < 0.4 ? 'rgba(15,60,15,0.3)' : lum < 0.8 ? 'rgba(110,180,70,0.2)' : 'rgba(190,220,120,0.16)';
      g.lineWidth = 1; g.beginPath(); g.moveTo(x, y); g.lineTo(x + lean * l * 0.4, y - l); g.stroke();
    }
    // daisies and clover heads
    for (let i = 0; i < 180; i++) {
      const x = r() * N, y = r() * N, d = (x - N / 2) ** 2 + (y - N / 2) ** 2;
      if (d > (N / 2) ** 2) continue;
      g.fillStyle = r() < 0.7 ? 'rgba(255,255,245,0.9)' : 'rgba(250,235,120,0.85)';
      g.beginPath(); g.arc(x, y, 1.1 + r() * 0.8, 0, TAU); g.fill();
    }
    // the rope's shade and the dry worn ring just inside it
    const rg = g.createRadialGradient(N / 2, N / 2, N * 0.34, N / 2, N / 2, N / 2);
    rg.addColorStop(0, 'rgba(0,30,0,0)'); rg.addColorStop(0.9, 'rgba(0,30,0,0.16)'); rg.addColorStop(1, 'rgba(0,25,0,0.3)');
    g.fillStyle = rg; g.fillRect(0, 0, N, N);
    return c;
  }
  const grassMat = std({ map: tex(grassCanvas(hi ? 2048 : 1024)), roughness: 0.95 });
  const field = new T.Mesh(new T.CircleGeometry(FIELD_R + 0.8, 96), grassMat);
  field.rotation.x = -Math.PI / 2; field.position.set(cx, 0, -cy); field.receiveShadow = true; group.add(field);

  // long grass beyond the rope
  {
    const c = cv(256, 256), g = c.getContext('2d'), r = rng(11);
    g.fillStyle = '#44822f'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 9000; i++) { const x = r() * 256, y = r() * 256, l = 3 + r() * 6; g.strokeStyle = r() < 0.5 ? 'rgba(20,60,15,0.4)' : 'rgba(170,200,90,0.3)'; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 3, y - l); g.stroke(); }
    const t = tex(c, [60, 60]);
    const meadow = new T.Mesh(new T.PlaneGeometry(420, 420), std({ map: t, roughness: 1 }));
    meadow.rotation.x = -Math.PI / 2; meadow.position.set(cx, -0.012, -cy); meadow.receiveShadow = true; group.add(meadow);
  }

  // the pitch strip with creases, worn ends and the dusty footholds
  {
    const W = 3.1, L = PITCH + 2.8, w = 384, h = Math.round(w * L / W);
    const c = cv(w, h), g = c.getContext('2d'), r = rng(23);
    const X = (x) => (x + W / 2) / W * w, Y = (y) => (1 - (y + 1.4) / L) * h;
    const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, '#7f9650'); gr.addColorStop(0.1, '#9aa862'); gr.addColorStop(0.9, '#9aa862'); gr.addColorStop(1, '#7f9650');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 26000; i++) { const x = r() * w, y = r() * h; g.fillStyle = r() < 0.5 ? 'rgba(60,85,30,0.2)' : 'rgba(200,205,130,0.18)'; g.fillRect(x, y, 1.2, 2 + r() * 2); }
    for (const yy of [0.9, PITCH - 0.9]) {            // worn dusty patches where the batter and the bowler land
      for (let k = 0; k < 7; k++) {
        const px = X((r() - 0.5) * 1.6), py = Y(yy + (r() - 0.5) * 1.6), rad = 20 + r() * 40;
        const rg = g.createRadialGradient(px, py, 0, px, py, rad); rg.addColorStop(0, 'rgba(160,125,75,0.55)'); rg.addColorStop(1, 'rgba(160,125,75,0)');
        g.fillStyle = rg; g.fillRect(px - rad, py - rad, rad * 2, rad * 2);
      }
    }
    const bowlY = 7.3;
    { const px = X(0.2), py = Y(bowlY), rad = 46; const rg = g.createRadialGradient(px, py, 0, px, py, rad); rg.addColorStop(0, 'rgba(150,115,70,0.5)'); rg.addColorStop(1, 'rgba(150,115,70,0)'); g.fillStyle = rg; g.fillRect(px - rad, py - rad, rad * 2, rad * 2); }
    g.strokeStyle = 'rgba(255,255,244,0.92)'; g.lineWidth = Math.max(3, w * 0.012); g.lineCap = 'round';
    for (const yy of [1.45, PITCH - 1.45]) { g.beginPath(); g.moveTo(X(-1.1), Y(yy)); g.lineTo(X(1.1), Y(yy)); g.stroke(); }
    const strip = new T.Mesh(new T.PlaneGeometry(W, L), std({ map: tex(c), roughness: 0.97 }));
    strip.rotation.x = -Math.PI / 2; strip.position.set(0, 0.004, -(-1.4 + L / 2)); strip.receiveShadow = true; group.add(strip);
  }

  // ---------------------------------------------------------------- baking helper: many coloured parts, one draw call
  class Bake {
    constructor() { this.p = []; this.n = []; this.c = []; }
    add(geo, m4, color, jit = 0.06) {
      const g = geo.index ? geo.toNonIndexed() : geo, pos = g.attributes.position, nor = g.attributes.normal;
      const nm = new T.Matrix3().getNormalMatrix(m4), v = new T.Vector3(), col = new T.Color(color);
      const k = 1 + (R() - 0.5) * 2 * jit; col.multiplyScalar(k);
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(m4); this.p.push(v.x, v.y, v.z);
        v.fromBufferAttribute(nor, i).applyMatrix3(nm).normalize(); this.n.push(v.x, v.y, v.z);
        this.c.push(col.r, col.g, col.b);
      }
    }
    mesh(mat) {
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(this.p, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(this.n, 3)); g.setAttribute('color', new T.Float32BufferAttribute(this.c, 3));
      const m = new T.Mesh(g, mat || std({ vertexColors: true })); m.frustumCulled = false; m.castShadow = true; m.receiveShadow = true; return m;
    }
  }
  const M4 = (x, y, z, ry = 0, sx = 1, sy = 1, sz = 1, rx = 0, rz = 0) => {
    const m = new T.Matrix4(), q = new T.Quaternion().setFromEuler(new T.Euler(rx, ry, rz)), s = new T.Vector3(sx, sy, sz);
    return m.compose(new T.Vector3(x, y, z), q, s);
  };
  const box = new T.BoxGeometry(1, 1, 1);
  const cyl = new T.CylinderGeometry(1, 1, 1, 10);
  const cone8 = new T.CylinderGeometry(0, 1, 1, 8);
  const sph = new T.SphereGeometry(1, hi ? 10 : 7, hi ? 8 : 5);
  // lumpy foliage clumps: spheres whose vertices are pushed in and out by a smooth pseudo-noise (6 variants)
  const lumps = [];
  for (let v = 0; v < 6; v++) {
    const g = new T.SphereGeometry(1, hi ? 12 : 8, hi ? 9 : 6), P = g.attributes.position, rr = rng(900 + v);
    const ph = [rr() * 6, rr() * 6, rr() * 6, rr() * 6];
    for (let i = 0; i < P.count; i++) {
      const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
      const n = Math.sin(x * 3.1 + ph[0]) * Math.sin(y * 2.7 + ph[1]) + Math.sin(z * 3.4 + ph[2]) * Math.cos(x * 2.3 + ph[3]);
      const k = 1 + 0.2 * n; P.setXYZ(i, x * k, y * k, z * k);
    }
    g.computeVertexNormals(); lumps.push(g);
  }
  let lumpN = 0; const lump = () => lumps[(lumpN++) % lumps.length];
  const addBox = (b, x, y, z, w, h, d, color, ry = 0, jit = 0.03) => b.add(box, M4(x, y + h / 2, z, ry, w, h, d), color, jit);

  // ---------------------------------------------------------------- shadows (decals on the grass, kept in the screen frame)
  const decalMat = new T.MeshBasicMaterial({ map: (() => { const c = cv(64, 64), g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 2, 32, 32, 32); gr.addColorStop(0, 'rgba(0,20,0,0.75)'); gr.addColorStop(0.55, 'rgba(0,20,0,0.35)'); gr.addColorStop(1, 'rgba(0,20,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new T.CanvasTexture(c); })(), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
  const dgeo = new T.PlaneGeometry(1, 1); dgeo.rotateX(-Math.PI / 2);
  const staticDecals = [];
  function addDecal(x, y, rx, ry, op = 1, ang = 0) {
    const m = new T.Mesh(dgeo, decalMat.clone()); m.material.opacity = op; m.renderOrder = 1; decals.add(m);
    staticDecals.push({ m, x, y, rx, ry, ang }); return m;
  }
  const SUN = Math.atan2(1.0, 1.1);                // shadows fall to the right and slightly away, in the screen frame
  function placeDecals() {
    for (const d of staticDecals) {
      const p = G.land ? new T.Vector3(-d.y, 0.02, -d.x) : new T.Vector3(d.x, 0.02, -d.y);
      d.m.visible = !G.shadowsOn;     // real shadows replace the painted ones
      d.m.position.copy(p); d.m.scale.set(d.rx * 2, 1, d.ry * 2); d.m.rotation.y = d.ang;
    }
  }

  // ---------------------------------------------------------------- rope on stakes, bunting on poles
  {
    const rope = new T.Mesh(new T.TorusGeometry(FIELD_R, 0.03, 6, 160), std({ color: 0xf6f1e2, roughness: 0.8 }));
    rope.rotation.x = Math.PI / 2; rope.position.set(cx, 0.36, -cy); group.add(rope);
    const b = new Bake(), nS = 64;
    for (let i = 0; i < nS; i++) { const a = (i / nS) * TAU, x = cx + Math.cos(a) * FIELD_R, y = cy + Math.sin(a) * FIELD_R; b.add(cyl, M4(x, 0.19, -y, 0, 0.035, 0.38, 0.035), 0xf3ead2, 0.02); }
    group.add(b.mesh());
  }
  const POLES = 16, FLAGS = 15, FLAG_N = POLES * FLAGS, buntingR = FIELD_R + 0.7, POLE_H = 3.3;
  const poleB = new Bake();
  const polePts = [];
  for (let i = 0; i < POLES; i++) {
    const a = (i / POLES) * TAU, x = cx + Math.cos(a) * buntingR, y = cy + Math.sin(a) * buntingR;
    polePts.push([x, y]);
    poleB.add(cyl, M4(x, POLE_H / 2, -y, 0, 0.05, POLE_H, 0.05), 0xf2efe6, 0.02);
    poleB.add(sph, M4(x, POLE_H + 0.04, -y, 0, 0.07, 0.07, 0.07), 0xe9c24a, 0);
    addDecal(x, y, 0.4, 0.3, 0.5, SUN);
  }
  group.add(poleB.mesh());
  const flagGeo = new T.BufferGeometry();
  flagGeo.setAttribute('position', new T.Float32BufferAttribute([-0.13, 0, 0, 0.13, 0, 0, 0, -0.3, 0], 3));
  flagGeo.setAttribute('normal', new T.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
  const flags = new T.InstancedMesh(flagGeo, std({ side: T.DoubleSide, roughness: 0.8 }), FLAG_N);
  flags.frustumCulled = false; group.add(flags);
  const FLAGCOL = ['#d8452e', '#f0c43a', '#3f8fd0', '#f7f2e2', '#4ea35a'];
  for (let i = 0; i < FLAG_N; i++) flags.setColorAt(i, new T.Color(FLAGCOL[i % FLAGCOL.length]));
  // the strings: catenary tubes between poles
  {
    const sb = new Bake();
    for (let i = 0; i < POLES; i++) {
      const [x0, y0] = polePts[i], [x1, y1] = polePts[(i + 1) % POLES];
      const seg = 10;
      for (let s = 0; s < seg; s++) {
        const u0 = s / seg, u1 = (s + 1) / seg, sag = (u) => -0.55 * 4 * u * (1 - u);
        const p0 = [x0 + (x1 - x0) * u0, POLE_H - 0.05 + sag(u0), -(y0 + (y1 - y0) * u0)], p1 = [x0 + (x1 - x0) * u1, POLE_H - 0.05 + sag(u1), -(y0 + (y1 - y0) * u1)];
        const dx = p1[0] - p0[0], dy = p1[1] - p0[1], dz = p1[2] - p0[2], len = Math.hypot(dx, dy, dz);
        const m = new T.Matrix4().lookAt(new T.Vector3(0, 0, 0), new T.Vector3(dx, dy, dz).normalize(), new T.Vector3(0, 1, 0));
        const q = new T.Quaternion().setFromRotationMatrix(m); q.multiply(new T.Quaternion().setFromEuler(new T.Euler(Math.PI / 2, 0, 0)));
        sb.add(cyl, new T.Matrix4().compose(new T.Vector3((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2, (p0[2] + p1[2]) / 2), q, new T.Vector3(0.012, len, 0.012)), 0xe8e0c8, 0);
      }
    }
    group.add(sb.mesh());
  }
  const _m = new T.Matrix4(), _q = new T.Quaternion(), _e = new T.Euler(), _p = new T.Vector3(), _s = new T.Vector3(1, 1, 1);
  function updateFlags(t) {
    let n = 0;
    for (let i = 0; i < POLES; i++) {
      const [x0, y0] = polePts[i], [x1, y1] = polePts[(i + 1) % POLES];
      for (let f = 0; f < FLAGS; f++, n++) {
        const u = (f + 0.5) / FLAGS, sag = -0.55 * 4 * u * (1 - u);
        _p.set(x0 + (x1 - x0) * u, POLE_H - 0.05 + sag, -(y0 + (y1 - y0) * u));
        const flutter = Math.sin(t * 3.1 + n * 0.9) * 0.35 + Math.sin(t * 1.3 + i) * 0.2;
        const yaw = Math.atan2(-(y1 - y0), x1 - x0);
        _e.set(0.0 + flutter * 0.6, -yaw + Math.PI / 2 + flutter * 0.25, flutter * 0.2);
        _q.setFromEuler(_e); _m.compose(_p, _q, _s); flags.setMatrixAt(n, _m);
      }
    }
    flags.instanceMatrix.needsUpdate = true;
  }

  // ---------------------------------------------------------------- pavilion with veranda, clock turret, flag, tea table and urn, brass bell
  const pavY = cy + FIELD_R + 8.5;
  const pav = new T.Group(); pav.position.set(0, 0, -pavY); group.add(pav);   // local +z faces the field
  let flagCloth = null, bellPivot = null, clockHand = null, urnSteam = null;
  {
    const b = new Bake();
    // foundation + walls (clapboard painted cream), the veranda deck, white posts, rails
    addBox(b, 0, 0, 0, 17, 0.45, 7, 0xb8b0a0);
    addBox(b, 0, 0.45, -0.6, 15, 3.4, 5, 0xf1e8cc);
    addBox(b, 0, 0.45, 2.7, 15.4, 0.22, 2.6, 0xc7a779);
    for (let i = 0; i < 8; i++) addBox(b, -7 + i * 2, 0.67, 3.8, 0.16, 2.6, 0.16, 0xfaf6ea);
    addBox(b, 0, 2.55, 3.85, 15.4, 0.1, 0.12, 0xfaf6ea); addBox(b, 0, 0.95, 3.85, 15.4, 0.08, 0.1, 0xfaf6ea);
    // door and windows (on the front wall at z = 1.9)
    addBox(b, 0, 0.67, 1.93, 1.5, 2.4, 0.06, 0x5b3a22);
    for (const wx of [-5.6, -3.4, 3.4, 5.6]) { addBox(b, wx, 1.35, 1.93, 1.3, 1.5, 0.07, 0xf8f4e6); addBox(b, wx, 1.45, 1.96, 1.1, 1.3, 0.06, 0x6f93a8); addBox(b, wx, 1.45, 1.98, 0.06, 1.3, 0.06, 0xf8f4e6); addBox(b, wx, 2.05, 1.98, 1.1, 0.06, 0.06, 0xf8f4e6); }
    // veranda roof (single slope) and main gable roof (extruded triangle along x)
    // gable ends (the two triangles of wall under the roof)
    const sh = new T.Shape(); sh.moveTo(-2.5, 0); sh.lineTo(2.5, 0); sh.lineTo(0, 2.1); sh.closePath();
    const gab = new T.ExtrudeGeometry(sh, { depth: 0.25, bevelEnabled: false });
    for (const sx of [-1, 1]) b.add(gab, M4(sx * 7.45, 3.85, -0.6, Math.PI / 2), 0xf1e8cc, 0.02);
    // clock turret
    addBox(b, 0, 5.8, -0.4, 2.4, 2.0, 2.4, 0xf4ecd4);
    b.add(cone8, M4(0, 8.9, -0.4, Math.PI / 8, 1.9, 2.0, 1.9), 0x7a2c1c, 0);
    b.add(cyl, M4(0, 9.9, -0.4, 0, 0.04, 1.2, 0.04), 0x3a3a3a, 0);
    b.add(box, M4(0.35, 10.35, -0.4, 0, 0.6, 0.18, 0.04), 0xd9a32a, 0);
    // chimney
    addBox(b, 5.4, 5.2, -1.4, 0.9, 1.7, 0.9, 0x9a5a44);
    // tea table with cloth, bench, hamper
    addBox(b, -3.2, 0.67, 5.6, 2.8, 0.85, 1.0, 0xf6f1e0);
    addBox(b, -3.2, 1.52, 5.6, 3.0, 0.05, 1.2, 0xe34a3b);
    for (let k = 0; k < 6; k++) b.add(cyl, M4(-4.3 + k * 0.4, 1.62, 5.6, 0, 0.1, 0.12, 0.1), k % 2 ? 0xf8f8f2 : 0x7fa8d0, 0);
    // cake stand
    b.add(cyl, M4(-2.0, 1.7, 5.6, 0, 0.18, 0.28, 0.18), 0xd9a96a, 0);
    group.add(pav);
    const m = b.mesh(); pav.add(m);
    // roof: two sloped slabs with a real tile texture, ridge cap
    {
      const c = cv(256, 128), g = c.getContext('2d'), r2 = rng(5);
      g.fillStyle = '#9b3d28'; g.fillRect(0, 0, 256, 128);
      for (let row = 0; row < 8; row++) for (let col = -1; col < 17; col++) {
        const x = col * 16 + (row % 2 ? 8 : 0), y = row * 16, v = (r2() - 0.5) * 34;
        g.fillStyle = `rgb(${Math.round(160 + v)},${Math.round(62 + v * 0.5)},${Math.round(40 + v * 0.4)})`; g.fillRect(x + 1, y + 1, 14, 15);
        g.fillStyle = 'rgba(40,10,0,0.5)'; g.fillRect(x, y + 14, 16, 2);
      }
      const rt = tex(c, [3, 1]);
      const rm = std({ map: rt, roughness: 0.8 });
      const tilt = Math.atan2(2.1, 3.1), slope = Math.hypot(3.1, 2.1) + 0.5;
      for (const sgn of [1, -1]) {
        const m2 = new T.Mesh(new T.BoxGeometry(16.6, 0.14, slope), rm);
        m2.position.set(0, 3.85 + 1.05 + 0.07, -0.6 + sgn * 1.55); m2.rotation.x = sgn * tilt; pav.add(m2);
      }
      const ridge = new T.Mesh(new T.BoxGeometry(16.7, 0.18, 0.34), std({ color: 0x6e2a1a })); ridge.position.set(0, 3.85 + 2.1 + 0.12, -0.6); pav.add(ridge);
      // veranda roof also tiled
      const vr = new T.Mesh(new T.BoxGeometry(15.8, 0.14, 3.4), rm); vr.position.set(0, 3.0, 3.1); vr.rotation.x = 0.2; pav.add(vr);
    }
    // a clock face (canvas) on the turret front
    const c = cv(128, 128), g = c.getContext('2d'); g.fillStyle = '#fbf6e4'; g.beginPath(); g.arc(64, 64, 60, 0, TAU); g.fill(); g.strokeStyle = '#2a2a2a'; g.lineWidth = 6; g.stroke();
    for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; g.beginPath(); g.moveTo(64 + Math.sin(a) * 50, 64 - Math.cos(a) * 50); g.lineTo(64 + Math.sin(a) * 58, 64 - Math.cos(a) * 58); g.lineWidth = 4; g.stroke(); }
    g.lineWidth = 6; g.beginPath(); g.moveTo(64, 64); g.lineTo(64, 24); g.stroke(); g.beginPath(); g.moveTo(64, 64); g.lineTo(90, 70); g.stroke();
    const face = new T.Mesh(new T.PlaneGeometry(1.5, 1.5), new T.MeshBasicMaterial({ map: tex(c) })); face.position.set(0, 5.95, 0.82); pav.add(face);
    // flag on a pole, waving cloth (CPU grid)
    const pole = new T.Mesh(new T.CylinderGeometry(0.05, 0.07, 9, 8), std({ color: 0xf0ece0 })); pole.position.set(-7.2, 4.5 + 3.9, -0.8); pav.add(pole);
    const fg = new T.PlaneGeometry(2.2, 1.3, 12, 5); const fm = new T.Mesh(fg, std({ color: 0xe8e2d0, side: T.DoubleSide, roughness: 0.7, map: (() => { const cc = cv(64, 32), gg = cc.getContext('2d'); gg.fillStyle = '#22406b'; gg.fillRect(0, 0, 64, 32); gg.fillStyle = '#f4ecd2'; gg.fillRect(0, 0, 64, 4); gg.fillRect(0, 28, 64, 4); gg.fillStyle = '#c23b2a'; gg.beginPath(); gg.arc(32, 16, 9, 0, 6.3); gg.fill(); gg.strokeStyle = '#f4ecd2'; gg.lineWidth = 1.6; gg.beginPath(); gg.arc(32, 16, 9, 0.3, 2.6); gg.stroke(); return tex(cc); })() }));
    fm.position.set(-7.2 + 1.1, 4.5 + 3.9 + 3.5, -0.8); pav.add(fm); flagCloth = { mesh: fm, base: Float32Array.from(fg.attributes.position.array) };
    // brass tea bell on a post by the veranda steps
    const post = new T.Mesh(new T.CylinderGeometry(0.06, 0.08, 1.6, 8), std({ color: 0x5a3a22 })); post.position.set(4.6, 0.8, 5.4); pav.add(post);
    const arm = new T.Mesh(new T.BoxGeometry(0.7, 0.06, 0.06), std({ color: 0x5a3a22 })); arm.position.set(4.6 + 0.3, 1.62, 5.4); pav.add(arm);
    bellPivot = new T.Group(); bellPivot.position.set(4.95, 1.6, 5.4); pav.add(bellPivot);
    const bell = new T.Mesh(V.board3d.lathe([[0.02, 0], [0.09, -0.04], [0.13, -0.16], [0.17, -0.24], [0.2, -0.27], [0.19, -0.27], [0.16, -0.23], [0.12, -0.15], [0.07, -0.06], [0.02, -0.03]], 20), V.board3d.material('brass'));
    bellPivot.add(bell);
    // the tea urn on the table, with a little steam
    const urn = new T.Mesh(V.board3d.lathe([[0.001, 0], [0.12, 0], [0.16, 0.05], [0.2, 0.2], [0.2, 0.42], [0.16, 0.52], [0.1, 0.55], [0.05, 0.6], [0.001, 0.62]], 22), V.board3d.material('brass', { roughness: 0.3, metalness: 0.9 }));
    urn.position.set(-3.8, 1.57, 5.6); pav.add(urn);
    urnSteam = new T.InstancedMesh(new T.SphereGeometry(0.07, 6, 5), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, depthWrite: false }), 8);
    urnSteam.frustumCulled = false; urnSteam.position.set(-3.8, 2.2, 5.6); pav.add(urnSteam);
    addDecal(0, pavY - 0.5, 10, 4.5, 0.55, SUN);
    G.bellWorld = { x: -(-4.6), y: pavY - 5.4 };
    clockHand = null;
  }

  // ---------------------------------------------------------------- the church tower and spire, oaks, hedge, benches, far tree line
  {
    const b = new Bake();
    const chx = -27, chy = cy + FIELD_R + 13;
    const st = 0xc8bda4;
    addBox(b, chx, 0, -chy, 7, 5.2, 14, st, 0, 0.04);
    const sh = new T.Shape(); sh.moveTo(-4, 0); sh.lineTo(4, 0); sh.lineTo(0, 3.6); sh.closePath();
    const rf = new T.ExtrudeGeometry(sh, { depth: 14.4, bevelEnabled: false }); rf.translate(0, 0, -7.2);
    b.add(rf, M4(chx, 5.2, -chy, 0), 0x4c5058, 0.03);
    addBox(b, chx, 0, -chy + 9, 5, 12.5, 5, 0xbfb398, 0, 0.04);
    addBox(b, chx, 12.5, -chy + 9, 5.4, 0.4, 5.4, 0xa89c82);
    for (const s of [-1, 1]) { addBox(b, chx + s * 2.2, 12.9, -chy + 9 + 2.2, 0.6, 0.7, 0.6, 0xa89c82); addBox(b, chx + s * 2.2, 12.9, -chy + 9 - 2.2, 0.6, 0.7, 0.6, 0xa89c82); }
    b.add(cone8, M4(chx, 13.0 + 5.5, -chy + 9, Math.PI / 8, 2.9, 11, 2.9), 0x5d636c, 0.02);
    b.add(cyl, M4(chx, 25.0, -chy + 9, 0, 0.04, 1.4, 0.04), 0x2e2e2e, 0);
    b.add(sph, M4(chx, 24.7, -chy + 9, 0, 0.16, 0.16, 0.16), 0xd9a32a, 0);
    // louvred belfry openings
    for (const s of [-1, 1]) addBox(b, chx + s * 0.0, 9.5, -chy + 11.55, 1.2, 2.0, 0.08, 0x2c2c2c);
    for (const [wx, wz] of [[-1.2, -3], [1.2, -3], [-1.2, 2], [1.2, 2]]) addBox(b, chx + wx + (wx < 0 ? -2.4 : 2.4), 1.4, -chy + wz, 0.1, 2.0, 0.8, 0x3d4a5a);
    addDecal(chx + 5, chy, 4.5, 11, 0.4, SUN);
    group.add(b.mesh());
  }
  {   // oaks, hedge and far tree line baked into two meshes
    const trees = new Bake(), hedge = new Bake(), far = new Bake();
    const oak = (x, y, s) => {
      trees.add(cyl, M4(x, 1.8 * s, -y, 0, 0.42 * s, 3.6 * s, 0.42 * s), 0x5b4531, 0.1);
      trees.add(cyl, M4(x, 0.25 * s, -y, 0, 0.8 * s, 0.5 * s, 0.8 * s), 0x4a3826, 0.05);
      // limbs
      for (let k = 0; k < 4; k++) { const a = k * 1.7 + R(); trees.add(cyl, M4(x + Math.cos(a) * 0.9 * s, 3.9 * s, -(y + Math.sin(a) * 0.9 * s), 0, 0.14 * s, 2.2 * s, 0.14 * s, Math.cos(a) * 0.5, Math.sin(a) * 0.5), 0x54402c, 0.05); }
      const n = hi ? 34 : 20;
      for (let i = 0; i < n; i++) {
        const a = R() * TAU, u = R(), rr = (0.6 + u * 3.2) * s, h = (4.2 + R() * 3.6) * s, rad = (1.0 + R() * 1.2) * s;
        const lum = 0.62 + 0.55 * ((h / s - 4.2) / 3.6) + (R() - 0.5) * 0.15;   // lighter on top, dark inside
        const base = [0x3b7a2a, 0x2f6a23, 0x467f2d, 0x336f26][Math.floor(R() * 4)];
        const c = new T.Color(base).multiplyScalar(lum);
        trees.add(lump(), M4(x + Math.cos(a) * rr, h, -(y + Math.sin(a) * rr), R() * 6, rad * 1.25, rad * 0.95, rad * 1.25), c, 0.0);
      }
      addDecal(x + 2.8 * s, y + 1.5 * s, 4.6 * s, 2.8 * s, 0.4, SUN);
    };
    const place = [[-17, cy + FIELD_R + 6, 1.2], [14, cy + FIELD_R + 7, 1.35], [28, cy + 20, 1.1], [-31, cy + 10, 1.25], [-33, cy - 8, 1.0], [33, cy - 6, 1.2], [30, cy + 28, 1.0], [-5, cy - FIELD_R - 6, 1.1], [18, cy - FIELD_R - 4, 1.0], [-20, cy - FIELD_R - 3, 1.15], [40, cy + 8, 1.4], [-42, cy + 2, 1.3]];
    for (const [x, y, s] of place) oak(x, y, s);
    // the hedge: a ring of rounded clumps just beyond the crowd, with a gap for the pavilion
    const nH = hi ? 110 : 70;
    for (let i = 0; i < nH; i++) {
      const a = (i / nH) * TAU + R() * 0.02, rr = FIELD_R + 6.5 + R() * 0.6;
      if (Math.abs(Math.atan2(Math.sin(a - Math.PI / 2), Math.cos(a - Math.PI / 2))) < 0.2) continue;
      const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr, rad = 1.1 + R() * 0.5;
      hedge.add(lump(), M4(x, rad * 0.8, -y, R() * 6, rad * 1.4, rad * 0.95, rad * 1.4), R() < 0.5 ? 0x2a5a24 : 0x3a8030, 0.12);
      if (R() < 0.15) hedge.add(sph, M4(x, rad * 1.6, -y, 0, rad * 0.5, rad * 0.5, rad * 0.5), 0xf0e6d0, 0.0);   // may blossom
    }
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * TAU, rr = FIELD_R + 24 + R() * 10;
      const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr, rad = 6 + R() * 4;
      far.add(lump(), M4(x, rad * 0.9, -y, R() * 6, rad * 1.5, rad, rad * 1.5), 0x2c5a30, 0.1);
    }
    group.add(trees.mesh(), hedge.mesh(), far.mesh());
  }

  // ---------------------------------------------------------------- picnic benches, rugs and deck chairs with a seated crowd
  const seats = [];       // { x, y, a }: spectator slots (world metres, a = facing yaw in three space)
  {
    const b = new Bake();
    const arcs = [[-2.6, -1.0], [0.9, 2.4], [-0.5, 0.5]];
    void arcs;
    const chair = (x, y, face, col) => {
      // a deck chair: wooden frame, striped sling; faces the field centre (face = yaw in three space)
      const c = Math.cos(face), s = Math.sin(face);
      const P = (lx, ly, lz) => [x + lx * c + lz * s, ly, -y - lx * -s * 0 + (-lx * s + lz * c) * 1 + 0];
      void P;
      const m = (lx, ly, lz, sx, sy, sz, rx = 0, color = 0xb8884e) => { b.add(box, new T.Matrix4().compose(new T.Vector3(x, 0, -y).add(new T.Vector3(lx, ly, lz).applyAxisAngle(new T.Vector3(0, 1, 0), face)), new T.Quaternion().setFromEuler(new T.Euler(rx, face, 0, 'YXZ')), new T.Vector3(sx, sy, sz)), color, 0.04); };
      m(-0.26, 0.2, -0.28, 0.04, 0.62, 0.04, 0.25); m(0.26, 0.2, -0.28, 0.04, 0.62, 0.04, 0.25);
      m(-0.26, 0.3, 0.2, 0.04, 0.7, 0.04, -0.55); m(0.26, 0.3, 0.2, 0.04, 0.7, 0.04, -0.55);
      // sling: 5 stripes, seat part low and back part rising behind
      for (let k = 0; k < 5; k++) {
        const sc = k % 2 ? col[1] : col[0];
        m(0, 0.38 + k * 0.002, 0.03 + (k - 2) * 0.07, 0.5, 0.012, 0.075, 0.0, sc);
        m(0, 0.55 + k * 0.1, -0.2 - k * 0.04, 0.5, 0.012, 0.075 + 0.0, -0.9, sc);
      }
    };
    const cols = [[0x2f6fb5, 0xf4efe0], [0xd9503a, 0xf6efdc], [0x3b9a5a, 0xf4efe0], [0xe2b93a, 0xf6efe4], [0x8a4aa8, 0xf4efe0]];
    // clusters of chairs along the rope, leaving the pavilion and the church sides open
    const nArcs = 16;
    for (let ai = 0; ai < nArcs; ai++) {
      const base = (ai / nArcs) * TAU + 0.2 + R() * 0.15;
      if (Math.abs(Math.atan2(Math.sin(base - Math.PI / 2), Math.cos(base - Math.PI / 2))) < 0.3) continue;   // the pavilion steps stay clear
      const count = 6 + Math.floor(R() * 5);
      for (let k = 0; k < count; k++) {
        const a = base + (k - count / 2) * 0.055, rr = FIELD_R + 1.9 + (k % 2) * 0.25 + R() * 0.15;
        const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
        const face = Math.atan2(cx - x, -(cy - y));
        chair(x, y, face, cols[(ai + k) % cols.length]);
        seats.push({ x, y, yaw: face, seated: 1 });
      }
    }
    // picnic benches with a rug and basket
    for (const a of [0.6, 2.4, 3.7, 5.2]) {
      const rr = FIELD_R + 3.6, x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr, face = Math.atan2(cx - x, -(cy - y));
      const mm = (lx, ly, lz, sx, sy, sz, color) => b.add(box, new T.Matrix4().compose(new T.Vector3(x, 0, -y).add(new T.Vector3(lx, ly, lz).applyAxisAngle(new T.Vector3(0, 1, 0), face)), new T.Quaternion().setFromEuler(new T.Euler(0, face, 0)), new T.Vector3(sx, sy, sz)), color, 0.04);
      mm(0, 0.72, 0, 1.8, 0.06, 0.7, 0x9a7048); mm(0, 0.42, 0.55, 1.8, 0.05, 0.28, 0x8a6240); mm(0, 0.42, -0.55, 1.8, 0.05, 0.28, 0x8a6240);
      for (const sx of [-0.75, 0.75]) { mm(sx, 0.35, 0, 0.07, 0.7, 0.9, 0x6e4e30); }
      mm(0, 0.76, 0.05, 0.5, 0.2, 0.34, 0xc9a35a);
      mm(1.8, 0.01, 0.2, 1.6, 0.02, 1.2, [0xd9503a, 0x3f6fb5, 0x3b9a5a][Math.floor(a) % 3]);
    }
    group.add(b.mesh());
  }

  // set dressing on the grass at the edges of the pitch view: the batting side's kit, a hamper and rug, the scorers' table, the roller
  {
    const b = new Bake();
    const at = (x, y, z, ry, sx, sy, sz, color, rx = 0, g = box) => b.add(g, M4(x, y, -z, ry, sx, sy, sz, rx), color, 0.05);
    // kit bags, folded jumpers, bottles (left edge, near the striker's end)
    at(-5.0, 0.16, 1.2, 0.3, 0.75, 0.32, 0.34, 0x24324a); at(-5.0, 0.34, 1.2, 0.3, 0.5, 0.04, 0.1, 0xd9c8a0);
    at(-4.55, 0.07, 2.1, 0.7, 0.5, 0.14, 0.4, 0xf1ead4); at(-4.5, 0.17, 2.1, 0.7, 0.4, 0.06, 0.3, 0xa8362b);
    for (const [dx, dz] of [[-5.3, 1.7], [-5.1, 1.9]]) at(dx, 0.13, dz, 0, 0.07, 0.26, 0.07, 0x4a8fd0, 0, cyl);
    at(-5.35, 0.09, 2.9, 0.2, 0.34, 0.18, 0.2, 0x7a5a30);                         // cap + stumps-bag
    // the hamper on a tartan rug (right edge)
    at(5.0, 0.01, 4.5, 0.2, 1.9, 0.02, 1.5, 0xc2402e); at(5.0, 0.012, 4.5, 0.2, 1.5, 0.02, 1.1, 0xf3e8c8);
    at(5.1, 0.2, 4.6, 0.2, 0.62, 0.38, 0.42, 0xb8884e); at(5.1, 0.42, 4.6, 0.2, 0.66, 0.05, 0.46, 0x9a6e3c);
    at(4.6, 0.04, 4.2, 0.3, 0.46, 0.04, 0.46, 0xe8dcb0, 0, cyl);                  // sun hat
    at(4.55, 0.1, 5.0, 0.4, 0.3, 0.2, 0.3, 0xd9503a);
    // scorers' table, scorebook and tea cups (left edge, mid pitch)
    at(-5.2, 0.7, 8.6, 0, 1.0, 0.05, 0.6, 0xc9a56e);
    for (const [dx, dz] of [[-0.42, -0.24], [0.42, -0.24], [-0.42, 0.24], [0.42, 0.24]]) at(-5.2 + dx, 0.35, 8.6 + dz, 0, 0.05, 0.7, 0.05, 0x8a6a40);
    at(-5.3, 0.74, 8.6, 0.2, 0.34, 0.03, 0.24, 0x2c4a7a); at(-5.0, 0.76, 8.5, 0, 0.07, 0.07, 0.07, 0xf8f4ea, 0, cyl);
    // the heavy roller (right edge, far end): a white cylinder on a short frame with a long handle
    b.add(cyl, M4(5.05, 0.34, -12.0, 0, 0.34, 0.8, 0.34, 0, Math.PI / 2), 0xe9e6dc, 0.03);
    at(5.05, 0.55, 12.0, 0, 0.1, 0.1, 0.9, 0x3b3b3b, 0.5);
    G.dressing = b.mesh(); group.add(G.dressing);
  }

  // crowd3d: seated spectators in the deck chairs plus standing ones along the rope. LOD comes from a proxy camera that matches the screen scale.
  let crowd = null, proxy = null;
  const crowdOpts = (q) => ({
    points: seats.map((s) => ({ x: s.x, y: 0, z: -s.y, yaw: s.yaw, seated: 1 })),
    ring: { center: [cx, 0, -cy], radius: FIELD_R + 1.1, rows: 1, rowGap: 1, count: lo ? 0 : 64, face: 'in' },
    culture: ['european_village'], seed: 17, quality: q === 'high' ? 'medium' : 'low', excitement: 0.2, props: { flag: 0.06, phone: 0.0, child: 0.07 }, flagColors: ['#d8452e', '#f7f2e2'],
  });
  try {
    proxy = new T.PerspectiveCamera(60, 1, 0.5, 400); proxy.position.set(cx, 90, -cy); proxy.up.set(0, 0, -1); proxy.lookAt(cx, 0, -cy); proxy.updateMatrixWorld(true);
    if (!lo) { crowd = V.createCrowd3d({ scene: group, camera: proxy }, { ...crowdOpts(quality), camera: proxy }); }
  } catch (e) { console.warn('stoolball: crowd3d unavailable', e); crowd = null; }

  // ---------------------------------------------------------------- cloud shadows drifting over the grass (visible on the pitch view too)
  const clouds = [];
  for (let i = 0; i < 6; i++) {
    const m = new T.Mesh(dgeo, decalMat.clone()); m.material.opacity = 0.13; m.renderOrder = 0; decals.add(m);
    clouds.push({ m, x: -50 + R() * 100 + cx, y: cy - 24 + R() * 48, rx: 7 + R() * 9, ry: 4 + R() * 6, v: 0.35 + R() * 0.7, rot: R() * Math.PI });
  }

  // ---------------------------------------------------------------- particles: dust puffs and grass clippings
  const NP = 64, parts = [];
  const dustMesh = new T.InstancedMesh(new T.SphereGeometry(1, 6, 5), new T.MeshBasicMaterial({ color: 0xcbb68a, transparent: true, opacity: 0.5, depthWrite: false }), NP);
  const grsMesh = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1), new T.MeshBasicMaterial({ color: 0x7cc050 }), NP);
  for (const m of [dustMesh, grsMesh]) { m.frustumCulled = false; m.count = NP; decals.add(m); }
  const zero = new T.Matrix4().makeScale(0, 0, 0);
  for (let i = 0; i < NP; i++) { dustMesh.setMatrixAt(i, zero); grsMesh.setMatrixAt(i, zero); }
  G.puff = (kind, x, y, z = 0.02, n = 4, vx = 0, vy = 0, sc = 1) => {
    for (let i = 0; i < n; i++) {
      const p = parts.find((q) => !q.live) || (parts.length < NP ? parts[parts.push({ live: false, k: 0 }) - 1] : null);
      if (!p) return;
      p.live = true; p.kind = kind; p.t = 0; p.life = kind === 'dust' ? 0.7 + R() * 0.4 : 0.7 + R() * 0.3;
      p.x = x + (R() - 0.5) * 0.25; p.y = y + (R() - 0.5) * 0.25; p.z = z + R() * 0.05;
      const sp = kind === 'dust' ? 0.5 : 2.2;
      p.vx = vx * 0.3 + (R() - 0.5) * sp; p.vy = vy * 0.3 + (R() - 0.5) * sp; p.vz = kind === 'dust' ? 0.25 + R() * 0.3 : 1.6 + R() * 1.8;
      p.s = (kind === 'dust' ? 0.09 : 0.016) * sc * (0.7 + R() * 0.7); p.slot = parts.indexOf(p);
    }
  };
  // ---------------------------------------------------------------- per-frame update
  const tv = new T.Vector3();
  const toT = (x, y, z) => (G.land ? tv.set(-y, z, -x) : tv.set(x, z, y * -1));
  G.update = (t, dt, camInfo) => {
    G.t = t;
    updateFlags(t);
    if (flagCloth) {
      const pos = flagCloth.mesh.geometry.attributes.position, b = flagCloth.base, w = 12 + 1;
      for (let i = 0; i < pos.count; i++) {
        const x0 = b[i * 3], y0 = b[i * 3 + 1], u = (x0 + 1.1) / 2.2;
        pos.setXYZ(i, x0 - 0.1 * u * Math.sin(t * 2 + u * 2), y0 + Math.sin(t * 4 - u * 5) * 0.05 * u, Math.sin(t * 5 - u * 7) * 0.22 * u + Math.sin(t * 2.3 + y0) * 0.05 * u);
      }
      pos.needsUpdate = true; flagCloth.mesh.geometry.computeVertexNormals();
      void w;
    }
    if (bellPivot) { const k = G.bellT; if (k !== undefined && k >= 0) { G.bellT += dt; const e = Math.exp(-G.bellT * 1.1); bellPivot.rotation.z = Math.sin(G.bellT * 22) * 0.55 * e; bellPivot.rotation.x = Math.sin(G.bellT * 19 + 1) * 0.2 * e; if (G.bellT > 5) { G.bellT = -1; bellPivot.rotation.set(0, 0, 0); } } }
    if (urnSteam) {
      for (let i = 0; i < 8; i++) {
        const u = ((t * 0.45 + i / 8) % 1);
        _p.set(Math.sin(u * 5 + i) * 0.08, u * 0.7, Math.cos(u * 4 + i) * 0.05); _s.setScalar(0.4 + u * 1.4 * (1 - u * 0.4));
        _m.compose(_p, _q.identity(), _s); urnSteam.setMatrixAt(i, _m);
      }
      urnSteam.instanceMatrix.needsUpdate = true;
    }
    // cloud shadows
    for (const c of clouds) {
      c.x += c.v * dt; if (c.x > cx + 55) c.x = cx - 55;
      const p = G.land ? tv.set(-c.y, 0.03, -c.x) : tv.set(c.x, 0.03, -c.y);
      c.m.position.copy(p); c.m.scale.set(c.rx * 2, 1, c.ry * 2); c.m.rotation.y = (G.land ? Math.PI / 2 : 0) + c.rot;
    }
    // particles
    let nd = 0, ng = 0;
    for (const p of parts) {
      if (!p.live) continue;
      p.t += dt; if (p.t >= p.life) { p.live = false; continue; }
      const u = p.t / p.life;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.kind === 'dust') { p.vx *= 1 - dt * 2; p.vy *= 1 - dt * 2; p.z += p.vz * dt * (1 - u); toT(p.x, p.y, p.z); const sc = p.s * (1 + u * 5) * (1 - u * 0.6); _m.compose(tv, _q.identity(), _s.setScalar(sc)); dustMesh.setMatrixAt(nd++, _m); }
      else { p.vz -= 9.8 * dt; p.z += p.vz * dt; if (p.z < 0.01) { p.z = 0.01; p.vz *= -0.2; p.vx *= 0.6; p.vy *= 0.6; } toT(p.x, p.y, p.z); const sc = p.s * (1 - u * 0.4); _q.setFromEuler(_e.set(p.t * 9, p.t * 7, 0)); _m.compose(tv, _q, _s.set(sc * 1.4, sc * 0.5, sc)); grsMesh.setMatrixAt(ng++, _m); }
    }
    dustMesh.count = nd; grsMesh.count = ng; dustMesh.instanceMatrix.needsUpdate = true; grsMesh.instanceMatrix.needsUpdate = true;
    if (crowd) {
      if (camInfo) {   // keep the proxy's pixels-per-metre equal to the screen's, so near/mid/far levels follow what is really visible
        const pxPerM = Math.max(2, camInfo.pxPerM), vh = camInfo.vh || 800, depth = 90;
        const tanH = vh / (2 * pxPerM * depth * 1.0);
        proxy.fov = 2 * Math.atan(tanH) * 180 / Math.PI; proxy.aspect = camInfo.aspect || 0.5; proxy.updateProjectionMatrix();
        proxy.position.set(cx, depth, -cy); proxy.lookAt(cx, 0, -cy); proxy.updateMatrixWorld(true);
      }
      crowd.update(dt, proxy);
    }
  };
  G.setLand = (land) => {
    G.land = land; group.rotation.y = land ? Math.PI / 2 : 0;
    placeDecals(); stage.invalidate();
  };
  G.ringBell = () => { G.bellT = 0; };
  G.react = (kind, intensity = 1) => { if (crowd) { try { crowd.react(kind, { origin: [cx, 0, -cy], radius: 120, intensity }); } catch { /* ignore */ } } };
  G.setExcitement = (v) => { if (crowd) { try { crowd.setExcitement(v); } catch { /* ignore */ } } };
  G.crowd = crowd;
  G.addDecal = addDecal;
  G.bellT = -1;
  group.traverse((o) => { if (o.isMesh && !o.userData.noShadow) { o.castShadow = true; } });
  G.setLand(false);
  G.ready = true;
  return G;
}

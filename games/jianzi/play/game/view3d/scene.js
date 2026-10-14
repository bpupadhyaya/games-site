// The courtyard as a real lit 3D set (game-owned). Units are metres; x lateral, y up, the park runs away from the viewer along -z
// (depth d = -z). Everything is procedural (canvas textures + simple solids), deterministic, and rebuilt per courtyard (YARDS in
// src/art.js). The presenter's projective camera (the 2D art's own pinhole map) looks at it, so the 2D marks still land exactly.
//
// Per courtyard: sky + hills, a back wall with a moon gate and a lattice window (or a river balustrade), tiled pavilion roofs on red
// pillars, a ginkgo (willow / bare tree), flagstones with a chalk circle, a stone bench, lanterns at dusk, snow in winter, drifting leaves.
// buildCourtyard(THREE).setYard(id) / .update(dt, t, wind) / .dispose().
import { YARDS } from '../src/art.js';

const TAU = Math.PI * 2;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
export const WALL_D = 7.4;          // depth of the back wall
export const BENCH_D = 6.45;        // the spectators' bench

function rnd(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const mix = (a, b, t) => a + (b - a) * t;
function hex(c) { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function shade(c, f) { const [r, g, b] = hex(c); const k = (v) => Math.max(0, Math.min(255, Math.round(v * f))); return `rgb(${k(r)},${k(g)},${k(b)})`; }
function hexMix(a, b, t) { const A = hex(a), B = hex(b); return '#' + [0, 1, 2].map((k) => Math.round(mix(A[k], B[k], t)).toString(16).padStart(2, '0')).join(''); }
function mixCol(a, b, t) { const A = hex(a), B = hex(b); return `rgb(${Math.round(mix(A[0], B[0], t))},${Math.round(mix(A[1], B[1], t))},${Math.round(mix(A[2], B[2], t))})`; }

export function buildCourtyard(THREE, { quality = 'medium' } = {}) {
  const doc = globalThis.document;
  const root = new THREE.Group(); root.name = 'courtyard';
  const dyn = { sway: [], lanterns: [], leaves: null, snow: null, water: null, clouds: null };
  let group = null, yardId = -1, texList = [];
  const low = quality === 'low';

  const canvasTex = (w, h, draw, rep = null, srgb = true) => {
    const c = doc.createElement('canvas'); c.width = w; c.height = h;
    draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); t.anisotropy = 4; }
    texList.push(t);
    return t;
  };
  const std = (color, rough = 0.85, metal = 0, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...o });

  // ---- textures -----------------------------------------------------------------------------------------------------------
  const flagstones = (Y) => canvasTex(512, 512, (g, w, h) => {
    const R = rnd(11), n = 4, sz = w / n;
    g.fillStyle = Y.floor[1]; g.fillRect(0, 0, w, h);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const t = 0.45 + R() * 0.3, f = 0.94 + R() * 0.12;
      g.fillStyle = shade(hexMix(Y.floor[0], Y.floor[1], t), f);
      g.fillRect(i * sz + 2, j * sz + 2, sz - 4, sz - 4);
      // grain, chips and a soft wear gradient
      for (let k = 0; k < 40; k++) { g.fillStyle = `rgba(${R() < 0.5 ? '255,255,255' : '40,30,20'},${0.03 + R() * 0.05})`; g.fillRect(i * sz + R() * sz, j * sz + R() * sz, 2 + R() * 7, 1 + R() * 3); }
      const gr = g.createLinearGradient(i * sz, j * sz, i * sz + sz, j * sz + sz);
      gr.addColorStop(0, 'rgba(255,255,255,0.10)'); gr.addColorStop(0.5, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(30,20,10,0.12)');
      g.fillStyle = gr; g.fillRect(i * sz + 2, j * sz + 2, sz - 4, sz - 4);
    }
    // joints with moss pockets
    g.strokeStyle = 'rgba(30,24,16,0.55)'; g.lineWidth = 3;
    for (let k = 0; k <= n; k++) { g.beginPath(); g.moveTo(k * sz, 0); g.lineTo(k * sz, h); g.stroke(); g.beginPath(); g.moveTo(0, k * sz); g.lineTo(w, k * sz); g.stroke(); }
    if (!Y.snow) for (let k = 0; k < 26; k++) { g.fillStyle = `rgba(${70 + R() * 30},${100 + R() * 40},50,${0.15 + R() * 0.2})`; const x = (R() * n | 0) * sz + (R() < 0.5 ? 0 : sz * 0.5), y = (R() * n | 0) * sz; g.fillRect(x + R() * sz * 0.5, y - 3, 10 + R() * 22, 7); }
    if (Y.snow) for (let k = 0; k < 20; k++) { g.fillStyle = `rgba(255,255,255,${0.35 + R() * 0.35})`; g.beginPath(); g.ellipse(R() * w, R() * h, 22 + R() * 40, 10 + R() * 18, 0, 0, TAU); g.fill(); }
  }, [15.5, 4.5]);

  const plaster = (Y) => canvasTex(512, 256, (g, w, h) => {
    const R = rnd(5);
    g.fillStyle = Y.wall; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(${R() < 0.5 ? '120,100,70' : '255,255,255'},${0.025 + R() * 0.04})`; g.fillRect(R() * w, R() * h * 0.9, 6 + R() * 40, 20 + R() * 90); }
    const gr = g.createLinearGradient(0, h * 0.75, 0, h);
    gr.addColorStop(0, 'rgba(60,70,50,0)'); gr.addColorStop(1, 'rgba(60,70,50,0.35)');
    g.fillStyle = gr; g.fillRect(0, h * 0.75, w, h * 0.25);
    // faint rain streaks under the coping
    for (let i = 0; i < 26; i++) { g.fillStyle = 'rgba(70,60,40,0.07)'; g.fillRect(R() * w, 0, 2 + R() * 3, 40 + R() * 120); }
  }, [10, 1]);

  const tiles = (Y) => canvasTex(256, 256, (g, w, h) => {
    const dark = Y.roof;
    g.fillStyle = dark; g.fillRect(0, 0, w, h);
    const n = 8;
    for (let i = 0; i < n; i++) {
      g.fillStyle = i % 2 ? shade(dark, 0.78) : shade(Y.roof2, 0.9);
      g.fillRect(i * w / n + 2, 0, w / n - 4, h);
      g.fillStyle = 'rgba(255,255,255,0.10)'; g.fillRect(i * w / n + 2, 0, 3, h);
    }
    for (let j = 0; j < 10; j++) { g.fillStyle = 'rgba(0,0,0,0.28)'; g.fillRect(0, j * h / 10, w, 3); }
  }, [1, 1]);

  const barkTex = (c) => canvasTex(128, 256, (g, w, h) => {
    const R = rnd(7); g.fillStyle = c; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 70; i++) { g.fillStyle = `rgba(${R() < 0.6 ? '20,12,6' : '200,170,130'},${0.07 + R() * 0.12})`; g.fillRect(R() * w, R() * h, 2 + R() * 3, 20 + R() * 80); }
  }, [1, 2]);

  const leafSprite = (Y) => canvasTex(64, 64, (g, w, h) => {
    // ginkgo fan: a wedge with a notch, pale so the instance colour tints it
    g.translate(w / 2, h * 0.92);
    g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, h * 0.82, -Math.PI * 0.86, -Math.PI * 0.14); g.closePath();
    const gr = g.createRadialGradient(0, 0, 4, 0, 0, h * 0.82); gr.addColorStop(0, '#d8c070'); gr.addColorStop(1, '#ffffff');
    g.fillStyle = gr; g.fill();
    g.strokeStyle = 'rgba(110,70,10,0.5)'; g.lineWidth = 1.2;
    for (let i = 0; i < 9; i++) { const a = -Math.PI * (0.16 + i * 0.085); g.beginPath(); g.moveTo(0, 0); g.lineTo(Math.cos(a) * h * 0.78, Math.sin(a) * h * 0.78); g.stroke(); }
    g.globalCompositeOperation = 'destination-out'; g.beginPath(); g.moveTo(0, -h * 0.84); g.lineTo(-4, -h * 0.6); g.lineTo(4, -h * 0.6); g.closePath(); g.fill();
  });

  const glowTex = () => canvasTex(64, 64, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 1, w / 2, h / 2, w / 2);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });

  const skyTex = (Y) => canvasTex(512, 1024, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, Y.sky[0]); gr.addColorStop(0.62, Y.sky[1]); gr.addColorStop(1, Y.sky[1]);
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    // sun / moon halo
    const sx = w * 0.74, sy = h * 0.22;
    const hg = g.createRadialGradient(sx, sy, 2, sx, sy, w * 0.55);
    hg.addColorStop(0, Y.night ? 'rgba(255,230,190,0.8)' : 'rgba(255,248,224,0.95)'); hg.addColorStop(0.18, Y.night ? 'rgba(255,214,160,0.35)' : 'rgba(255,240,200,0.45)'); hg.addColorStop(1, 'rgba(255,240,200,0)');
    g.fillStyle = hg; g.fillRect(0, 0, w, h);
    g.fillStyle = Y.sun; g.beginPath(); g.arc(sx, sy, w * 0.055, 0, TAU); g.fill();
    // a little noise breaks up gradient banding
    { const R = rnd(21); for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(255,255,255,${R() * 0.035})`; g.fillRect(R() * w, R() * h, 2, 2); } }
    if (Y.night) for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(255,255,255,${0.3 + R() * 0.5})`; g.fillRect(R() * w, R() * h * 0.45, 1.5, 1.5); }
  }, null);

  const ridge = (col, seed, amp, haze) => canvasTex(1024, 256, (g, w, h) => {
    const R = rnd(seed);
    const p1 = R() * 6, p2 = R() * 6, p3 = R() * 6;
    const gr = g.createLinearGradient(0, h * 0.2, 0, h);
    gr.addColorStop(0, col); gr.addColorStop(1, haze);
    g.fillStyle = gr; g.beginPath(); g.moveTo(0, h);
    for (let x = 0; x <= w; x += 4) { const u = x / w * TAU; g.lineTo(x, h * (0.55 - amp * (0.5 * Math.sin(u * 2 + p1) + 0.3 * Math.sin(u * 5 + p2) + 0.2 * Math.sin(u * 11 + p3)))); }
    g.lineTo(w, h); g.closePath(); g.fill();
  }, null);

  // ---- geometry helpers ---------------------------------------------------------------------------------------------------------
  const box = (w, h, d, mat, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); return m; };
  const cyl = (rt, rb, h, seg, mat, x, y, z) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat); m.position.set(x, y, z); return m; };

  function roofGeo(w, depth, h) {
    // a hip roof seen square-on: concave slopes (steep at the ridge, flat toward the eaves) with upswept eave tips; extruded along z
    const s = new THREE.Shape();
    const hw = w / 2 + 0.75, r = w * 0.16, eaveY = 0.22;
    const pts = [];
    const N = 14;
    for (let i = 0; i <= N; i++) { const u = i / N; const x = r + (hw - r) * u; const y = eaveY + (h - eaveY) * Math.pow(1 - u, 1.75) + 0.2 * Math.pow(u, 6); pts.push([x, y]); }
    // right side from the ridge to the eave tip, then back along the underside, then the left side
    s.moveTo(-r, h);
    s.lineTo(r, h);
    for (let i = 1; i <= N; i++) s.lineTo(pts[i][0], pts[i][1]);
    s.lineTo(hw - 0.08, pts[N][1] - 0.2);
    s.quadraticCurveTo(hw * 0.6, -0.05, hw * 0.2, -0.12);
    s.lineTo(-hw * 0.2, -0.12);
    s.quadraticCurveTo(-hw * 0.6, -0.05, -hw + 0.08, pts[N][1] - 0.2);
    for (let i = N; i >= 1; i--) s.lineTo(-pts[i][0], pts[i][1]);
    s.lineTo(-r, h);
    const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, steps: 1, curveSegments: 8 });
    g.translate(0, 0, -depth / 2);
    const pos = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) * 0.55, pos.getY(i) * 0.5 + pos.getZ(i) * 0.35);
    g.computeVertexNormals();
    return g;
  }

  function pavilion(Y, x, d, w, hRoof, withPillars) {
    const g = new THREE.Group();
    const pil = std(Y.accent === '#c8402c' ? '#9c2f22' : '#a8341f', 0.45, 0.05);
    const roofM = std(0xffffff, 0.7, 0.1, { map: tiles(Y) });
    const depth = 3.2, baseY = 2.35;
    const rg = new THREE.Mesh(roofGeo(w, depth, hRoof), roofM); rg.position.set(0, baseY, 0); rg.castShadow = true; g.add(rg);
    // ridge ornaments
    const orn = std('#c9a64a', 0.4, 0.5);
    for (const sx of [-1, 1]) { const o = box(0.18, 0.22, depth * 0.9, orn, sx * w * 0.115, baseY + hRoof, 0); g.add(o); }
    // ceiling band + beam + pillars
    const beam = box(w * 0.98, 0.26, depth * 0.96, std('#4a2a1c', 0.6), 0, baseY - 0.05, 0); g.add(beam);
    if (withPillars) {
      const n = 4;
      for (let i = 0; i < n; i++) { const px = (-w / 2 + 0.35) + i * ((w - 0.7) / (n - 1)); g.add(cyl(0.12, 0.13, baseY - 0.12, 12, pil, px, (baseY - 0.12) / 2, depth / 2 - 0.3)); }
      g.add(box(w * 0.9, 0.12, 0.2, std('#d9c38a', 0.5), 0, 0.5, depth / 2 - 0.3));
    }
    // back wall of the hall (lit when it is dusk)
    const back = box(w * 0.92, baseY - 0.2, 0.15, std(Y.night ? '#ffb455' : '#d9c8a2', 0.8, 0, Y.night ? { emissive: new THREE.Color('#ff9a3a'), emissiveIntensity: 0.55 } : {}), 0, (baseY - 0.2) / 2, -depth / 2 + 0.2);
    g.add(back);
    g.position.set(x, 0, -d);
    return g;
  }

  function ginkgo(Y, x, d, h, s = 1) {
    const g = new THREE.Group();
    const bark = std(0xffffff, 0.95, 0, { map: barkTex(Y.night ? '#2c2036' : '#5a4430') });
    const trunk = cyl(0.17 * s, 0.26 * s, h * 0.62, 10, bark, 0, h * 0.31, 0); trunk.rotation.z = 0.04; g.add(trunk);
    const limb = (ang, len, r, y) => { const l = cyl(r * 0.6, r, len, 7, bark, Math.sin(ang) * len * 0.42, y + Math.cos(ang) * len * 0.42, 0); l.rotation.z = -ang; g.add(l); };
    limb(0.7, 1.7 * s, 0.1 * s, h * 0.5); limb(-0.6, 1.6 * s, 0.09 * s, h * 0.54); limb(0.25, 1.3 * s, 0.08 * s, h * 0.58);
    if (Y.snow) {
      // bare tree with frost
      const twig = std('#6a5a50', 0.9);
      const R = rnd(3);
      for (let i = 0; i < 14; i++) { const a = (R() - 0.5) * 2.2, len = (0.9 + R() * 1.3) * s, y = h * (0.55 + R() * 0.35); const t = cyl(0.012, 0.04, len, 5, twig, Math.sin(a) * len * 0.45, y + Math.cos(a) * len * 0.45, (R() - 0.5) * 0.6); t.rotation.z = -a; g.add(t); }
      const frost = std('#f4f7fa', 0.9);
      for (let i = 0; i < 9; i++) { const s2 = new THREE.Mesh(new THREE.SphereGeometry((0.18 + R() * 0.2) * s, 8, 6), frost); s2.position.set((R() - 0.5) * 2.2 * s, h * (0.65 + R() * 0.3), (R() - 0.5) * 0.8); s2.scale.y = 0.55; g.add(s2); }
    } else {
      const R = rnd(9);
      const c0 = new THREE.Color(Y.tree[0]).multiplyScalar(0.85), c1 = new THREE.Color(Y.tree[1]).multiplyScalar(0.85), c2 = new THREE.Color(Y.tree[2]).multiplyScalar(0.6);
      const can = new THREE.Group(); can.position.y = h * 0.72; g.add(can);
      // a dark, smooth core so the crown has mass and no sky shows through the leaves
      const coreM = std(c0.clone().multiplyScalar(0.55), 0.9);
      for (let i = 0; i < (low ? 5 : 8); i++) {
        const r = (0.55 + R() * 0.4) * s, m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 10), coreM);
        const a = R() * TAU, rad = (0.1 + R() * 1.0) * s;
        m.position.set(Math.cos(a) * rad, (R() - 0.4) * 1.0 * s, Math.sin(a) * rad * 0.6); m.scale.set(1.2, 0.8, 1); can.add(m);
      }
      // thousands of fan leaves as ONE instanced mesh (one draw call): shell of the crown, facing roughly the viewer, three golds
      const nL = low ? 260 : 760;
      const lg = new THREE.PlaneGeometry(1, 1);
      const lm = new THREE.MeshStandardMaterial({ map: leafSprite(Y), alphaTest: 0.35, side: THREE.DoubleSide, roughness: 0.8, color: '#ffffff' });
      const inst = new THREE.InstancedMesh(lg, lm, nL);
      const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), Pn = new THREE.Vector3(), Sc = new THREE.Vector3(), col = new THREE.Color();
      for (let i = 0; i < nL; i++) {
        const u = R() * TAU, v = Math.acos(2 * R() - 1), rr = (1.0 + (R() - 0.5) * 0.5);
        Pn.set(Math.sin(v) * Math.cos(u) * 1.65 * s * rr, Math.cos(v) * 0.95 * s * rr - 0.1 * s, Math.sin(v) * Math.sin(u) * 0.95 * s * rr);
        E.set((R() - 0.5) * 1.0 - 0.2, (R() - 0.5) * 1.3, R() * TAU); Q.setFromEuler(E);
        const sz = (0.2 + R() * 0.12) * s; Sc.set(sz, sz, 1);
        M.compose(Pn, Q, Sc); inst.setMatrixAt(i, M);
        const k = R(); col.copy(k < 0.33 ? c0 : k < 0.66 ? c1 : c2).multiplyScalar(0.85 + R() * 0.3); inst.setColorAt(i, col);
      }
      inst.instanceMatrix.needsUpdate = true; if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
      can.add(inst);
      dyn.sway.push({ o: can, a: 0.012, f: 0.55, ph: x });
    }
    g.position.set(x, 0, -d);
    return g;
  }

  function willow(Y, x, d, h) {
    const g = new THREE.Group();
    const bark = std(0xffffff, 0.95, 0, { map: barkTex('#4a3b2a') });
    g.add(cyl(0.14, 0.22, h * 0.6, 9, bark, 0, h * 0.3, 0));
    const R = rnd(31), leaf = std(Y.tree[2], 0.85), leaf2 = std(Y.tree[0], 0.85);
    const can = new THREE.Group(); can.position.y = h * 0.62; g.add(can);
    for (let i = 0; i < 3; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(0.9, 9, 7), i ? leaf2 : leaf); m.position.set((i - 1) * 0.8, i === 1 ? 0.3 : 0, 0); m.scale.set(1.3, 0.7, 1); can.add(m); }
    const n = low ? 14 : 30;
    for (let i = 0; i < n; i++) {
      const a = R() * TAU, r = 0.7 + R() * 1.0, len = 1.6 + R() * 1.2;
      const s = cyl(0.02, 0.05, len, 4, i % 2 ? leaf : leaf2, Math.cos(a) * r, -len / 2 + 0.2, Math.sin(a) * r * 0.5);
      s.scale.x = 2.2; can.add(s);
    }
    dyn.sway.push({ o: can, a: 0.02, f: 0.7, ph: x });
    g.position.set(x, 0, -d);
    return g;
  }

  function lantern(x, y, d, col = '#e8572a') {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 10), std(col, 0.5, 0, { emissive: new THREE.Color(col), emissiveIntensity: 1.3 }));
    body.scale.set(1, 1.25, 1); g.add(body);
    const cap = std('#2a1a1a', 0.6);
    g.add(cyl(0.1, 0.1, 0.05, 10, cap, 0, 0.33, 0)); g.add(cyl(0.09, 0.09, 0.05, 10, cap, 0, -0.33, 0));
    const tas = cyl(0.012, 0.03, 0.22, 5, std('#d9a441', 0.5), 0, -0.47, 0); g.add(tas);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: '#ffb35c', transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.scale.set(1.5, 1.5, 1); g.add(glow);
    const wrap = new THREE.Group(); wrap.add(g); g.position.y = -0.0;
    wrap.position.set(x, y, -d);
    dyn.lanterns.push({ o: wrap, ph: x * 1.7 });
    return wrap;
  }

  // ---- build one courtyard -------------------------------------------------------------------------------------------------------
  function build(Y) {
    const G = new THREE.Group();
    texList.forEach((t) => t.dispose()); texList = [];
    // sky: a screen-space backdrop
    const sk = skyTex(Y);
    G.userData.background = sk;
    // hills, two layers, hazy
    const hillCols = [Y.far, Y.mid];
    hillCols.forEach((c, i) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(130, 16 - i * 4), new THREE.MeshBasicMaterial({ map: ridge(c, 40 + i * 17, 0.5, Y.sky[1]), transparent: true, fog: false, depthWrite: false, opacity: i ? 0.95 : 0.8 }));
      m.position.set(0, (11 - i * 2.5), -(62 - i * 14)); G.add(m);
    });
    // cloud banks: soft puffs far behind the roofs
    {
      const R = rnd(33);
      const cloud = canvasTex(256, 128, (g, w, h) => {
        for (let i = 0; i < 14; i++) { const x = w * (0.2 + 0.6 * R()), y = h * (0.42 + 0.16 * R()), r = h * (0.16 + 0.14 * R()); const gr = g.createRadialGradient(x, y, 1, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }
      });
      const tone = Y.night ? '#7a6a96' : Y.snow ? '#ffffff' : '#fff4e2';
      for (let i = 0; i < 6; i++) {
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloud, color: tone, transparent: true, opacity: Y.night ? 0.5 : 0.8, depthWrite: false, fog: false }));
        sp.position.set(-40 + i * 17 + R() * 6, 16 + R() * 14, -(55 + R() * 8)); sp.scale.set(30 + R() * 14, 12 + R() * 5, 1); G.add(sp);
      }
    }
    // ground: flagstone court in front of the wall, garden grass behind it
    const fm = std(0xffffff, 0.92, 0, { map: flagstones(Y) });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(56, WALL_D + 9), fm);
    floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, (9 - WALL_D) / 2); floor.receiveShadow = true; G.add(floor);
    const gardenCol = Y.snow ? '#e8eef2' : Y.night ? '#2c3a3a' : Y.water ? '#6aa66a' : '#7f9a5a';
    const garden = new THREE.Mesh(new THREE.PlaneGeometry(200, 60), std(gardenCol, 1));
    garden.rotation.x = -Math.PI / 2; garden.position.set(0, -0.01, -(WALL_D + 30)); G.add(garden);

    // chalk circle is added by the presenter (it changes between solo and circle)

    // wall with a moon gate and a lattice window, or a low river balustrade
    const plasterM = std(0xffffff, 0.9, 0, { map: plaster(Y) });
    const WH = Y.water ? 0.95 : 2.55, WW = 44;
    const ws = new THREE.Shape();
    ws.moveTo(-WW / 2, 0); ws.lineTo(WW / 2, 0); ws.lineTo(WW / 2, WH); ws.lineTo(-WW / 2, WH); ws.lineTo(-WW / 2, 0);
    const gx = -2.35, gy = 1.25, gr = 1.0;
    if (!Y.water) {
      const hole = new THREE.Path(); hole.absarc(gx, gy, gr, 0, TAU, true); ws.holes.push(hole);
      const win = new THREE.Path(); win.absarc(2.75, 1.55, 0.5, 0, TAU, true); ws.holes.push(win);
    }
    const wg = new THREE.ExtrudeGeometry(ws, { depth: 0.38, bevelEnabled: false, curveSegments: 28 });
    { const pos = wg.attributes.position, uv = wg.attributes.uv; for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) * 0.18, pos.getY(i) * 0.3); }
    wg.computeVertexNormals();
    const wall = new THREE.Mesh(wg, plasterM); wall.position.set(0, 0, -WALL_D - 0.19); wall.receiveShadow = true; G.add(wall);
    // coping and plinth
    const capM = std(Y.roof, 0.6, 0.1);
    G.add(box(WW, 0.14, 0.62, capM, 0, WH + 0.07, -WALL_D));
    G.add(box(WW, 0.22, 0.46, std('#8b8576', 0.95), 0, 0.11, -WALL_D + 0.03));
    if (Y.snow) G.add(box(WW, 0.1, 0.7, std('#ffffff', 0.9), 0, WH + 0.19, -WALL_D));
    if (!Y.water) {
      const ringM = std('#9a8f78', 0.8);
      const rg = new THREE.Mesh(new THREE.TorusGeometry(gr + 0.05, 0.09, 10, 48), ringM); rg.position.set(gx, gy, -WALL_D + 0.2); G.add(rg);
      const rg2 = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.06, 8, 32), std('#5b3a24', 0.6)); rg2.position.set(2.75, 1.55, -WALL_D + 0.2); G.add(rg2);
      // lattice in the window, with a warm light behind it
      const light = new THREE.Mesh(new THREE.CircleGeometry(0.5, 24), new THREE.MeshBasicMaterial({ color: Y.night ? '#ffc070' : '#fff1cf' }));
      light.position.set(2.75, 1.55, -WALL_D - 0.1); G.add(light);
      const lat = std('#4d2f1c', 0.7);
      for (let i = -2; i <= 2; i++) { G.add(box(0.035, 1.0, 0.04, lat, 2.75 + i * 0.2, 1.55, -WALL_D + 0.12)); G.add(box(1.0, 0.035, 0.04, lat, 2.75, 1.55 + i * 0.2, -WALL_D + 0.12)); }
      // a bamboo grove seen through the moon gate
      const R = rnd(77), bam = std('#7aa84a', 0.6);
      for (let i = 0; i < 12; i++) { const b = cyl(0.035, 0.04, 4.2, 6, bam, gx - 1.5 + R() * 3, 2.1, -(WALL_D + 1.2 + R() * 3)); b.rotation.z = (R() - 0.5) * 0.06; G.add(b); }
      const gate = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.3), new THREE.MeshBasicMaterial({ color: Y.night ? '#3a4a4a' : '#cfe3b4', transparent: true, opacity: 0.0 })); G.add(gate);
    } else {
      // river: water beyond the balustrade
      const wt = canvasTex(256, 256, (g, w, h) => {
        const R = rnd(12); g.fillStyle = '#7fc2c4'; g.fillRect(0, 0, w, h);
        for (let i = 0; i < 80; i++) { g.strokeStyle = `rgba(255,255,255,${0.1 + R() * 0.25})`; g.lineWidth = 1 + R() * 2; const x = R() * w, y = R() * h; g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + 10, y - 3, x + 24 + R() * 20, y); g.stroke(); }
      }, [10, 6]);
      const water = new THREE.Mesh(new THREE.PlaneGeometry(120, 18), std(0xffffff, 0.12, 0.2, { map: wt }));
      water.rotation.x = -Math.PI / 2; water.position.set(0, -0.35, -(WALL_D + 9)); G.add(water); dyn.water = wt;
      const bank = new THREE.Mesh(new THREE.PlaneGeometry(120, 30), std('#78a864', 1)); bank.rotation.x = -Math.PI / 2; bank.position.set(0, -0.02, -(WALL_D + 33)); G.add(bank);
      // balustrade posts
      for (let i = -9; i <= 9; i++) G.add(box(0.18, 1.15, 0.18, std('#bdb59f', 0.85), i * 2.2, 0.58, -WALL_D + 0.1));
    }
    // pavilions beyond the wall
    const pav = Y.water ? [[-3.6, WALL_D + 14, 6.4, 2.1], [4.8, WALL_D + 12, 4.6, 1.8]] : [[0.6, WALL_D + 7.5, 5.6, 1.5], [-9.2, WALL_D + 8, 4.6, 1.3], [10.4, WALL_D + 8.5, 5.0, 1.4]];
    pav.forEach(([px, pd, pw, ph]) => {
      const p = pavilion(Y, px, pd, pw, ph, !Y.water);
      if (Y.snow) { const cap = new THREE.Mesh(roofGeo(pw * 0.94, 3.25, ph * 0.9), std('#ffffff', 0.85)); cap.position.set(0, 2.35 + 0.1, 0); p.add(cap); }
      G.add(p);
    });
    // trees
    if (Y.water) { G.add(willow(Y, -3.9, 6.2, 4.4)); G.add(willow(Y, 8.5, 12, 4.8)); G.add(willow(Y, -9, 14, 5)); }
    else { G.add(ginkgo(Y, -3.6, 5.2, 5.4, 1)); G.add(ginkgo(Y, 7.2, WALL_D + 2.6, 5.2, 0.9)); G.add(ginkgo(Y, -9.5, WALL_D + 3, 5, 0.9)); }
    // stone bench along the wall for the onlookers
    const stone = std('#a9a08a', 0.9);
    const bench = new THREE.Group();
    bench.add(box(9, 0.14, 0.52, stone, 0, 0.42, 0));
    for (const sx of [-4.2, -1.4, 1.4, 4.2]) bench.add(box(0.5, 0.36, 0.46, stone, sx, 0.18, 0));
    bench.position.set(0, 0, -BENCH_D); G.add(bench);
    if (Y.snow) bench.add(box(9, 0.07, 0.56, std('#ffffff', 0.9), 0, 0.52, 0));
    // little round tea table at the right edge
    const tt = new THREE.Group();
    tt.add(cyl(0.34, 0.34, 0.04, 20, std('#5b3a24', 0.5), 0, 0.5, 0)); tt.add(cyl(0.05, 0.07, 0.5, 8, std('#3a2416', 0.6), 0, 0.25, 0));
    tt.add(cyl(0.07, 0.05, 0.1, 10, std('#f5efe2', 0.3), 0.08, 0.57, 0.04));
    tt.add(cyl(0.11, 0.07, 0.14, 10, std('#2f6a62', 0.35, 0.1), -0.1, 0.59, -0.05));
    tt.position.set(3.3, 0, -5.8); G.add(tt);
    // lanterns (dusk) hung under the coping, plus two stone lanterns at the foot of the wall
    if (Y.lanterns) {
      for (let i = 0; i < 7; i++) G.add(lantern(-6 + i * 2.0, WH - 0.55 - (i % 2) * 0.3, WALL_D - 0.6));
      const lg = new THREE.PointLight('#ffb870', 6, 9, 1.6); lg.position.set(0, 1.9, -(WALL_D - 1.2)); G.add(lg);
      const lg2 = new THREE.PointLight('#ff9a58', 4, 7, 1.6); lg2.position.set(-3.2, 1.6, -(WALL_D - 1.4)); G.add(lg2);
    }
    // falling leaves / snow as points
    const nP = low ? 36 : 90;
    const arr = new Float32Array(nP * 3), R2 = rnd(5);
    for (let i = 0; i < nP; i++) { arr[i * 3] = (R2() - 0.5) * 12; arr[i * 3 + 1] = R2() * 5; arr[i * 3 + 2] = -(R2() * 9 - 1); }
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    const pm = new THREE.PointsMaterial({ map: Y.snow ? glowTex() : leafSprite(Y), size: Y.snow ? 0.075 : 0.19, sizeAttenuation: true, transparent: true, alphaTest: 0.05, depthWrite: false, color: Y.snow ? '#ffffff' : '#ffffff' });
    const pts = new THREE.Points(pg, pm); pts.frustumCulled = false; G.add(pts);
    dyn.leaves = { pts, arr, n: nP, snow: !!Y.snow, R: rnd(99) };
    G.userData.Y = Y;
    return G;
  }

  function disposeGroup(g) {
    g.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) { (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose()); }
    });
  }

  const api = {
    root,
    get yard() { return yardId; },
    setYard(id) {
      if (id === yardId) return false;
      if (group) { root.remove(group); disposeGroup(group); }
      dyn.sway.length = 0; dyn.lanterns.length = 0; dyn.leaves = null; dyn.water = null;
      yardId = id;
      group = build(YARDS[id] || YARDS[0]);
      root.add(group);
      api.background = group.userData.background;
      return true;
    },
    update(dt, t, wind = 0) {
      for (const s of dyn.sway) s.o.rotation.z = Math.sin(t * s.f + s.ph) * s.a + wind * 0.01;
      for (const l of dyn.lanterns) l.o.rotation.z = Math.sin(t * 1.3 + l.ph) * 0.06 + wind * 0.03;
      if (dyn.water) { dyn.water.offset.x = (t * 0.01) % 1; dyn.water.offset.y = (t * 0.004) % 1; }
      const L = dyn.leaves;
      if (L && dt > 0) {
        const a = L.arr;
        for (let i = 0; i < L.n; i++) {
          const o = i * 3, sp = L.snow ? 0.35 + (i % 5) * 0.05 : 0.22 + (i % 7) * 0.035;
          a[o + 1] -= sp * dt;
          a[o] += (Math.sin(t * 0.9 + i * 1.7) * (L.snow ? 0.08 : 0.28) + wind * 0.5) * dt;
          a[o + 2] += Math.cos(t * 0.7 + i) * 0.05 * dt;
          if (a[o + 1] < 0.02) { a[o + 1] = 4.8 + (i % 4) * 0.2; a[o] = (L.R() - 0.5) * 12; a[o + 2] = -(L.R() * 9 - 1); }
        }
        L.pts.geometry.attributes.position.needsUpdate = true;
      }
    },
    dispose() { if (group) { root.remove(group); disposeGroup(group); } texList.forEach((t) => t.dispose()); texList = []; },
  };
  return api;
}

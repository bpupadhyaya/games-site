// The venue and the things you throw: sky, veld, sand lane, stake with pennant, flat wooden pins, thorn trees, fence, hills, a shade
// tent. Everything is plain three.js geometry with canvas textures (no image files). World axes of the sim map to three as
// X = lane x, Y = height, Z = across the lane (+ toward the viewer).
import { palette, TEAM } from '../src/art.js';
import { LANE_HALF, STAKE_H, NEAR, TOUCH, BONUS_NEAR, PIN_LEN } from '../src/sim.js';

export const PIN_T = 0.036;            // board thickness (m)
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const hash = (i) => { const v = Math.sin(i * 12.9898 + 4.1) * 43758.5453; return v - Math.floor(v); };
const hex = (c) => [parseInt(c.slice(1, 3), 16) / 255, parseInt(c.slice(3, 5), 16) / 255, parseInt(c.slice(5, 7), 16) / 255].map((v) => Math.pow(v, 2.2));   // sRGB -> linear (vertex colours)

function lcg(seed) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }


// a surface of revolution (profile = [[radius, height], ...] from the foot up); v runs 0..1 along the height
function lathe(THREE, prof, seg, H) {
  const P = [], N = [], U = [], I = [];
  const n = prof.length;
  for (let j = 0; j < n; j++) {
    const a = prof[Math.max(0, j - 1)], b = prof[Math.min(n - 1, j + 1)];
    let tx = b[0] - a[0], ty = b[1] - a[1]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;       // tangent; normal = (ty, -tx)
    for (let i = 0; i <= seg; i++) {
      const th = (i / seg) * Math.PI * 2, c = Math.cos(th), s = Math.sin(th);
      P.push(prof[j][0] * c, prof[j][1], prof[j][0] * s); N.push(ty * c, -tx, ty * s); U.push(i / seg, clamp(prof[j][1] / H, 0, 1));
    }
  }
  for (let j = 0; j < n - 1; j++) for (let i = 0; i < seg; i++) { const a = j * (seg + 1) + i, b = a + seg + 1; I.push(a, a + 1, b, b, a + 1, b + 1); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
  g.setIndex(I);
  return g;
}
// a flat board from a symmetric half outline [[x, halfWidth], ...] (x increasing, ends at halfWidth 0): top and bottom faces plus rounded edge.
// Lies in the XZ plane, thickness along Y centred on 0; x is the long axis.
function flatBoard(THREE, half, thick, edge) {
  const loop = [];
  for (const [x, y] of half) loop.push([x, y]);
  for (let i = half.length - 2; i >= 1; i--) loop.push([half[i][0], -half[i][1]]);
  const n = loop.length, P = [], N = [], U = [], I = [];
  const T = thick / 2, E = Math.min(edge, T * 0.9);
  // rings: bottom outer (y=-T+E), side mid-low (y=-(T-E)), side mid-high, top outer.. we use: top face inset ring, shoulder ring, belly ring, bottom face inset ring
  const inset = (pt, k, cx) => [pt[0] + (cx - pt[0]) * 0, pt[1] * (1 - k)];
  const rings = [
    { y: T, k: 0.18, nrm: [0, 1, 0] },        // top face edge (inset)
    { y: T - E * 0.5, k: 0.05, nrm: [0.5, 0.8, 0.5] },
    { y: 0, k: 0, nrm: [1, 0, 1] },
    { y: -T + E * 0.5, k: 0.05, nrm: [0.5, -0.8, 0.5] },
    { y: -T, k: 0.18, nrm: [0, -1, 0] },
  ];
  // vertex rings
  const base = [];
  rings.forEach((r) => {
    const start = P.length / 3;
    loop.forEach((pt, i) => {
      const prev = loop[(i + n - 1) % n], next = loop[(i + 1) % n];
      let tx = next[0] - prev[0], tz = next[1] - prev[1]; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
      const ox = tz, oz = -tx;                                         // outward (loop runs top side then back along the bottom side)
      const px = pt[0], pz = pt[1] * (1 - r.k);
      P.push(px, r.y, pz);
      const side = r.nrm[0] === 0 ? 0 : 1;
      N.push(ox * (side ? 0.9 : 0), r.nrm[1] === 0 ? 0 : r.nrm[1] * (side ? 0.45 : 1), oz * (side ? 0.9 : 0));
      U.push(px, pz);
    });
    base.push(start);
  });
  const quad = (a, b, c, d) => I.push(a, b, c, a, c, d);
  for (let r = 0; r < rings.length - 1; r++) for (let i = 0; i < n; i++) { const j = (i + 1) % n; quad(base[r] + i, base[r + 1] + i, base[r + 1] + j, base[r] + j); }
  // caps (fans from the centre line)
  const cap = (ri, up) => {
    const c = P.length / 3; P.push(0, rings[ri].y, 0); N.push(0, up, 0); U.push(0, 0);
    for (let i = 0; i < n; i++) { const j = (i + 1) % n; if (up > 0) I.push(c, base[ri] + j, base[ri] + i); else I.push(c, base[ri] + i, base[ri] + j); }
  };
  cap(0, 1); cap(rings.length - 1, -1);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
  g.setIndex(I);
  g.computeVertexNormals();
  return g;
}

export function buildWorld(V3, stage, { quality = 'high' } = {}) {
  const { THREE } = V3;
  const doc = globalThis.document;
  const aniso = Math.min(8, stage.renderer.capabilities.getMaxAnisotropy());
  const W = { quality };
  const root = new THREE.Group(); root.name = 'jukskei-world';
  stage.scene.add(root);
  W.root = root;
  const canvasTex = (w, h, draw, { srgb = true, repeat = null, mip = true } = {}) => {
    const c = doc.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'); draw(g, w, h);
    const t = new THREE.CanvasTexture(c);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = aniso; t.generateMipmaps = mip;
    t.minFilter = mip ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
    if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
    return t;
  };
  const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0, ...o });

  // ---- sky: a full-view quad written straight to clip space (gradient, sun glow and soft clouds baked into one canvas texture) ----------------
  const skyTex = canvasTex(1024, 512, () => {}, { mip: false });
  skyTex.wrapS = THREE.RepeatWrapping; skyTex.wrapT = THREE.ClampToEdgeWrapping;
  const skyMat = new THREE.MeshBasicMaterial({ map: skyTex, depthTest: false, depthWrite: false, fog: false, toneMapped: false });
  skyMat.onBeforeCompile = (sh) => { sh.vertexShader = sh.vertexShader.replace('#include <project_vertex>', 'gl_Position = vec4(position.xy, 0.9999, 1.0);'); };
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), skyMat);
  sky.frustumCulled = false; sky.renderOrder = -100;
  root.add(sky);
  W.sky = sky;
  const drawSky = (pal) => {
    const c = skyTex.image, g = c.getContext('2d'), w = c.width, h = c.height;
    // the horizon sits at v = 0.5 of the texture (bottom half is the same colour: it is hidden by the veld)
    const gr = g.createLinearGradient(0, 0, 0, h / 2);
    gr.addColorStop(0, pal.top); gr.addColorStop(0.6, pal.mid); gr.addColorStop(1, pal.hor);
    g.fillStyle = gr; g.fillRect(0, 0, w, h / 2);
    g.fillStyle = pal.hor; g.fillRect(0, h / 2, w, h / 2);
    const sx = (1 - pal.sunX) * w, sy = h * 0.29;
    const gl = g.createRadialGradient(sx, sy, 4, sx, sy, h * 0.42);
    gl.addColorStop(0, 'rgba(255,248,214,0.95)'); gl.addColorStop(0.16, 'rgba(255,240,190,0.5)'); gl.addColorStop(1, 'rgba(255,240,190,0)');
    g.fillStyle = gl; g.fillRect(0, 0, w, h / 2);
    g.fillStyle = pal.sun; g.beginPath(); g.arc(sx, sy, 15, 0, 7); g.fill();
    // clouds: flat-bottomed puffs that wrap around horizontally
    const r = lcg(41);
    g.fillStyle = pal.cloud;
    for (let i = 0; i < 9; i++) {
      const cx = r() * w, cy = h * (0.08 + r() * 0.3), cw = 60 + r() * 140;
      for (const dx of [-w, 0, w]) {
        g.beginPath(); g.ellipse(cx + dx, cy, cw, cw * 0.17, 0, 0, 7); g.ellipse(cx + dx + cw * 0.35, cy - cw * 0.08, cw * 0.55, cw * 0.17, 0, 0, 7); g.ellipse(cx + dx - cw * 0.4, cy + 2, cw * 0.5, cw * 0.13, 0, 0, 7); g.fill();
      }
    }
    skyTex.needsUpdate = true;
  };
  W.skyMat = { uniforms: { time: { value: 0 }, hor: { value: 0.5 } } };

  // ---- veld ground ---------------------------------------------------------------------------------------------------------------
  const veldTex = canvasTex(512, 512, (g, w, h) => {
    const r = lcg(77);
    g.fillStyle = '#9a9a58'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '255,240,170' : '70,64,30'},${0.05 + r() * 0.09})`; g.beginPath(); g.ellipse(r() * w, r() * h, 8 + r() * 36, 4 + r() * 14, r() * 3, 0, 7); g.fill(); }
    g.lineWidth = 1;
    for (let i = 0; i < 2600; i++) {
      const x = r() * w, y = r() * h, l = 3 + r() * 9, a = (r() - 0.5) * 0.9 - Math.PI / 2;
      g.strokeStyle = `rgba(${r() < 0.5 ? '232,214,140' : '110,100,52'},${0.25 + r() * 0.4})`;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
    }
  }, { repeat: [6, 6] });
  const veldMat = std({ map: veldTex, roughness: 1 });
  const veld = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), veldMat);
  veld.rotation.x = -Math.PI / 2; veld.receiveShadow = true;
  root.add(veld);
  W.veld = veld;

  // ---- hills (flat-topped koppies): two ridges, drawn as vertical cut-outs at the horizon ---------------------------------------------
  const ridge = (seed, par, col) => {
    const N = 120, span = 240, P = [], C = [], I = [];
    for (let i = 0; i <= N; i++) {
      const x = -span / 2 + (i / N) * span, u = x / 11;
      let v = Math.sin(u * 0.9 + seed) * 0.42 + Math.sin(u * 2.3 + seed * 3) * 0.22 + Math.sin(u * 5.1 + seed) * 0.07 + 0.42;
      v = Math.min(v, 0.6) + Math.max(0, v - 0.6) * 0.25;           // flat-topped koppies
      v = clamp(v, 0.05, 1);
      P.push(x, -0.6, 0, x, v, 0);
      C.push(1, 1, 1, 1, 1, 1);
    }
    for (let i = 0; i < N; i++) { const a = i * 2; I.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); g.setIndex(I);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: col, fog: false, side: THREE.DoubleSide, vertexColors: true }));
    m.userData.par = par; m.frustumCulled = false;
    root.add(m);
    return m;
  };
  W.ridges = [ridge(1.3, 0.12, 0x8aa078), ridge(4.1, 0.3, 0x6d8863)];

  // ---- the sand lane texture (rebuilt per pitch) -----------------------------------------------------------------------------------
  const LX0 = -3.5, LANE_W = 6.0;
  let laneMesh = null, laneKey = '';
  const bump = canvasTex(256, 256, (g, w, h) => {
    const r = lcg(5); g.fillStyle = '#808080'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 6000; i++) { const v = 90 + (r() * 90) | 0; g.fillStyle = `rgb(${v},${v},${v})`; const s = 1 + r() * 2.2; g.fillRect(r() * w, r() * h, s, s * (0.6 + r() * 0.6)); }
    for (let i = 0; i < 14; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '40,40,40' : '200,200,200'},0.22)`; g.fillRect(0, r() * h, w, 1 + r() * 2); }
  }, { srgb: false, repeat: [1, 1] });
  function buildLane(D, pal, fric) {
    const key = `${D}|${pal.top}|${Math.round(fric)}`;
    if (key === laneKey && laneMesh) return;
    laneKey = key;
    const LX1 = D + 8, len = LX1 - LX0;
    const PXM = quality === 'low' ? 56 : 84;                          // texture pixels per metre
    const tw = Math.min(4096, Math.round(len * PXM)), th = Math.round(LANE_W * PXM);
    const sx = tw / len, sy = th / LANE_W;
    const X = (x) => (x - LX0) * sx, Y = (y) => (y + LANE_W / 2) * sy;
    const tex = canvasTex(tw, th, (g) => {
      const r = lcg(91 + D);
      const sand = pal.sand, sandD = pal.sandD;
      const gr = g.createLinearGradient(0, 0, 0, th);
      gr.addColorStop(0, sandD); gr.addColorStop(0.5, sand); gr.addColorStop(1, sandD);
      g.fillStyle = gr; g.fillRect(0, 0, tw, th);
      // tonal clouds and damp patches
      for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(${r() < 0.5 ? '255,236,190' : '120,86,40'},${0.04 + r() * 0.06})`; g.beginPath(); g.ellipse(r() * tw, r() * th, 20 + r() * 150, 8 + r() * 36, 0, 0, 7); g.fill(); }
      // raked furrows along the lane
      for (let k = -14; k <= 14; k++) { const y = Y(k * 0.2) + (r() - 0.5) * 3; g.strokeStyle = `rgba(110,76,34,${0.1 + r() * 0.1})`; g.lineWidth = 1 + r() * 1.4; g.beginPath(); g.moveTo(0, y); g.lineTo(tw, y + (r() - 0.5) * 6); g.stroke(); }
      // grains and small stones
      for (let i = 0; i < tw * th / 120; i++) { g.fillStyle = r() < 0.55 ? `rgba(116,82,36,${0.12 + r() * 0.2})` : `rgba(255,244,214,${0.1 + r() * 0.22})`; const s = 0.8 + r() * 1.8; g.fillRect(r() * tw, r() * th, s, s); }
      // footprints near the throwing mat
      g.fillStyle = 'rgba(96,66,28,0.25)';
      for (let i = 0; i < 7; i++) { g.beginPath(); g.ellipse(X(-2.6 + i * 0.34 + r() * 0.1), Y(0.55 - (i % 2) * 0.32 + r() * 0.08), 0.12 * sx, 0.055 * sy, 0.1, 0, 7); g.fill(); }
      // chalk rings around the stake: touching, scoring zone, bonus distance
      const ring = (rad, fill, stroke, dash, lw) => {
        g.beginPath(); g.ellipse(X(D), Y(0), rad * sx, rad * sy, 0, 0, 7);
        if (fill) { g.fillStyle = fill; g.fill(); }
        g.setLineDash(dash || []); g.strokeStyle = stroke; g.lineWidth = lw; g.stroke(); g.setLineDash([]);
      };
      ring(BONUS_NEAR, null, 'rgba(255,255,255,0.5)', [0.12 * sx, 0.14 * sx], 0.045 * sy);
      ring(NEAR, 'rgba(255,255,255,0.1)', 'rgba(255,255,255,0.86)', null, 0.05 * sy);
      ring(TOUCH, 'rgba(255,208,80,0.26)', 'rgba(255,230,140,0.95)', null, 0.045 * sy);
      // painted side lines and the foul line (a little worn)
      g.strokeStyle = 'rgba(255,255,255,0.93)'; g.lineWidth = 0.1 * sy;
      for (const y of [-LANE_HALF + 0.05, LANE_HALF - 0.05]) { g.beginPath(); g.moveTo(0, Y(y)); g.lineTo(tw, Y(y)); g.stroke(); }
      g.lineWidth = 0.1 * sx; g.beginPath(); g.moveTo(X(0), 0); g.lineTo(X(0), th); g.stroke();
      // distance ticks and numbers
      g.font = `600 ${Math.round(0.34 * sy)}px system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      for (let d = 5; d <= D; d += 5) {
        g.fillStyle = 'rgba(255,255,255,0.55)'; g.fillRect(X(d) - 0.02 * sx, Y(-LANE_HALF + 0.12), 0.04 * sx, 0.4 * sy); g.fillRect(X(d) - 0.02 * sx, Y(LANE_HALF - 0.52), 0.04 * sx, 0.4 * sy);
        g.fillStyle = 'rgba(255,255,255,0.8)'; g.save(); g.translate(X(d - 0.35), Y(LANE_HALF - 0.9)); g.fillText(`${d} m`, 0, 0); g.restore();
      }
      // worn fringe where the grass meets the sand
      const fr = g.createLinearGradient(0, 0, 0, th);
      fr.addColorStop(0, 'rgba(90,70,30,0.0)'); fr.addColorStop(0.03, 'rgba(90,70,30,0)'); fr.addColorStop(1, 'rgba(90,70,30,0)');
    });
    if (laneMesh) { laneMesh.material.map.dispose(); laneMesh.geometry.dispose(); root.remove(laneMesh); }
    const bm = bump.clone(); bm.needsUpdate = true; bm.wrapS = bm.wrapT = THREE.RepeatWrapping; bm.repeat.set(len / 1.4, LANE_W / 1.4);
    const mat = std({ map: tex, bumpMap: bm, bumpScale: 1.4, roughness: 1, color: 0xe4d2b4 });
    laneMesh = new THREE.Mesh(new THREE.PlaneGeometry(len, LANE_W), mat);
    laneMesh.rotation.x = -Math.PI / 2; laneMesh.position.set((LX0 + LX1) / 2, 0.004, 0); laneMesh.receiveShadow = true;
    root.add(laneMesh);
    // the throwing mat: a rubber slab behind the foul line
    if (!W.mat) {
      const mt = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.035, 1.9), std({ color: 0x35363a, roughness: 0.8 }));
      mt.position.set(-0.75, 0.0175, 0); mt.receiveShadow = true; mt.castShadow = false; root.add(mt); W.mat = mt;
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.037, 1.9), std({ color: 0xf2f0e6, roughness: 0.7 }));
      strip.position.set(-0.05, 0.0185, 0); root.add(strip);
    }
    // distance pegs at every 5 m along the near side
    W.pegs = W.pegs || new THREE.Group(); root.add(W.pegs);
    while (W.pegs.children.length) W.pegs.remove(W.pegs.children[0]);
    for (let d = 5; d <= D; d += 5) {
      const pg = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.22, 0.05), std({ color: 0xf1ecdd }));
      pg.position.set(d, 0.11, LANE_HALF + 0.12); pg.castShadow = true; W.pegs.add(pg);
    }
    W.laneD = D;
    // stake follows the pitch
    if (W.stake) W.stake.position.set(D, 0, 0);
  }
  W.setPitch = (pitch) => buildLane(pitch.D, palette(pitch.sky), pitch.fric);

  // ---- the stake ---------------------------------------------------------------------------------------------------------------------
  {
    const g = new THREE.Group();
    const bandTex = canvasTex(64, 256, (c, w, h) => {
      c.fillStyle = '#f4f0e2'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#c9322a';
      for (let k = 0; k < 4; k++) c.fillRect(0, (k * 2 + 0.5) * h / 8, w, h / 8);
      const r = lcg(3);
      for (let i = 0; i < 90; i++) { c.fillStyle = `rgba(80,50,20,${0.05 + r() * 0.1})`; c.fillRect(r() * w, 0, 1 + r() * 2, h); }
      c.fillStyle = 'rgba(0,0,0,0.12)'; for (let i = 0; i < 40; i++) c.fillRect(r() * w, r() * h, 1.5, 3 + r() * 6);
    });
    // lathe profile: from the foot up to a domed top (v along the height maps to 0..1)
    const R0 = 0.052, R1 = 0.046, H = STAKE_H;
    const prof = [[0.001, 0], [R0, 0]];
    for (let i = 0; i <= 10; i++) prof.push([R0 + (R1 - R0) * (i / 10), 0.001 + (H - 0.04) * (i / 10)]);
    for (let i = 1; i <= 8; i++) { const a = (i / 8) * Math.PI / 2; prof.push([Math.cos(a) * R1, H - 0.04 + Math.sin(a) * 0.04]); }
    const post = new THREE.Mesh(lathe(THREE, prof, 28, H), std({ map: bandTex, roughness: 0.55 }));
    post.castShadow = true; post.receiveShadow = true;
    // an iron collar and a pennant on a short rod
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(R0 + 0.004, R0 + 0.004, 0.025, 20), std({ color: 0x4a4a4e, metalness: 0.6, roughness: 0.45 }));
    collar.position.y = 0.16;
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.22, 8), std({ color: 0x3a2a18 }));
    rod.position.y = H + 0.1;
    // pennant: a subdivided triangle-ish flag that streams downwind
    const fg = new THREE.PlaneGeometry(0.38, 0.17, 10, 3);
    const flag = new THREE.Mesh(fg, std({ color: 0xffc83a, side: THREE.DoubleSide, roughness: 0.7 }));
    flag.castShadow = false;
    const flagHolder = new THREE.Group(); flagHolder.position.y = H + 0.17; flagHolder.add(flag);
    g.add(post, collar, rod, flagHolder);
    // a small mound of sand at the foot
    const mound = new THREE.Mesh(new THREE.SphereGeometry(0.2, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2), std({ color: 0xdcc08a, roughness: 1 }));
    mound.scale.set(1, 0.22, 1); mound.receiveShadow = true;
    const tilt = new THREE.Group(); tilt.add(g);                    // rotates about the foot when the stake is knocked
    const holder = new THREE.Group(); holder.add(tilt, mound);
    root.add(holder);
    W.stake = holder; W.stakeTilt = tilt; W.stakeBody = g; W.flag = flag; W.flagHolder = flagHolder; W.flagBase = fg.attributes.position.array.slice();
    W.stakeShadow = null;
  }

  // ---- pins ---------------------------------------------------------------------------------------------------------------------------
  {
    const L = PIN_LEN, hl = L / 2;
    // half outline (x along the length, y = half width): a narrow handle at -x, a fuller rounded head at +x
    const half = [];
    const bez = (p0, p1, p2, p3, n) => { for (let i = 1; i <= n; i++) { const t = i / n, u = 1 - t; half.push([u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0], u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]]); } };
    half.push([-hl, 0]);
    bez([-hl, 0], [-hl, 0.014], [-hl + 0.004, 0.0172], [-hl + 0.014, 0.0172], 5);
    bez([-hl + 0.014, 0.0172], [-0.03, 0.0172], [0.0, 0.0215], [0.03, 0.036], 8);
    bez([0.03, 0.036], [0.05, 0.047], [0.1, 0.047], [0.122, 0.034], 8);
    bez([0.122, 0.034], [0.14, 0.024], [hl, 0.014], [hl, 0], 6);
    const geo = flatBoard(THREE, half, PIN_T, 0.005);
    W.pinGeo = geo;
    const faceTex = (team) => canvasTex(256, 64, (c, w, h) => {
      const col = TEAM[team];
      const wood = c.createLinearGradient(0, 0, 0, h);
      wood.addColorStop(0, '#e2b274'); wood.addColorStop(0.5, '#c8924f'); wood.addColorStop(1, '#a8702f');
      c.fillStyle = wood; c.fillRect(0, 0, w, h);
      const r = lcg(11 + team);
      for (let i = 0; i < 60; i++) { c.strokeStyle = `rgba(${r() < 0.5 ? '90,56,22' : '240,210,150'},${0.12 + r() * 0.22})`; c.lineWidth = 0.6 + r() * 1.2; const y = r() * h; c.beginPath(); c.moveTo(0, y); c.bezierCurveTo(w * 0.3, y + (r() - 0.5) * 5, w * 0.6, y + (r() - 0.5) * 5, w, y + (r() - 0.5) * 4); c.stroke(); }
      // the side's paint: a broad band near the handle and a thin ring
      const u = (x) => ((x + hl) / L) * w;
      c.fillStyle = col.main; c.fillRect(u(-0.1), 0, u(-0.045) - u(-0.1), h);
      c.fillStyle = col.light; c.fillRect(u(-0.035), 0, u(-0.018) - u(-0.035), h);
      c.fillStyle = col.dark; c.fillRect(u(-0.1), 0, 2, h); c.fillRect(u(-0.045) - 2, 0, 2, h);
      c.fillStyle = 'rgba(0,0,0,0.1)'; c.fillRect(u(0.11), 0, w, h);
    });
    // UVs of the caps are the raw shape coordinates: remap x -> u, y -> v
    const uv = geo.attributes.uv, pos = geo.attributes.position;
    for (let i = 0; i < uv.count; i++) { uv.setXY(i, (pos.getX(i) + hl) / L, pos.getZ(i) / 0.1 + 0.5); }
    W.pinMats = [0, 1].map((team) => std({ map: faceTex(team), roughness: 0.62, side: THREE.DoubleSide }));
    W.pins = [];
    for (let i = 0; i < 18; i++) {
      const m = new THREE.Mesh(geo, W.pinMats[0]);
      m.castShadow = true; m.receiveShadow = true; m.visible = false; m.matrixAutoUpdate = true;
      root.add(m);
      W.pins.push(m);
    }
    // soft contact shadow discs (used when the real shadow map is off)
    const sc = canvasTex(64, 64, (c, w, h) => { const g = c.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2); g.addColorStop(0, 'rgba(0,0,0,0.55)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); });
    W.discMat = new THREE.MeshBasicMaterial({ map: sc, transparent: true, depthWrite: false, fog: false });
    W.discs = [];
    for (let i = 0; i < 20; i++) { const d = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), W.discMat.clone()); d.rotation.x = -Math.PI / 2; d.position.y = 0.012; d.visible = false; root.add(d); W.discs.push(d); }
  }

  // ---- merged geometry helper -------------------------------------------------------------------------------------------------------
  const merge = (parts) => {
    const P = [], N = [], C = [], I = [];
    let base = 0;
    for (const { geo, color, m } of parts) {
      const g = geo.index ? geo : geo;
      if (m) g.applyMatrix4(m);
      const p = g.attributes.position, n = g.attributes.normal;
      for (let i = 0; i < p.count; i++) { P.push(p.getX(i), p.getY(i), p.getZ(i)); N.push(n.getX(i), n.getY(i), n.getZ(i)); C.push(color[0], color[1], color[2]); }
      if (g.index) for (let i = 0; i < g.index.count; i++) I.push(g.index.getX(i) + base); else for (let i = 0; i < p.count; i++) I.push(i + base);
      base += p.count;
    }
    const out = new THREE.BufferGeometry();
    out.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); out.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); out.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
    out.setIndex(I);
    return out;
  };
  const Mx = (x, y, z, sx = 1, sy = 1, sz = 1, ry = 0, rz = 0) => new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, rz)), new THREE.Vector3(sx, sy, sz));

  // ---- thorn trees ---------------------------------------------------------------------------------------------------------------------
  {
    const tr = hex('#4a3a28'), parts = [];
    // trunk + two forks
    parts.push({ geo: new THREE.CylinderGeometry(0.09, 0.15, 2.2, 8), color: tr, m: Mx(0, 1.1, 0) });
    parts.push({ geo: new THREE.CylinderGeometry(0.05, 0.09, 1.6, 7), color: tr, m: Mx(-0.55, 2.7, 0, 1, 1, 1, 0, 0.65) });
    parts.push({ geo: new THREE.CylinderGeometry(0.05, 0.09, 1.7, 7), color: tr, m: Mx(0.6, 2.8, 0.1, 1, 1, 1, 0, -0.6) });
    const leaf = [hex('#59702f'), hex('#4c6528'), hex('#667c36')];
    const blobs = [[-1.25, 3.55, 0, 1.55, 0.36, 1.3], [1.35, 3.65, 0.1, 1.7, 0.38, 1.4], [0, 3.95, -0.1, 1.9, 0.4, 1.5], [-0.3, 3.4, 0.5, 1.1, 0.3, 1.0]];
    blobs.forEach((b, i) => parts.push({ geo: new THREE.SphereGeometry(1, 12, 8), color: leaf[i % 3], m: Mx(b[0], b[1], b[2], b[3], b[4], b[5]) }));
    W.treeGeo = merge(parts);
    W.treeMat = std({ vertexColors: true, roughness: 1 });
    W.trees = [];
    for (let i = -6; i < 16; i++) {
      const m = new THREE.Mesh(W.treeGeo, W.treeMat);
      m.castShadow = true; m.receiveShadow = true;
      const x = i * 9 + hash(i) * 6;
      m.userData = { x, depth: 7.5 + hash(i + 30) * 6, size: (3.8 + hash(i + 60) * 2.2) / 4.4, flip: hash(i + 9) < 0.5 ? -1 : 1 };
      root.add(m); W.trees.push(m);
    }
  }

  // ---- fence -----------------------------------------------------------------------------------------------------------------------------
  {
    W.fence = new THREE.Group();
    const post = new THREE.BoxGeometry(0.09, 1.1, 0.09), mat = std({ color: 0x5a432a, roughness: 1 });
    for (let x = -50; x <= 100; x += 2.2) { const p = new THREE.Mesh(post, mat); p.position.set(x, 0.55, 0); p.castShadow = true; W.fence.add(p); }
    const wireMat = new THREE.MeshBasicMaterial({ color: 0x2b261c });
    for (const y of [0.45, 0.9]) { const w = new THREE.Mesh(new THREE.BoxGeometry(150, 0.012, 0.012), wireMat); w.position.set(25, y, 0); W.fence.add(w); }
    root.add(W.fence);
  }

  // ---- shade tent and a trestle table (behind the fence near the stake) ------------------------------------------------------------------
  {
    const t = new THREE.Group();
    const stripe = canvasTex(128, 16, (c, w, h) => { for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? '#f3efe2' : '#2f6f9a'; c.fillRect(i * w / 8, 0, w / 8, h); } }, { repeat: [1, 1] });
    const pole = new THREE.CylinderGeometry(0.03, 0.03, 2.3, 8), pm = std({ color: 0xc9c7bd, metalness: 0.5, roughness: 0.5 });
    for (const [x, z] of [[-1.6, -1.1], [1.6, -1.1], [-1.6, 1.1], [1.6, 1.1]]) { const p = new THREE.Mesh(pole, pm); p.position.set(x, 1.15, z); p.castShadow = true; t.add(p); }
    const roof = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.05, 2.5), std({ map: stripe, roughness: 0.9 })); roof.position.y = 2.32; roof.castShadow = true; t.add(roof);
    const valance = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.2, 0.02), std({ map: stripe })); valance.position.set(0, 2.2, 1.25); t.add(valance);
    const table = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.05, 0.8), std({ color: 0xe8e2d0 })); table.position.set(0, 0.76, -0.2); table.castShadow = true; t.add(table);
    for (const x of [-1.05, 1.05]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.74, 0.7), std({ color: 0x7c746a })); l.position.set(x, 0.37, -0.2); t.add(l); }
    // a small trophy and a scoring board on the table
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.04, 0.18, 14), std({ color: 0xd9a830, metalness: 0.8, roughness: 0.3 })); cup.position.set(-0.6, 0.88, -0.2); t.add(cup);
    const board = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.5, 0.03), std({ color: 0x2e3b2c })); board.position.set(0.5, 1.05, -0.45); board.rotation.x = -0.25; t.add(board);
    W.tent = t; root.add(t);
  }

  // ---- the per-view layout: everything that sits far behind the lane is placed in screen-proportional units so it never swallows the view --------
  // v = { s, cx, R:{w,h}, gyF, drop } -> places veld edge, hills, trees, fence and tent for this view.
  const KK = 0.42;
  W.layoutView = (v) => {
    const { s, cx, R } = v, gyF = R.gyF ?? 0.72;
    const ds = Math.min(s, 34), f = ds / s;                                   // far objects keep a modest on-screen size
    const halfSpan = R.w / (2 * s) * 1.06 + 4;
    const yHor = Math.max(4.3, (0.38 * R.h) / (KK * s));                      // depth of the horizon (world m): ~38% of the view height above the lane axis
    // veld: from the horizon to well in front of the lane
    const z0 = -yHor, z1 = 14, zb = z0 - 2.5;
    veld.scale.set(halfSpan * 2 + 6, z1 - zb, 1); veld.position.set(cx, -0.002, (zb + z1) / 2);
    veldMat.map.repeat.set((halfSpan * 2 + 6) / 5, (z1 - zb) / 5);
    // sky: horizon in the view's uv
    const horUv = clamp(gyF - 0.38, 0.05, 0.95);
    // horizon at uv-height h0 of the view: texture v 0.5 lands on it, v 1 on the top edge
    const h0 = 1 - horUv;
    skyTex.repeat.set(Math.max(0.2, R.w / R.h * 0.55), 0.5 / Math.max(0.05, 1 - h0));
    skyTex.offset.set(0.1 + (W.skyDrift || 0) + cx * 0.0015, 0.5 - h0 * skyTex.repeat.y);
    // hills stand just behind the horizon
    const hh = 0.2 * R.h / s;
    W.ridges.forEach((m, i) => {
      const par = m.userData.par;
      m.position.set(cx * (1 - par), 0, z0 - 0.5 - i * 0.2);
      m.scale.set(1, hh * (i === 0 ? 1.0 : 0.62) / 1, 1);
      
    });
    // trees, fence, tent: depth scales with f; never inside the lane
    const lim = LANE_HALF + 0.9;
    for (const m of W.trees) {
      const u = m.userData, dz = Math.max(lim + 0.5, u.depth * f), sc = u.size * f * 1.0;
      m.position.set(u.x, 0, -Math.min(dz, yHor - 0.2));
      m.scale.set(sc * u.flip, sc, sc);
      m.visible = Math.abs(u.x - cx) < halfSpan + 6;
    }
    const fz = Math.max(lim, 4.6 * f);
    W.fence.position.set(0, 0, -Math.min(fz, yHor - 0.3));
    W.fence.scale.set(1, f, f);
    W.tent.position.set((W.laneD ?? 24) + 4.5, 0, -Math.min(Math.max(lim + 2.2 * f, 8.2 * f), yHor - 0.5));
    W.tent.scale.setScalar(Math.max(0.5, f));
    W.far = { f, yHor, fz: Math.min(fz, yHor - 0.3), lim };
  };

  // ---- sky and light for a palette ---------------------------------------------------------------------------------------------------------
  const LIGHTS = [
    { hemi: 0.9, hemiSky: 0xcfe6ff, hemiGround: 0xb59a64, key: 0xfff0cf, keyI: 2.5, rim: 0xcfe0ff, rimI: 0.55, exposure: 0.8, off: [-6, 10, 6.5] },
    { hemi: 0.95, hemiSky: 0xd8ecff, hemiGround: 0xb8a070, key: 0xfff4dc, keyI: 2.6, rim: 0xd0e4ff, rimI: 0.5, exposure: 0.82, off: [-5, 11, 6] },
    { hemi: 0.82, hemiSky: 0xd6c2b0, hemiGround: 0x9a7a50, key: 0xffd9a8, keyI: 2.4, rim: 0xaab8e0, rimI: 0.6, exposure: 0.78, off: [-7, 8, 6] },
    { hemi: 0.7, hemiSky: 0xb8a8c8, hemiGround: 0x806848, key: 0xffc58a, keyI: 2.2, rim: 0x9aa8e8, rimI: 0.7, exposure: 0.76, off: [-8, 6.5, 6] },
    { hemi: 0.72, hemiSky: 0xc0a0c0, hemiGround: 0x806040, key: 0xffd0a0, keyI: 2.2, rim: 0xa890d8, rimI: 0.7, exposure: 0.76, off: [-8, 7, 6] },
  ];
  let palIdx = -1;
  W.setLook = (skyIdx) => {
    const i = clamp(skyIdx | 0, 0, 4);
    if (i === palIdx) return;
    palIdx = i;
    const pal = palette(i);
    drawSky(pal);
    const lp = LIGHTS[i];
    stage.setLighting('day', { hemi: lp.hemi, hemiSky: lp.hemiSky, hemiGround: lp.hemiGround, key: lp.key, keyI: lp.keyI, rim: lp.rim, rimI: lp.rimI, exposure: lp.exposure });
    stage._shadowOffset = new THREE.Vector3(...lp.off);
    veldMat.color.set(pal.veld); veldMat.needsUpdate = true;
    W.ridges[0].material.color.set(pal.h1); W.ridges[1].material.color.set(pal.h2);
    const fog = new THREE.Color(pal.hor); stage.scene.fog = new THREE.Fog(fog, 14, 90);
    W.treeMat.color.setRGB(1, 1, 1);
    veldTex.needsUpdate = true;
    W.palIdx = i;
  };

  // ---- per-frame: stake (fall, pennant) and pins ------------------------------------------------------------------------------------
  const ez = new THREE.Euler(), qa = new THREE.Quaternion();
  W.syncStake = (w, t) => {
    const st = w.stake;
    W.stake.position.set(st.x, 0, st.y);
    let fall = 0;
    if (st.fallen) fall = clamp(st.t / 0.32, 0, 1) ** 2;
    else if (st.rise > 0) fall = clamp(st.rise / 0.35, 0, 1);
    // tip over in the direction the pin was travelling (rotation about the foot)
    const dx = st.fallen || st.rise > 0 ? st.dirx : 1, dy = st.fallen || st.rise > 0 ? st.diry : 0;
    const ang = fall * (Math.PI / 2 - 0.09);
    // axis perpendicular to the fall direction in the ground plane: direction (dx, dy) -> three (X=dx, Z=dy)
    const ax = new THREE.Vector3(dy, 0, -dx).normalize();                    // right-hand rule: tilts +Y toward (dx, 0, dy)
    W.stakeTilt.quaternion.setFromAxisAngle(ax, ang);
    // the post, resting on the sand when down: lift so it does not sink
    W.stakeTilt.position.set(0, fall > 0.95 ? 0.05 : 0, 0);
    // pennant streams downwind and ripples
    const wd = w.wind, dir = Math.atan2(wd.ay || 0, wd.ax || 0), sp = Math.min(1, Math.hypot(wd.ax || 0, wd.ay || 0) / 1.4);
    const pos = W.flag.geometry.attributes.position, base = W.flagBase;
    const ext = 0.35 + 0.65 * sp;
    for (let i = 0; i < pos.count; i++) {
      const bx = base[i * 3], by = base[i * 3 + 1];
      const u = (bx + 0.19) / 0.38;                                          // 0 at the rod
      const taper = 1 - u * 0.85;                                           // a pennant: narrows to a point
      const wave = Math.sin(t * 9 + u * 7) * 0.035 * u * (0.4 + sp);
      const droop = (1 - sp) * u * u * 0.16;
      pos.setXYZ(i, u * 0.38 * ext, by * taper - droop, wave);
    }
    pos.needsUpdate = true; W.flag.geometry.computeVertexNormals();
    W.flagHolder.rotation.y = -dir;                                         // streams toward where the wind blows
  };

  // pin placement. pinScale exaggerates the size when the view is zoomed far out (set per view).
  W.syncPins = (w, pinScale, shadowsOn) => {
    const pins = w.pins;
    for (let i = 0; i < W.pins.length; i++) {
      const m = W.pins[i], d = W.discs[i], p = pins[i];
      if (!p) { m.visible = false; d.visible = false; continue; }
      const alpha = clamp(1 - p.fade, 0, 1);
      if (alpha <= 0.02) { m.visible = false; d.visible = false; continue; }
      m.visible = true;
      if (m.material.map !== W.pinMats[p.team ? 1 : 0].map) m.material = W.pinMats[p.team ? 1 : 0];
      const heading = 2 * p.yaw;                                              // the sim keeps half the heading
      m.rotation.set(0, -heading, p.th, 'YZX');
      m.scale.setScalar(pinScale);
      // a tilted board must not sink into the sand
      let y = p.z;
      if (p.mode !== 'air') { const lift = (PIN_LEN / 2) * Math.abs(Math.sin(p.th)) * pinScale + (PIN_T / 2) * Math.abs(Math.cos(p.th)) * pinScale; y = Math.max(y, 0) + lift + 0.005; }
      else y = p.z + (PIN_T / 2) * pinScale;
      m.position.set(p.x, y, p.y);
      if (alpha < 0.99) { if (!m.userData.fadeMat) { m.userData.fadeMat = m.material.clone(); } m.userData.fadeMat.map = m.material.map; m.userData.fadeMat.transparent = true; m.userData.fadeMat.opacity = alpha; m.material = m.userData.fadeMat; }
      d.visible = !shadowsOn;
      if (d.visible) {
        const h = Math.max(0, p.z), sc = pinScale * (0.42 - clamp(h * 0.04, 0, 0.1));
        d.position.set(p.x + 0.06 + h * 0.12, 0.012, p.y + 0.02); d.scale.set(sc * 1.3, sc, 1);
        d.material.opacity = clamp(0.8 - h * 0.12, 0.2, 0.8) * alpha;
      }
    }
  };

  W.dispose = () => { root.traverse((o) => { if (o.geometry) o.geometry.dispose?.(); }); stage.scene.remove(root); };
  W.skyMat = skyMat;
  return W;
}

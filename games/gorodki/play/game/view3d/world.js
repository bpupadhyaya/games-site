// The town of gorodki as a lit 3D scene. World axes: x = across the town, y = up, z3 = -z of the simulation (the thrower stands at
// positive z3 and looks toward negative z3, which is where the shared scenery kit puts the "front" of its backdrops).
// Everything here is plain three.js geometry with small canvas textures; the pins, the bat and the court are built once and moved.
import { PIN_LEN, PIN_R, BAT_HL, SQ, BOUNDS } from '../src/sim.js';

export const PIN_H = 0.26;             // drawn pin length (real pin 0.20 m; the sim's collision length is 0.30)
export const PIN_RAD = 0.04;            // drawn pin radius (real 0.0225 m, drawn thicker so it reads and meets the sim's 0.055 disc)
export const BAT_LEN = 2 * BAT_HL + 0.1;  // 0.82 m (a real bat is about 1.0 m)
export const BAT_RAD = 0.027;
export const Z3 = (z) => -z;            // sim z -> three z

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
function lcg(seed) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }

export function buildWorld(V3, stage, { quality = 'high', THREE = V3.THREE } = {}) {
  const doc = globalThis.document;
  const aniso = Math.min(8, stage.renderer.capabilities.getMaxAnisotropy());
  const W = { quality };
  const root = new THREE.Group(); root.name = 'gorodki-world';
  stage.scene.add(root);
  W.root = root;
  const tex = (w, h, draw, { repeat = null, srgb = true } = {}) => {
    const c = doc.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'); draw(g, w, h);
    const t = new THREE.CanvasTexture(c);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = aniso;
    if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
    return t;
  };
  const std = (o) => new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0, ...o });

  // ---- the court: shovelled, packed snow with the painted square, the throw line and the footprints ---------------------------------------
  const CX0 = -3.0, CX1 = 3.0, CZ0 = -5.0, CZ1 = 3.6;            // court extents (x, sim z)
  const PPM = quality === 'low' ? 110 : 170;                       // texture pixels per metre
  const cw = Math.round((CX1 - CX0) * PPM), ch = Math.round((CZ1 - CZ0) * PPM);
  const px = (x) => (x - CX0) * PPM, pz = (z) => (CZ1 - z) * PPM;  // top of the canvas = far side
  const courtTex = tex(cw, ch, (g) => {
    const r = lcg(11);
    g.fillStyle = '#d8e4f4'; g.fillRect(0, 0, cw, ch);
    // large soft patches (packed snow, ice sheen, the odd bluish shadow of a scraped patch)
    for (let i = 0; i < 70; i++) {
      const x = r() * cw, y = r() * ch, rr = 30 + r() * 120, a = 0.05 + r() * 0.08, k = r();
      const gr = g.createRadialGradient(x, y, 0, x, y, rr);
      const col = k < 0.35 ? '170,195,222' : k < 0.7 ? '255,255,255' : '205,222,238';
      gr.addColorStop(0, `rgba(${col},${a})`); gr.addColorStop(1, `rgba(${col},0)`);
      g.fillStyle = gr; g.fillRect(x - rr, y - rr, rr * 2, rr * 2);
    }
    // shovel and sweeper strokes running along the court
    for (let i = 0; i < 110; i++) {
      const x = r() * cw, y = r() * ch, len = 80 + r() * 380;
      g.strokeStyle = `rgba(${r() < 0.5 ? '255,255,255' : '150,180,212'},${0.07 + r() * 0.1})`; g.lineWidth = 1 + r() * 4;
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + (r() - 0.5) * 30, y + len * 0.5, x + (r() - 0.5) * 24, y + len); g.stroke();
    }
    // frost sparkle
    for (let i = 0; i < 1400; i++) { g.fillStyle = `rgba(255,255,255,${0.25 + r() * 0.5})`; g.fillRect(r() * cw, r() * ch, 1.4, 1.4); }
    // the painted square (2 m): dark red paint, a bit worn, with a white inner edge
    const x0 = px(SQ.x0), x1 = px(SQ.x1), y0 = pz(SQ.z1), y1 = pz(SQ.z0), lw = 0.055 * PPM;
    g.lineJoin = 'miter';
    g.strokeStyle = 'rgba(40,20,22,0.35)'; g.lineWidth = lw + 4; g.strokeRect(x0, y0, x1 - x0, y1 - y0);
    g.strokeStyle = '#b8272a'; g.lineWidth = lw; g.strokeRect(x0, y0, x1 - x0, y1 - y0);
    g.strokeStyle = 'rgba(255,255,255,0.28)'; g.lineWidth = 2; g.strokeRect(x0 + lw / 2, y0 + lw / 2, x1 - x0 - lw, y1 - y0 - lw);
    for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(228,236,243,${0.2 + r() * 0.45})`; const side = r() * 4 | 0, t = r(); const sx = side < 2 ? x0 + t * (x1 - x0) : (side === 2 ? x0 : x1), sy = side < 2 ? (side === 0 ? y0 : y1) : y0 + t * (y1 - y0); g.fillRect(sx + (r() - 0.5) * lw, sy + (r() - 0.5) * lw, 2 + r() * 3, 2 + r() * 3); }
    // the throwing line (a blue board's worth of paint) and the half-way line
    g.fillStyle = 'rgba(30,60,120,0.85)'; g.fillRect(px(-1.4), pz(-3.55) - 0.03 * PPM, 2.8 * PPM, 0.06 * PPM);
    g.fillStyle = 'rgba(30,60,120,0.4)'; g.fillRect(px(-1.0), pz(-1.2) - 0.02 * PPM, 2.0 * PPM, 0.04 * PPM);
    // boot prints beside the throwing line, and the bat's old landing scars on the near court
    const foot = (x, z, a, s) => {
      g.save(); g.translate(px(x), pz(z)); g.rotate(a); g.fillStyle = 'rgba(120,146,176,0.38)';
      g.beginPath(); g.ellipse(0, 0, 0.055 * PPM * s, 0.15 * PPM * s, 0, 0, TAU); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.ellipse(0.012 * PPM, -0.015 * PPM, 0.04 * PPM * s, 0.12 * PPM * s, 0, 0, TAU); g.fill();
      g.restore();
    };
    for (let i = 0; i < 9; i++) foot(-1.2 + (i % 3) * 0.55 + (r() - 0.5) * 0.12, -4.5 + ((i / 3) | 0) * 0.5 + r() * 0.1, (r() - 0.5) * 0.9, 1);
    for (let i = 0; i < 10; i++) foot(1.4 + (r() - 0.5) * 0.6, -3.8 + i * 0.55, (r() - 0.5) * 0.4, 0.95);
    for (let i = 0; i < 5; i++) { g.strokeStyle = 'rgba(140,165,195,0.35)'; g.lineWidth = 3; g.beginPath(); const x = px(-0.6 + r() * 1.2), y = pz(-0.5 - r() * 2); g.moveTo(x, y); g.lineTo(x + (r() - 0.5) * 60, y - 60 - r() * 60); g.stroke(); }
  });
  const courtGeo = new THREE.PlaneGeometry(CX1 - CX0, CZ1 - CZ0);
  courtGeo.rotateX(-Math.PI / 2);
  const court = new THREE.Mesh(courtGeo, std({ map: courtTex, roughness: 0.82, metalness: 0.0 }));
  court.position.set((CX0 + CX1) / 2, 0.004, Z3((CZ0 + CZ1) / 2));
  court.receiveShadow = true;
  root.add(court);
  W.court = court;

  // ---- snow banks around the court, and the boards that bound the town -----------------------------------------------------------------------
  const bankGeo = new THREE.SphereGeometry(1, 14, 10);
  const bankMat = std({ color: 0xdfe8f3, roughness: 0.95 });
  const banks = [];
  { const r = lcg(5);
    const put = (x, z, s) => banks.push([x, z, s * (0.8 + r() * 0.5), 0.3 + r() * 0.25]);
    for (let z = CZ0 - 0.4; z <= CZ1 + 0.5; z += 0.34) { put(CX0 - 0.15 + r() * 0.3, z, 0.4); put(CX1 + 0.15 - r() * 0.3, z, 0.4); }
    for (let x = CX0 - 0.4; x <= CX1 + 0.5; x += 0.34) put(x, CZ1 + 0.3 + r() * 0.2, 0.42);
    for (let x = CX0 - 0.4; x <= -1.6; x += 0.4) put(x, CZ0 - 0.15, 0.36);
    for (let x = 1.6; x <= CX1 + 0.4; x += 0.4) put(x, CZ0 - 0.15, 0.36);
  }
  const bankMesh = new THREE.InstancedMesh(bankGeo, bankMat, banks.length);
  { const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
    banks.forEach(([x, z, sc, hh], i) => { p.set(x, 0.02, Z3(z)); s.set(sc, sc * hh * 1.6, sc); m.compose(p, q, s); bankMesh.setMatrixAt(i, m); }); }
  bankMesh.castShadow = true; bankMesh.receiveShadow = true;
  root.add(bankMesh);
  // plank boards (the pins bounce off them: the sim's walls are at x = +-2.9 and z = 3.15)
  const plankTex = tex(256, 64, (g, w, h) => {
    const r = lcg(3); g.fillStyle = '#8a5a32'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 40; i++) { g.strokeStyle = `rgba(${r() < 0.5 ? '60,34,16' : '170,120,70'},${0.18 + r() * 0.2})`; g.lineWidth = 1 + r() * 2; g.beginPath(); const y = r() * h; g.moveTo(0, y); g.bezierCurveTo(w * 0.3, y + (r() - 0.5) * 8, w * 0.6, y + (r() - 0.5) * 8, w, y + (r() - 0.5) * 6); g.stroke(); }
    g.fillStyle = 'rgba(30,18,8,0.6)'; g.fillRect(0, h - 3, w, 3);
  }, { repeat: [3, 1] });
  const plankMat = std({ map: plankTex, roughness: 0.78 });
  const capMat = std({ color: 0xffffff, roughness: 0.95 });
  const board = (x0, z0, x1, z1) => {
    const g = new THREE.Group();
    const len = Math.hypot(x1 - x0, z1 - z0);
    const b = new THREE.Mesh(new THREE.BoxGeometry(len, 0.2, 0.07), plankMat); b.position.y = 0.1; b.castShadow = true; b.receiveShadow = true;
    const cap = new THREE.Mesh(new THREE.BoxGeometry(len * 0.98, 0.04, 0.1), capMat); cap.position.y = 0.215; cap.castShadow = true;
    g.add(b, cap);
    g.position.set((x0 + x1) / 2, 0, Z3((z0 + z1) / 2)); g.rotation.y = Math.abs(x1 - x0) >= Math.abs(z1 - z0) ? 0 : Math.PI / 2;
    return g;
  };
  root.add(board(CX0 + 0.1, CZ1 - 0.35, CX1 - 0.1, CZ1 - 0.35));          // back board
  { const l = board(CX0 + 0.1, CZ0 + 1.2, CX0 + 0.1, CZ1 - 0.35); root.add(l); const r2 = board(CX1 - 0.1, CZ0 + 1.2, CX1 - 0.1, CZ1 - 0.35); root.add(r2); }

  // ---- pins: a short turned cylinder of birch with painted bands ----------------------------------------------------------------------------
  const pinProfile = (() => {
    const R = PIN_RAD, h = PIN_H, pts = [], c = 0.011;
    pts.push([0, 0], [R - c, 0]);
    for (let i = 1; i <= 4; i++) { const a = (i / 4) * Math.PI / 2; pts.push([R - c + Math.sin(a) * c, c - Math.cos(a) * c]); }
    pts.push([R, h - c]);
    for (let i = 1; i <= 4; i++) { const a = (i / 4) * Math.PI / 2; pts.push([R - Math.sin(Math.PI / 2 - a) * c, h - c + Math.sin(a) * c]); }
    pts.push([0, h]);
    return pts;
  })();
  const pinGeo = (() => {
    const seg = 18, P = [], N = [], U = [], I = [], n = pinProfile.length;
    for (let j = 0; j < n; j++) {
      const a = pinProfile[Math.max(0, j - 1)], b = pinProfile[Math.min(n - 1, j + 1)];
      let tx = b[0] - a[0], ty = b[1] - a[1]; const l = Math.hypot(tx, ty) || 1; tx /= l; ty /= l;
      for (let i = 0; i <= seg; i++) {
        const th = (i / seg) * TAU, c = Math.cos(th), s = Math.sin(th);
        P.push(pinProfile[j][0] * c, pinProfile[j][1] - PIN_H / 2, pinProfile[j][0] * s); N.push(ty * c, -tx, ty * s); U.push(i / seg, pinProfile[j][1] / PIN_H);
      }
    }
    for (let j = 0; j < n - 1; j++) for (let i = 0; i < seg; i++) { const a = j * (seg + 1) + i, b = a + seg + 1; I.push(a, b, a + 1, b, b + 1, a + 1); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
    g.setIndex(I);
    return g;
  })();
  const bandSets = [['#d4231f', '#fbf6ea'], ['#1f58b8', '#fbf6ea'], ['#1f9a52', '#fbf6ea'], ['#d4231f', '#fbf6ea']];
  const pinMats = bandSets.map(([c1, c2], k) => std({
    roughness: 0.38, metalness: 0,
    map: tex(64, 256, (g, w, h) => {
      // lacquered stripes (v runs 0 = foot ... 1 = head): alternating colour and cream, gilded rings at the ends and the middle
      const n = 7; for (let i = 0; i < n; i++) { g.fillStyle = i % 2 ? c2 : c1; g.fillRect(0, h * (1 - (i + 1) / n), w, h / n + 1); }
      const gold = (v, t) => { const gr = g.createLinearGradient(0, 0, w, 0); gr.addColorStop(0, '#8a5a10'); gr.addColorStop(0.35, '#ffe27a'); gr.addColorStop(0.6, '#d9a21c'); gr.addColorStop(1, '#8a5a10'); g.fillStyle = gr; g.fillRect(0, h * (1 - v) - h * t / 2, w, h * t); };
      gold(0.07, 0.035); gold(0.5, 0.03); gold(0.93, 0.035);
      g.fillStyle = 'rgba(255,255,255,0.22)'; g.fillRect(w * 0.18, 0, w * 0.08, h);
      g.fillStyle = 'rgba(40,10,0,0.25)'; g.fillRect(w * 0.78, 0, w * 0.22, h);
    }),
  }));
  W.pinGeo = pinGeo; W.pinMats = pinMats;
  W.makePin = (id) => { const m = new THREE.Mesh(pinGeo, pinMats[id % pinMats.length]); m.castShadow = true; m.receiveShadow = false; return m; };

  // ---- the bat: a plain turned birch stick, handle end banded -------------------------------------------------------------------------------
  const batGeo = (() => {
    const g = new THREE.CylinderGeometry(BAT_RAD, BAT_RAD * 0.9, BAT_LEN, 16, 1);       // +Y = tip end (slightly slimmer toward the handle at -Y)
    g.translate(0, BAT_LEN / 2, 0);                                                        // butt at the origin, long axis +Y (prop convention)
    return g;
  })();
  const batMat = std({
    roughness: 0.35,
    map: tex(64, 256, (g, w, h) => {
      g.fillStyle = '#c2201c'; g.fillRect(0, 0, w, h);                                    // red lacquer
      g.fillStyle = '#f6ecd2'; for (let i = 0; i < 6; i++) g.fillRect(0, h * (0.36 + i * 0.075), w, h * 0.028);    // painted white bands
      g.fillStyle = '#e9c98a'; g.fillRect(0, 0, w, h * 0.27);                              // bare birch grip, wrapped in dark zig-zag
      g.strokeStyle = '#3a2410'; g.lineWidth = 3; g.beginPath(); for (let i = 0; i < 10; i++) { const y = h * (0.01 + i * 0.026); g.moveTo(0, y + 6); g.lineTo(w * 0.5, y); g.lineTo(w, y + 6); } g.stroke();
      const gold = (v, t) => { g.fillStyle = '#e8b83a'; g.fillRect(0, h * v, w, h * t); g.fillStyle = 'rgba(255,255,220,0.6)'; g.fillRect(0, h * v, w, 2); };
      gold(0.27, 0.03); gold(0.31, 0.012); gold(0.94, 0.03);
      g.fillStyle = 'rgba(255,255,255,0.22)'; g.fillRect(w * 0.18, 0, w * 0.08, h);
    }),
  });
  W.makeBat = () => { const m = new THREE.Mesh(batGeo, batMat); m.castShadow = true; const g = new THREE.Group(); g.add(m); return g; };

  // ---- warm village props: izbas with carved frames, bunting, lanterns, a samovar stand, chimney smoke and steam -------------------------------
  const logTex = tex(256, 128, (g, w, h) => {
    const r = lcg(21);
    for (let y = 0; y < h; y += 16) { g.fillStyle = `hsl(${24 + r() * 8},${55 + r() * 10}%,${34 + r() * 10}%)`; g.fillRect(0, y, w, 15); g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, y + 15, w, 1); g.fillStyle = 'rgba(255,200,140,0.25)'; g.fillRect(0, y + 1, w, 2); }
  }, { repeat: [2, 1.2] });
  const logM = std({ map: logTex, roughness: 0.85 });
  const trimM = std({ color: 0xfff3dc, roughness: 0.6 });
  const roofM = std({ color: 0x8a2f1f, roughness: 0.8 });
  const snowM = std({ color: 0xffffff, roughness: 0.95 });
  const glowM = new THREE.MeshBasicMaterial({ color: 0xffc457 });
  const smokes = [];
  const puffTex = tex(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,0.85)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });
  const addPuffs = (x, y, z, n, tint, rise, spread) => {
    for (let i = 0; i < n; i++) {
      const m = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex, color: tint, transparent: true, depthWrite: false, opacity: 0 }));
      m.userData = { x, y, z, ph: i / n, rise, spread, k: 0.7 + (i % 3) * 0.2 };
      root.add(m); smokes.push(m);
    }
  };
  const izba = (x, z, ry, sc) => {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2.0, 2.8), logM); body.position.y = 1.0; body.castShadow = true; g.add(body);
    for (const sd of [-1, 1]) {   // gabled roof, two steep boards with a snow blanket
      const rf = new THREE.Mesh(new THREE.BoxGeometry(3.9, 0.12, 1.9), roofM); rf.position.set(0, 2.55, sd * 0.78); rf.rotation.x = -sd * 0.62; rf.castShadow = true; g.add(rf);
      const sn = new THREE.Mesh(new THREE.BoxGeometry(3.95, 0.16, 1.92), snowM); sn.position.set(0, 2.64, sd * 0.8); sn.rotation.x = -sd * 0.62; g.add(sn);
    }
    const ch = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.9, 0.4), std({ color: 0x8a3a2a })); ch.position.set(1.1, 3.0, -0.4); g.add(ch);
    const front = 1.41;       // windows and a door on the +z face (towards the court side)
    for (const wx of [-0.95, 0.95]) {
      const fr = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.84, 0.06), trimM); fr.position.set(wx, 1.2, front); g.add(fr);
      const gl = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.58, 0.07), glowM); gl.position.set(wx, 1.2, front + 0.02); g.add(gl);
      for (const sx of [-1, 1]) { const sh = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.76, 0.05), std({ color: 0x2f6fc8 })); sh.position.set(wx + sx * 0.5, 1.2, front + 0.03); g.add(sh); }
      const top = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.14, 0.07), trimM); top.position.set(wx, 1.72, front + 0.01); g.add(top);
    }
    const door = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.4, 0.06), std({ color: 0x3a5a9a })); door.position.set(0, 0.7, front); g.add(door);
    g.position.set(x, 0, Z3(z)); g.rotation.y = ry; g.scale.setScalar(sc); root.add(g);
    addPuffs(x + 1.1 * sc * Math.cos(ry), 3.6 * sc, Z3(z) - 0.4 * sc, 7, 0xe8e2dc, 2.6, 0.5);
    return g;
  };
  izba(-4.4, 6.5, 0.45, 1.0); izba(4.6, 7.5, -0.5, 1.15);
  // bunting across the back of the court
  { const flagCols = [0xd4231f, 0xf4c430, 0x1f58b8, 0xfbf6ea, 0x1f9a52];
    const post = (x) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 2.6, 8), std({ color: 0x6a4a2a })); m.position.set(x, 1.3, Z3(3.75)); m.castShadow = true; root.add(m); const c = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), std({ color: 0xe8b83a, metalness: 0.5, roughness: 0.3 })); c.position.set(x, 2.64, Z3(3.75)); root.add(c); };
    post(-3.0); post(3.0);
    const N = 14;
    for (let i = 0; i < N; i++) {
      const u = (i + 0.5) / N, x = -3.0 + 6.0 * u, y = 2.45 - 0.35 * Math.sin(Math.PI * u);
      const tri = new THREE.Mesh(new THREE.CylinderGeometry(0, 0.17, 0.4, 3), new THREE.MeshStandardMaterial({ color: flagCols[i % flagCols.length], roughness: 0.8, side: THREE.DoubleSide }));
      tri.rotation.set(Math.PI, 0, 0); tri.position.set(x, y - 0.18, Z3(3.75)); tri.userData.ph = i; root.add(tri); (W.flags ||= []).push(tri);
    }
    const rope = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([...Array(9)].map((_, i) => { const u = i / 8; return new THREE.Vector3(-3 + 6 * u, 2.5 - 0.35 * Math.sin(Math.PI * u), Z3(3.75)); })), 24, 0.012, 5), std({ color: 0x3a2a1a }));
    root.add(rope);
  }
  // lanterns on tall posts with a warm halo
  const haloTex = tex(128, 128, (g) => { const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,214,120,0.95)'); gr.addColorStop(0.3, 'rgba(255,170,70,0.4)'); gr.addColorStop(1, 'rgba(255,140,40,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); });
  W.halos = [];
  for (const [x, z] of [[-2.55, 3.0], [2.55, 3.0], [-2.7, -2.0], [2.7, -2.0]]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 1.7, 8), std({ color: 0x3a2a1a })); p.position.set(x, 0.85, Z3(z)); p.castShadow = true; root.add(p);
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.28, 0.2), new THREE.MeshBasicMaterial({ color: 0xffd27a })); l.position.set(x, 1.82, Z3(z)); root.add(l);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0, 0.18, 0.14, 4), std({ color: 0x2a1a10 })); cap.position.set(x, 2.03, Z3(z)); cap.rotation.y = Math.PI / 4; root.add(cap);
    const h = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); h.position.set(x, 1.82, Z3(z)); h.scale.setScalar(1.7); root.add(h); W.halos.push(h);
  }
  // a samovar on a little table by the left board, steaming
  { const g = new THREE.Group(), brass = std({ color: 0xd9a63a, metalness: 0.85, roughness: 0.28 });
    const table = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.06, 0.5), std({ color: 0x8a5a32 })); table.position.y = 0.78; g.add(table);
    for (const [dx, dz] of [[-0.3, -0.2], [0.3, -0.2], [-0.3, 0.2], [0.3, 0.2]]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.78, 0.05), std({ color: 0x6a4a2a })); l.position.set(dx, 0.39, dz); g.add(l); }
    const body = new THREE.Mesh(new THREE.LatheGeometry([[0.02, 0], [0.16, 0.02], [0.19, 0.16], [0.17, 0.3], [0.1, 0.38], [0.05, 0.42], [0.02, 0.44]].map(([r, y]) => new THREE.Vector2(r, y)), 20), brass); body.position.y = 0.81; body.castShadow = true; g.add(body);
    const tap = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.14, 6), brass); tap.rotation.z = Math.PI / 2; tap.position.set(0.22, 0.98, 0); g.add(tap);
    g.position.set(-2.6, 0, Z3(1.2)); g.rotation.y = 0.5; root.add(g);
    addPuffs(-2.6, 1.3, Z3(1.2), 5, 0xffffff, 0.9, 0.12);
  }
  W.update = (dt, t) => {
    for (const m of smokes) {
      const u = m.userData, k = ((t * 0.18 * u.k + u.ph) % 1), wind = 0.6;
      m.position.set(u.x + k * wind + Math.sin(t * 0.7 + u.ph * 9) * u.spread * k, u.y + k * u.rise, u.z);
      m.scale.setScalar(0.3 + k * 1.1 * (u.rise > 2 ? 1.3 : 0.5));
      m.material.opacity = Math.sin(Math.PI * k) * 0.55;
    }
    if (W.flags) for (const f of W.flags) f.rotation.z = Math.sin(t * 2.2 + f.userData.ph) * 0.18;
    if (W.halos) W.halos.forEach((h, i) => { h.material.opacity = 0.8 + 0.2 * Math.sin(t * 5 + i * 1.7) * Math.sin(t * 2.3 + i); });
  };

  // ---- distant props ----------------------------------------------------------------------------------------------------------------------
  // a stack of split firewood and a sled leaning on the fence line at the back of the town, a lantern post by the thrower's line
  const logMat = std({ color: 0xa8763f, roughness: 0.9 }), endMat = std({ color: 0xe6c08a, roughness: 0.8 });
  { const g = new THREE.Group(), r = lcg(9);
    for (let row = 0; row < 3; row++) for (let i = 0; i < 6 - row; i++) {
      const l = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.9, 10), [logMat, endMat, endMat]);
      l.rotation.x = Math.PI / 2; l.position.set(i * 0.17 + row * 0.085, 0.08 + row * 0.15, (r() - 0.5) * 0.04); l.castShadow = true; g.add(l);
    }
    const snow = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.07, 1.0), capMat); snow.position.set(0.42, 0.51, 0); g.add(snow);
    g.position.set(-3.5, 0, Z3(3.9)); g.rotation.y = 0.3; root.add(g);
  }

  // ---- the scenery kit: overcast sky, a snowy village, birches and pines, a falling-snow layer -------------------------------------------
  W.scenery = null;
  try {
    W.scenery = V3.buildScenery({
      culture: 'north-european', season: 'winter', timeOfDay: 'dawn', quality: quality === 'low' ? 'low' : quality === 'medium' ? 'low' : 'medium', wind: 0.5, clouds: 0.3, seed: 4,
      layers: [
        { t: 'sky', id: 'sky-golden' },
        { t: 'backdrop', id: 'bd-snow-village' },
        { t: 'ground', id: 'gr-snow', size: 160, repeat: 16 },
        { t: 'band', id: 'band-snow-pines', r: 70, h: 16, arc: [-175, -5] },
        { t: 'band', id: 'band-birch', r: 38, h: 12, arc: [-170, -10] },
        { t: 'cutouts', id: 'st-farmhouse', count: 3, r: [22, 30], arc: [-150, -35], scale: [7, 9], seed: 8 },
        { t: 'cutouts', id: 'tr-broad-tree', count: 5, r: [14, 20], arc: [-165, -15], scale: [6, 9], seed: 11, sway: 0.5 },
        { t: 'snow', count: quality === 'low' ? 90 : 220 },
      ],
    });
    W.scenery.group.position.y = -0.02;
    stage.scene.add(W.scenery.group);
    W.scenery.ready.catch((e) => console.warn('scenery failed', e));
  } catch (e) { console.warn('scenery unavailable', e); }
  W.dispose = () => {};
  W.PIN_LEN = PIN_LEN; W.PIN_R = PIN_R; W.BOUNDS = BOUNDS; W.clamp = clamp;
  return W;
}

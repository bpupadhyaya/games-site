// The hall: floor with painted lines, backboard and stanchion, rim, a cloth-like net, the ball and a few crowd / banner backdrops.
// Everything is cheap (a handful of draw calls). The net is a spring-damper cloth that is pushed around by the ball only where
// they touch (localised); nothing else on screen moves with it.
import { THREE } from '../vendor3d/index.js';

import { RIM_R, BOARD_Z, BOARD, SCALE_RIM } from '../src/consts.js';
const HW = 7.5, ZB = -1.575, ZH = 9.425, ARC_R = 6.75, ARC_X = 6.6, FT_Z = 4.225, KEY_HW = 2.45;

function canvasTex(w, h, draw, opts = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  if (opts.repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(opts.repeat[0], opts.repeat[1]); }
  return t;
}
const rngf = (seed) => { let s = seed >>> 0; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296; };


// Merge several geometries (each with its own matrix and flat colour) into ONE vertex-coloured geometry: one draw call.
function mergeGeos(list) {
  let nv = 0, ni = 0;
  for (const { geo } of list) { nv += geo.attributes.position.count; ni += geo.index ? geo.index.count : geo.attributes.position.count; }
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), col = new Float32Array(nv * 3), idx = new Uint32Array(ni);
  let vo = 0, io = 0;
  const m3 = new THREE.Matrix3();
  const v = new THREE.Vector3();
  for (const { geo, matrix, color } of list) {
    const c = new THREE.Color(color || '#ffffff');
    m3.getNormalMatrix(matrix);
    const p = geo.attributes.position, n = geo.attributes.normal, u = geo.attributes.uv;
    for (let i = 0; i < p.count; i++) {
      v.set(p.getX(i), p.getY(i), p.getZ(i)).applyMatrix4(matrix);
      pos.set([v.x, v.y, v.z], (vo + i) * 3);
      v.set(n.getX(i), n.getY(i), n.getZ(i)).applyMatrix3(m3).normalize();
      nor.set([v.x, v.y, v.z], (vo + i) * 3);
      if (u) uv.set([u.getX(i), u.getY(i)], (vo + i) * 2);
      col.set([c.r, c.g, c.b], (vo + i) * 3);
    }
    if (geo.index) for (let i = 0; i < geo.index.count; i++) idx[io++] = geo.index.getX(i) + vo; else for (let i = 0; i < p.count; i++) idx[io++] = vo + i;
    vo += p.count;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  return g;
}
const place = (geo, x, y, z, color, rx = 0, ry = 0) => { const o = new THREE.Mesh(); o.position.set(x, y, z); o.rotation.set(rx, ry, 0); o.updateMatrix(); return { geo, matrix: o.matrix.clone(), color }; };

export function buildHall(stage, { quality = 'high' } = {}) {
  const g = new THREE.Group(); g.name = 'hall';
  // ---- floor: the texture covers x in [-9.3, 9.3], z in [-3.4, 11.4] (court plus a margin)
  const X0 = -11.3, X1 = 11.3, Z0 = -4.6, Z1 = 16.0, CWm = X1 - X0, CLm = Z1 - Z0;
  const TW = quality === 'low' ? 1024 : 2048, TH = Math.round(TW * CLm / CWm);
  const PALS = [
    { wood: '#d9a66a', key: '#2f5f9e', ft: '#3b72b8', sur: '#1a3350', pl: [150, 100, 50] },     // maple
    { wood: '#3f6aa0', key: '#d46a2a', ft: '#e07b36', sur: '#14243a', pl: [40, 70, 120] },     // blue floor
    { wood: '#7b7f86', key: '#b0463a', ft: '#c4574a', sur: '#1b2230', pl: [100, 104, 110] },    // street
  ];
  const drawFloor = (pal) => canvasTex(TW, TH, (c, w, h) => {
    const S = w / CWm;
    const X = (x) => (x - X0) * S, Z = (z) => (z - Z0) * S;       // the top of the image is the far end (-z)
    // surround
    c.fillStyle = pal.sur; c.fillRect(0, 0, w, h);
    // playing surface: maple
    const r = rngf(11);
    c.fillStyle = pal.wood; c.fillRect(X(-HW), Z(ZB), 2 * HW * S, (ZH - ZB) * S);
    // planks
    for (let i = 0; i < 90; i++) {
      const x = X(-HW) + (i / 90) * 2 * HW * S;
      c.fillStyle = `rgba(${pal.pl[0] + r() * 30},${pal.pl[1] + r() * 20},${pal.pl[2] + r() * 15},${0.08 + r() * 0.1})`;
      c.fillRect(x, Z(ZB), (2 * HW * S) / 90, (ZH - ZB) * S);
      c.fillStyle = 'rgba(80,50,20,0.18)'; c.fillRect(x, Z(ZB), 1.2, (ZH - ZB) * S);
    }
    // painted key (blue) and the restricted semicircle
    c.fillStyle = pal.key;
    c.fillRect(X(-KEY_HW), Z(ZB), 2 * KEY_HW * S, (FT_Z - ZB) * S);
    c.fillStyle = pal.wood; c.beginPath(); c.arc(X(0), Z(0), 1.25 * S, 0, Math.PI); c.fill();
    c.fillStyle = pal.ft; c.beginPath(); c.arc(X(0), Z(FT_Z), 1.8 * S, 0, Math.PI * 2); c.fill();
    c.save(); c.beginPath(); c.rect(X(-KEY_HW), Z(ZH), 2 * KEY_HW * S, (ZH - FT_Z) * S); c.clip(); c.restore();
    // lines
    c.strokeStyle = '#f7f7f4'; c.lineWidth = 0.05 * S; c.lineCap = 'butt'; c.lineJoin = 'round';
    c.strokeRect(X(-HW), Z(ZB), 2 * HW * S, (ZH - ZB) * S);
    c.strokeRect(X(-KEY_HW), Z(ZB), 2 * KEY_HW * S, (FT_Z - ZB) * S);
    c.beginPath(); c.arc(X(0), Z(FT_Z), 1.8 * S, 0, Math.PI); c.stroke();                 // free-throw circle (solid half towards the camera)
    c.setLineDash([0.18 * S, 0.14 * S]); c.beginPath(); c.arc(X(0), Z(FT_Z), 1.8 * S, Math.PI, Math.PI * 2); c.stroke(); c.setLineDash([]);
    c.beginPath(); c.arc(X(0), Z(0), 1.25 * S, 0, Math.PI); c.stroke();                // no-charge semicircle (towards +z = the camera)
    c.beginPath(); c.moveTo(X(-1.25), Z(0)); c.lineTo(X(-1.25), Z(-0.4)); c.moveTo(X(1.25), Z(0)); c.lineTo(X(1.25), Z(-0.4)); c.stroke();
    // two-point arc: straight sides at x = +-6.6, circle radius 6.75 about the hoop
    const zi = Math.sqrt(ARC_R * ARC_R - ARC_X * ARC_X);
    c.lineWidth = 0.06 * S;
    c.beginPath(); c.moveTo(X(-ARC_X), Z(ZB)); c.lineTo(X(-ARC_X), Z(zi));
    const th0 = Math.atan2(zi, -ARC_X), th1 = Math.atan2(zi, ARC_X);   // angles from +x axis in (x,z): th0 > th1
    for (let i = 0; i <= 80; i++) { const a = th0 + (th1 - th0) * (i / 80); c.lineTo(X(ARC_R * Math.cos(a)), Z(ARC_R * Math.sin(a))); }
    c.lineTo(X(ARC_X), Z(ZB)); c.stroke();
    // hoop mark and a small centre mark in the key
    c.lineWidth = 0.04 * S; c.beginPath(); c.moveTo(X(-0.9), Z(-0.15)); c.lineTo(X(0.9), Z(-0.15)); c.stroke();
    // a modest circle logo at the top of the key and the half-court line label
    c.fillStyle = 'rgba(255,255,255,0.18)'; c.beginPath(); c.arc(X(0), Z(7.0), 0.9 * S, 0, Math.PI * 2); c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.7)'; c.lineWidth = 0.03 * S; c.beginPath(); c.arc(X(0), Z(7.0), 0.9 * S, 0, Math.PI * 2); c.stroke();
    // a faint sheen
    const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(255,255,255,0.05)'); gr.addColorStop(1, 'rgba(0,0,0,0.12)');
    c.fillStyle = gr; c.fillRect(0, 0, w, h);
  });
  const floorTex = drawFloor(PALS[0]);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(CWm, CLm), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.5, metalness: 0.0 }));
  floor.rotation.x = -Math.PI / 2; floor.position.set((X0 + X1) / 2, 0, (Z0 + Z1) / 2); floor.receiveShadow = true; g.add(floor);
  // ---- backboard (transparent, its own mesh), and ONE merged mesh for the stanchion, pad, arm, ring and bracket
  const BW = 2 * BOARD.hw, BH = BOARD.y1 - BOARD.y0;
  const boardTex = canvasTex(512, Math.round(512 * BH / BW), (cx, w, h) => {
    cx.clearRect(0, 0, w, h);
    cx.fillStyle = 'rgba(210,230,245,0.03)'; cx.fillRect(0, 0, w, h);
    cx.strokeStyle = 'rgba(244,247,250,0.38)'; cx.lineWidth = 4; cx.strokeRect(5, 5, w - 10, h - 10);
    const sw = 0.59 * SCALE_RIM / BW * w, sh = 0.45 * SCALE_RIM / BH * h, by = (3.05 - BOARD.y0 + 0.0) / BH;
    cx.strokeRect(w * 0.5 - sw / 2, h - by * h - 0.02 * h, sw, sh);
  });
  const board = new THREE.Mesh(new THREE.BoxGeometry(BW, BH, 0.05), new THREE.MeshStandardMaterial({ map: boardTex, transparent: true, roughness: 0.2, metalness: 0.0, depthWrite: false }));
  board.position.set(0, (BOARD.y0 + BOARD.y1) / 2, BOARD_Z - 0.03); board.renderOrder = 2; g.add(board);
  // ONE merged mesh: the ring and its bracket (the camera looks from behind the hoop, so the support is not drawn)
  const hw = mergeGeos([
    place(new THREE.TorusGeometry(RIM_R + 0.014, 0.019, 10, 56), 0, 3.05, 0, '#ff6a1f', Math.PI / 2),
    place(new THREE.BoxGeometry(0.24, 0.035, 0.26), 0, 3.05, BOARD_Z + 0.07, '#ff6a1f'),
  ]);
  const hardware = new THREE.Mesh(hw, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.2 })); g.add(hardware);

  // ---- net: spring-damper cloth, rows x cols
  const NR = 6, NC = 14, NH = 0.42 * SCALE_RIM, R_BOT = 0.135 * SCALE_RIM;
  const rest = new Float32Array(NR * NC * 3), off = new Float32Array(NR * NC * 3), vel = new Float32Array(NR * NC * 3);
  for (let r = 0; r < NR; r++) for (let c = 0; c < NC; c++) {
    const a = (c / NC) * Math.PI * 2 + (r % 2 ? Math.PI / NC : 0), k = r / (NR - 1), rad = RIM_R * (1 - k) + R_BOT * k;
    const i = (r * NC + c) * 3; rest[i] = Math.cos(a) * rad; rest[i + 1] = 3.05 - 0.01 - k * NH; rest[i + 2] = Math.sin(a) * rad;
  }
  const segs = [];
  for (let r = 0; r < NR - 1; r++) for (let c = 0; c < NC; c++) {
    const a = r * NC + c, b = (r + 1) * NC + c, b2 = (r + 1) * NC + (c + (r % 2 ? 1 : NC - 1)) % NC;
    segs.push(a, b, a, b2);
  }
  const netGeo = new THREE.BufferGeometry();
  const netPos = new Float32Array(segs.length * 3);
  netGeo.setAttribute('position', new THREE.BufferAttribute(netPos, 3));
  const net = new THREE.LineSegments(netGeo, new THREE.LineBasicMaterial({ color: '#f4f4f0', transparent: true, opacity: 0.95 }));
  net.frustumCulled = false; g.add(net);
  function writeNet() {
    for (let s = 0; s < segs.length; s++) { const n = segs[s] * 3; netPos[s * 3] = rest[n] + off[n]; netPos[s * 3 + 1] = rest[n + 1] + off[n + 1]; netPos[s * 3 + 2] = rest[n + 2] + off[n + 2]; }
    netGeo.attributes.position.needsUpdate = true;
  }
  writeNet();
  let netQuiet = true;
  const netApi = {
    // ball: { x, y, z, r } or null; dt seconds. Only the nodes the ball touches are pushed; they spring back and ring down.
    update(ball, dt) {
      const k = 160, cd = 7.5;
      let moving = false;
      const near = ball && Math.abs(ball.x) < 0.9 && Math.abs(ball.z) < 0.9 && ball.y < 3.4 && ball.y > 2.2;
      if (!near && netQuiet) return;
      for (let r = 1; r < NR; r++) for (let c = 0; c < NC; c++) {
        const i = (r * NC + c) * 3;
        let fx = -k * off[i] - cd * vel[i], fy = -k * off[i + 1] - cd * vel[i + 1], fz = -k * off[i + 2] - cd * vel[i + 2];
        // neighbours in the ring pull towards each other (cloth coherence)
        for (const dc of [-1, 1]) { const j = (r * NC + (c + dc + NC) % NC) * 3; fx += 40 * (off[j] - off[i]); fy += 40 * (off[j + 1] - off[i + 1]); fz += 40 * (off[j + 2] - off[i + 2]); }
        const u = ((r - 1) * NC + c) * 3; fx += 30 * (off[u] - off[i]); fy += 30 * (off[u + 1] - off[i + 1]); fz += 30 * (off[u + 2] - off[i + 2]);
        vel[i] += fx * dt; vel[i + 1] += fy * dt; vel[i + 2] += fz * dt;
        off[i] += vel[i] * dt; off[i + 1] += vel[i + 1] * dt; off[i + 2] += vel[i + 2] * dt;
        if (ball) {
          const px = rest[i] + off[i], py = rest[i + 1] + off[i + 1], pz = rest[i + 2] + off[i + 2];
          const dx = px - ball.x, dy = py - ball.y, dz = pz - ball.z, d = Math.hypot(dx, dy, dz), lim = ball.r + 0.012;
          if (d < lim && d > 1e-5) { const push = (lim - d) / d; off[i] += dx * push; off[i + 1] += dy * push; off[i + 2] += dz * push; vel[i] += dx * push * 12; vel[i + 1] += dy * push * 12; vel[i + 2] += dz * push * 12; }
        }
        if (Math.abs(off[i]) + Math.abs(off[i + 1]) + Math.abs(off[i + 2]) + Math.abs(vel[i]) * 0.1 + Math.abs(vel[i + 1]) * 0.1 + Math.abs(vel[i + 2]) * 0.1 > 0.003) moving = true;
      }
      netQuiet = !moving && !near;
      writeNet();
    },
  };

  // ---- backdrop: far wall with banners and a crowd, plus dark side walls
  const wall = canvasTex(1024, 256, (c, w, h) => {
    const r = rngf(5);
    c.fillStyle = '#0e1a2a'; c.fillRect(0, 0, w, h);
    const cols = ['#c45a4a', '#e0b84c', '#3f86c9', '#e8e8ea', '#52a37a', '#8f5ec2', '#d98b3a', '#6fb7c9'];
    for (let row = 0; row < 7; row++) for (let i = 0; i < 120; i++) { c.fillStyle = cols[Math.floor(r() * cols.length)]; c.globalAlpha = 0.5; c.beginPath(); c.arc(i * 8.7 + r() * 4, 100 + row * 20 + r() * 4, 3.4 + r() * 1.6, 0, 6.3); c.fill(); }
    c.globalAlpha = 1;
    const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(8,14,24,0.9)'); gr.addColorStop(0.45, 'rgba(8,14,24,0.1)'); gr.addColorStop(1, 'rgba(8,14,24,0.5)');
    c.fillStyle = gr; c.fillRect(0, 0, w, h);
    // ad boards (generic bands)
    const bands = ['#2f5f9e', '#e0b84c', '#c45a4a', '#52a37a'];
    for (let i = 0; i < 12; i++) { c.fillStyle = bands[i % 4]; c.fillRect(i * (w / 12) + 3, 62, w / 12 - 6, 26); }
  });
  const wallGeo = mergeGeos([
    place(new THREE.PlaneGeometry(46, 9), 0, 4.5, 17.5, '#ffffff', 0, Math.PI),
    place(new THREE.PlaneGeometry(30, 9), -13.5, 4.5, 6, '#ffffff', 0, Math.PI / 2),
    place(new THREE.PlaneGeometry(30, 9), 13.5, 4.5, 6, '#ffffff', 0, -Math.PI / 2),
  ]);
  g.add(new THREE.Mesh(wallGeo, new THREE.MeshStandardMaterial({ map: wall, roughness: 1 })));
  stage.add(g);
  const setCourt = (i) => { const t = drawFloor(PALS[Math.max(0, Math.min(PALS.length - 1, i | 0))]); floor.material.map.dispose(); floor.material.map = t; floor.material.needsUpdate = true; };
  return { group: g, net: netApi, board, floor, setCourt };
}

export function buildBall(scale = 1) {
  const tex = canvasTex(1024, 512, (c, w, h) => {
    const r = rngf(3);
    c.fillStyle = '#d4742a'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 9000; i++) { c.fillStyle = r() < 0.5 ? 'rgba(255,170,90,0.10)' : 'rgba(110,50,10,0.12)'; c.fillRect(r() * w, r() * h, 2.4, 2.4); }
    c.strokeStyle = '#1b130d'; c.lineWidth = 9; c.lineCap = 'round';
    c.beginPath(); c.moveTo(0, h / 2); c.lineTo(w, h / 2); c.stroke();
    for (const x of [0, w / 2, w]) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); }
    for (const x0 of [w * 0.25, w * 0.75]) {
      c.beginPath();
      for (let i = 0; i <= 40; i++) { const t = i / 40, y = t * h, x = x0 + Math.sin(t * Math.PI) * w * 0.12 * (x0 < w / 2 ? -1 : 1) * 0 + Math.sin(t * Math.PI) * 0; if (i === 0) c.moveTo(x, y); else c.lineTo(x, y); }
      c.stroke();
    }
    // curved seams on the sides
    for (const x0 of [w * 0.25, w * 0.75]) for (const sg of [-1, 1]) {
      c.beginPath();
      for (let i = 0; i <= 40; i++) { const t = i / 40, y = t * h, x = x0 + sg * Math.sin(t * Math.PI) * w * 0.1; if (i === 0) c.moveTo(x, y); else c.lineTo(x, y); }
      c.stroke();
    }
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.118 * scale, 32, 20), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.62, metalness: 0 }));
  m.castShadow = true; m.name = 'ball';
  return m;
}

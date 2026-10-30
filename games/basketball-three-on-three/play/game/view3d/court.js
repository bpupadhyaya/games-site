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
    { flat: true, wood: '#c4573a', key: '#1d7f88', ft: '#2a9aa2', sur: '#34424d', pl: [150, 60, 40] },     // terracotta court, teal key (outdoor)
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
    if (pal.flat) { for (let i = 0; i < 26000; i++) { c.fillStyle = r() < 0.5 ? 'rgba(255,200,160,0.07)' : 'rgba(60,20,10,0.10)'; c.fillRect(X(-HW) + r() * 2 * HW * S, Z(ZB) + r() * (ZH - ZB) * S, 2.2, 2.2); } }
    else for (let i = 0; i < 90; i++) {
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

  // ---- backdrop: an evening neighbourhood behind a chain-link fence (outdoor street court)
  const skyline = canvasTex(2048, 512, (c, w, h) => {
    const r = rngf(9);
    const gr = c.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#4d6fa8'); gr.addColorStop(0.45, '#e59a7a'); gr.addColorStop(0.62, '#f7c98e'); gr.addColorStop(1, '#f7c98e');
    c.fillStyle = gr; c.fillRect(0, 0, w, h);
    // soft clouds
    for (let i = 0; i < 14; i++) { c.fillStyle = 'rgba(255,225,200,0.22)'; c.beginPath(); c.ellipse(r() * w, 60 + r() * 130, 90 + r() * 120, 12 + r() * 10, 0, 0, 6.3); c.fill(); }
    const ground = h * 0.86;
    // far towers
    let x = -20;
    while (x < w) { const bw = 60 + r() * 110, bh = 90 + r() * 170; c.fillStyle = `rgb(${120 + r() * 20 | 0},${105 + r() * 15 | 0},${130 + r() * 15 | 0})`; c.fillRect(x, ground - bh, bw, bh); x += bw + 4 + r() * 10; }
    // near apartment blocks with lit windows
    x = -30;
    const brick = ['#8d4a3b', '#a65d44', '#7b5a52', '#b07a58', '#6d4a45'];
    while (x < w) {
      const bw = 140 + r() * 130, bh = 130 + r() * 110; c.fillStyle = brick[r() * brick.length | 0]; c.fillRect(x, ground - bh, bw, bh);
      c.fillStyle = 'rgba(30,20,30,0.25)'; c.fillRect(x, ground - bh, 6, bh);
      for (let wy = ground - bh + 16; wy < ground - 24; wy += 26) for (let wx = x + 14; wx < x + bw - 18; wx += 24) { c.fillStyle = r() < 0.4 ? '#ffd88a' : 'rgba(40,50,70,0.75)'; c.fillRect(wx, wy, 11, 15); }
      x += bw + 6 + r() * 16;
    }
    // trees
    for (let i = 0; i < 26; i++) { const tx = r() * w, th = 50 + r() * 50; c.fillStyle = `rgba(${40 + r() * 20 | 0},${90 + r() * 40 | 0},${50 + r() * 20 | 0},0.95)`; c.beginPath(); c.arc(tx, ground - th * 0.5, th * 0.55, 0, 6.3); c.fill(); c.fillRect(tx - 3, ground - th * 0.4, 6, th * 0.4); }
    c.fillStyle = '#3a4650'; c.fillRect(0, ground, w, h - ground);
  });
  const sk = new THREE.MeshBasicMaterial({ map: skyline, fog: false, side: THREE.DoubleSide });
  const mkWall = (w, hh, x, y, z, ry) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, hh), sk); m.position.set(x, y, z); m.rotation.y = ry; g.add(m); return m; };
  mkWall(90, 22.5, -26, 8.5, 6, Math.PI / 2);        // far side (what the camera looks at)
  mkWall(90, 22.5, 6, 8.5, 26, Math.PI);             // behind the hoop line
  mkWall(90, 22.5, 6, 8.5, -22, 0);
  // chain-link fence: transparent diamond mesh and posts
  const fenceTex = canvasTex(512, 256, (c, w, h) => {
    c.clearRect(0, 0, w, h); c.strokeStyle = 'rgba(210,218,224,0.55)'; c.lineWidth = 1.6;
    for (let i = -h; i < w + h; i += 16) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i + h, h); c.stroke(); c.beginPath(); c.moveTo(i + h, 0); c.lineTo(i, h); c.stroke(); }
    c.fillStyle = 'rgba(190,198,205,0.9)'; c.fillRect(0, 0, w, 5);
  }, { repeat: [6, 1] });
  const fmat = new THREE.MeshBasicMaterial({ map: fenceTex, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false });
  const fenceFar = new THREE.Mesh(new THREE.PlaneGeometry(22, 4.2), fmat); fenceFar.position.set(-11.4, 2.1, 4.7); fenceFar.rotation.y = Math.PI / 2; g.add(fenceFar);
  const fenceBack = new THREE.Mesh(new THREE.PlaneGeometry(22, 4.2), fmat); fenceBack.position.set(0, 2.1, 12.6); g.add(fenceBack);
  const posts = mergeGeos([-5, -1, 3, 7, 11].map((z) => place(new THREE.CylinderGeometry(0.06, 0.06, 4.2, 8), -11.4, 2.1, z + 1, '#9aa3ab')).concat([-9, -5, -1, 3, 7, 11].map((x) => place(new THREE.CylinderGeometry(0.06, 0.06, 4.2, 8), x, 2.1, 12.6, '#9aa3ab'))));
  g.add(new THREE.Mesh(posts, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.4 })));
  // asphalt apron beyond the painted surround
  const apron = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.MeshStandardMaterial({ color: '#3a4650', roughness: 0.95 }));
  apron.rotation.x = -Math.PI / 2; apron.position.set(0, -0.02, 6); g.add(apron);
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

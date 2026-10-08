// The courtyard: flagstones, a pale slab with the chalk course drawn on it, pastel walls with doors and windows, bunting, plants and a bench.
// Textures are drawn once from a seeded generator (no Math.random). A handful of draw calls; the stage's own shadow map covers the players.
import { THREE } from '../vendor3d/index.js';
import { COURSES } from '../src/courses.js';

function lcg(seed) { let x = seed >>> 0; return () => (x = (Math.imul(x, 1664525) + 1013904223) >>> 0) / 4294967296; }
function canvasTex(w, h, draw, repeat, aniso = 8) {
  const c = globalThis.document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
  t.anisotropy = aniso;
  return t;
}
const plane = (w, h, mat, x, y, z, rx = -Math.PI / 2) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.rotation.x = rx; m.position.set(x, y, z); return m; };
export const CHALK_FONT = "'Marker Felt', 'Chalkboard SE', 'Bradley Hand', 'Segoe Print', 'Comic Sans MS', cursive, sans-serif";

// ---- the chalk course, drawn from the course table ---------------------------------------------------------------------------------------
export function chalkTexture(C, ppm = 260) {
  const b = C.bounds, mar = 0.55;
  const x0 = b.x0 - mar, x1 = b.x1 + mar, z0 = b.z0 - mar, z1 = b.z1 + mar;
  const wm = x1 - x0, hm = z1 - z0;
  const W = Math.min(2400, Math.round(wm * ppm)), H = Math.min(2400, Math.round(hm * ppm)), S = W / wm;
  const r = lcg(7 + C.id.length * 13);
  const X = (x) => (x1 - x) * S, Y = (z) => (z1 - z) * S;       // canvas up = +z, canvas right = -x (what a hopper facing +z sees)
  const tex = canvasTex(W, H, (c) => {
    c.clearRect(0, 0, W, H);
    c.lineCap = 'round'; c.lineJoin = 'round';
    const wob = (v) => v + (r() - 0.5) * 0.012 * S;
    // a chalk stroke: a few slightly different passes, broken by dust
    const chalk = (draw, col = '#fff8ec', width = 0.034) => {
      for (let k = 0; k < 3; k++) {
        c.globalAlpha = 0.55 + r() * 0.3; c.strokeStyle = col; c.lineWidth = (width * (0.7 + 0.45 * r())) * S;
        c.beginPath(); draw(k); c.stroke();
      }
      c.globalAlpha = 1;
    };
    const quad = (cell, inflate = 0) => {
      const cs = Math.cos(cell.yaw), sn = Math.sin(cell.yaw), hw = cell.w / 2 + inflate, hd = cell.d / 2 + inflate;
      return [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(([lx, lz]) => [cell.x + lx * cs + lz * sn, cell.z - lx * sn + lz * cs]);
    };
    for (const cell of C.cells) {
      const q = quad(cell);
      if (cell.color && C.id === 'rainbow') {      // coloured chalk fill, light and streaky
        c.save(); c.globalAlpha = 0.34; c.fillStyle = cell.color; c.beginPath(); q.forEach(([x, z], i) => (i ? c.lineTo(X(x), Y(z)) : c.moveTo(X(x), Y(z)))); c.closePath(); c.fill();
        c.globalAlpha = 0.16; for (let k = 0; k < 26; k++) { const t = r(); c.beginPath(); c.moveTo(X(q[0][0] + (q[1][0] - q[0][0]) * t), Y(q[0][1] + (q[1][1] - q[0][1]) * t)); c.lineTo(X(q[3][0] + (q[2][0] - q[3][0]) * t), Y(q[3][1] + (q[2][1] - q[3][1]) * t)); c.strokeStyle = cell.color; c.lineWidth = 0.03 * S; c.stroke(); }
        c.restore();
      }
      chalk(() => { q.forEach(([x, z], i) => (i ? c.lineTo(wob(X(x)), wob(Y(z))) : c.moveTo(wob(X(x)), wob(Y(z))))); c.closePath(); }, cell.color && C.id === 'rainbow' ? '#fffaf0' : '#fff8ec');
      // the number, in chalk handwriting
      if (cell.num) {
        c.save(); c.translate(X(cell.x), Y(cell.z)); c.rotate(-cell.yaw);       // text reads upright for the hopper looking along the course
        c.fillStyle = 'rgba(255,248,236,0.88)'; c.font = `700 ${Math.round(0.24 * S)}px ${CHALK_FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText(String(cell.num), 0, 0.01 * S); c.restore();
      }
    }
    // the Sky: a label and a little arch of rays
    const sky = C.cells.find((x) => x.kind === 'sky');
    if (sky) {
      c.save(); c.translate(X(sky.x), Y(sky.z)); c.rotate(-sky.yaw);
      c.fillStyle = 'rgba(255,248,236,0.85)'; c.font = `700 ${Math.round(0.17 * S)}px ${CHALK_FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('CIELO', 0, -0.07 * S);
      c.strokeStyle = 'rgba(255,224,150,0.85)'; c.lineWidth = 0.022 * S;
      c.beginPath(); c.arc(0, 0.17 * S, 0.1 * S, 0, 6.3); c.stroke();
      for (let k = 0; k < 9; k++) { const a = k * 0.698; c.beginPath(); c.moveTo(Math.cos(a) * 0.14 * S, 0.17 * S + Math.sin(a) * 0.14 * S); c.lineTo(Math.cos(a) * 0.2 * S, 0.17 * S + Math.sin(a) * 0.2 * S); c.stroke(); }
      c.restore();
    }
    // the start line
    const ln = C.line, lcs = Math.cos(ln.yaw), lsn = Math.sin(ln.yaw), half = Math.max(0.55, (C.bounds.x1 - C.bounds.x0 > 3 ? 0.7 : 0.62));
    chalk(() => { c.moveTo(X(ln.x - lcs * half), Y(ln.z + lsn * half)); c.lineTo(X(ln.x + lcs * half), Y(ln.z - lsn * half)); }, '#ffe7b8', 0.04);
    c.save(); c.translate(X(ln.x - lsn * 0.28), Y(ln.z - lcs * 0.28)); c.rotate(-ln.yaw);
    c.fillStyle = 'rgba(255,231,184,0.8)'; c.font = `700 ${Math.round(0.12 * S)}px ${CHALK_FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('SALIDA', 0, 0); c.restore();
    // chalk dust specks around the lines
    c.globalAlpha = 0.3; c.fillStyle = '#fff8ec';
    for (let i = 0; i < 700; i++) { const cell = C.cells[(r() * C.cells.length) | 0]; c.beginPath(); c.arc(X(cell.x) + (r() - 0.5) * 0.7 * S, Y(cell.z) + (r() - 0.5) * 0.7 * S, 0.6 + r() * 1.3, 0, 6.3); c.fill(); }
    c.globalAlpha = 1;
  });
  return { tex, x0, x1, z0, z1, wm, hm };
}

function wallTexture(seed, base, accent, trim) {
  return canvasTex(1024, 512, (c, w, h) => {
    const r = lcg(seed);
    c.fillStyle = base; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 380; i++) { c.globalAlpha = 0.045; c.fillStyle = r() > 0.5 ? '#3a2410' : '#fff4dc'; c.fillRect(r() * w, r() * h, 6 + r() * 70, 3 + r() * 14); }
    c.globalAlpha = 1;
    c.fillStyle = accent; c.fillRect(0, h * 0.74, w, h * 0.26);                    // painted dado
    c.fillStyle = trim; c.fillRect(0, h * 0.735, w, h * 0.014); c.fillRect(0, 0, w, h * 0.03);
    const win = (x, y, ww, hh) => {
      c.fillStyle = '#2a3a46'; c.fillRect(x - 6, y - 6, ww + 12, hh + 12);
      c.fillStyle = '#a9d4e0'; c.fillRect(x, y, ww, hh);
      c.fillStyle = 'rgba(255,255,255,0.35)'; c.beginPath(); c.moveTo(x, y + hh); c.lineTo(x + ww * 0.45, y); c.lineTo(x + ww * 0.7, y); c.lineTo(x + ww * 0.25, y + hh); c.fill();
      c.fillStyle = '#2a3a46'; c.fillRect(x + ww / 2 - 3, y, 6, hh); c.fillRect(x, y + hh / 2 - 3, ww, 6);
      c.fillStyle = trim; c.fillRect(x - 12, y + hh + 6, ww + 24, 10);
      const sh = ['#2e7f88', '#e07b4a', '#4d9a52'][(seed + ((x / 7) | 0)) % 3];
      c.fillStyle = sh; c.fillRect(x - ww * 0.42, y - 4, ww * 0.38, hh + 8); c.fillRect(x + ww * 1.04, y - 4, ww * 0.38, hh + 8);
      c.fillStyle = 'rgba(0,0,0,0.18)'; for (let k = 1; k < 8; k++) { c.fillRect(x - ww * 0.42, y - 4 + (hh + 8) * k / 8, ww * 0.38, 2); c.fillRect(x + ww * 1.04, y - 4 + (hh + 8) * k / 8, ww * 0.38, 2); }
    };
    const door = (x, ww) => {
      c.fillStyle = '#5a3a22'; c.beginPath(); c.moveTo(x, h); c.lineTo(x, h * 0.42); c.arc(x + ww / 2, h * 0.42, ww / 2, Math.PI, 0); c.lineTo(x + ww, h); c.fill();
      c.fillStyle = '#7a5232'; c.beginPath(); c.moveTo(x + 10, h); c.lineTo(x + 10, h * 0.43); c.arc(x + ww / 2, h * 0.43, ww / 2 - 10, Math.PI, 0); c.lineTo(x + ww - 10, h); c.fill();
      c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(x + ww / 2 - 2, h * 0.3, 4, h * 0.7);
      c.fillStyle = trim; c.lineWidth = 12; c.strokeStyle = trim; c.beginPath(); c.moveTo(x - 6, h); c.lineTo(x - 6, h * 0.42); c.arc(x + ww / 2, h * 0.42, ww / 2 + 6, Math.PI, 0); c.lineTo(x + ww + 6, h); c.stroke();
      c.fillStyle = '#e8c06a'; c.beginPath(); c.arc(x + ww * 0.7, h * 0.7, 6, 0, 6.3); c.fill();
    };
    const slots = [90, 330, 570, 810];
    const hasDoor = seed % 2 === 0 ? 1 : 2;
    slots.forEach((x, i) => { if (i === hasDoor) door(x - 10, 160); else win(x, h * 0.2, 130, h * 0.3); });
    c.fillStyle = 'rgba(0,0,0,0.1)'; c.fillRect(0, h * 0.92, w, h * 0.08);
  }, null, 4);
}

function buntingTexture() {
  return canvasTex(1024, 64, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    c.strokeStyle = '#6a4a2e'; c.lineWidth = 3; c.beginPath(); c.moveTo(0, 3); c.lineTo(w, 3); c.stroke();
    const cols = ['#e2503c', '#ffc94d', '#1f9d8f', '#f28ab4', '#4a8ae0', '#7bc96f'];
    const n = 16, fw = w / n;
    for (let i = 0; i < n; i++) {
      c.fillStyle = cols[i % cols.length]; c.beginPath(); c.moveTo(i * fw + 4, 3); c.lineTo((i + 1) * fw - 4, 3); c.lineTo(i * fw + fw / 2, h - 4); c.closePath(); c.fill();
      c.fillStyle = 'rgba(255,255,255,0.35)';
      for (let k = 0; k < 3; k++) { c.beginPath(); c.arc(i * fw + fw / 2, 16 + k * 11 - Math.abs(k - 1) * 0, 2.2, 0, 6.3); c.fill(); }
    }
  }, null, 4);
}

function flagstoneTexture() {
  return canvasTex(512, 512, (c, w, h) => {
    const r = lcg(31);
    c.fillStyle = '#b9a68c'; c.fillRect(0, 0, w, h);
    const cols = 4, rows = 4, cw = w / cols, ch = h / rows;
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const sh = 0.86 + r() * 0.2, x = i * cw + (j % 2 ? cw / 2 : 0);
      for (const xx of [x, x - w]) {
        c.fillStyle = `rgb(${Math.round(190 * sh)},${Math.round(171 * sh)},${Math.round(142 * sh)})`; c.fillRect(xx + 3, j * ch + 3, cw - 6, ch - 6);
        for (let k = 0; k < 60; k++) { c.globalAlpha = 0.07; c.fillStyle = r() > 0.5 ? '#4a3a28' : '#fff0d6'; c.fillRect(xx + 4 + r() * (cw - 14), j * ch + 4 + r() * (ch - 14), 2 + r() * 14, 2 + r() * 8); }
        c.globalAlpha = 1;
      }
    }
    c.strokeStyle = 'rgba(60,44,28,0.5)'; c.lineWidth = 3;
    for (let j = 0; j <= rows; j++) { c.beginPath(); c.moveTo(0, j * ch); c.lineTo(w, j * ch); c.stroke(); }
    for (let j = 0; j < rows; j++) for (let i = -1; i <= cols; i++) { const x = i * cw + (j % 2 ? cw / 2 : 0); c.beginPath(); c.moveTo(x, j * ch); c.lineTo(x, (j + 1) * ch); c.stroke(); }
  }, [14, 14]);
}

function slabTexture() {
  return canvasTex(512, 512, (c, w, h) => {
    const r = lcg(77);
    c.fillStyle = '#8c857a'; c.fillRect(0, 0, w, h);
    for (let i = 0; i < 1400; i++) { c.globalAlpha = 0.06 + r() * 0.07; c.fillStyle = r() > 0.5 ? '#3c3a38' : '#bdb9b2'; const s = 2 + r() * 14; c.fillRect(r() * w, r() * h, s, s * (0.4 + r())); }
    c.globalAlpha = 0.5; c.strokeStyle = '#4a4744'; c.lineWidth = 2;
    for (let i = 0; i < 6; i++) { c.beginPath(); let x = r() * w, y = r() * h; c.moveTo(x, y); for (let k = 0; k < 6; k++) { x += (r() - 0.5) * 60; y += (r() - 0.2) * 40; c.lineTo(x, y); } c.stroke(); }
    c.globalAlpha = 1;
  }, [1, 1]);
}

// ---- the scene -----------------------------------------------------------------------------------------------------------------------------
export function buildCourtyard(stage) {
  const root = new THREE.Group(); root.name = 'courtyard';
  const S = { root, course: null, chalk: null, parts: {}, flags: [] };
  const flag = flagstoneTexture();
  const ground = plane(120, 120, new THREE.MeshStandardMaterial({ map: flag, roughness: 1 }), 0, -0.004, 0);
  ground.receiveShadow = true; root.add(ground);
  const slabMat = new THREE.MeshStandardMaterial({ map: slabTexture(), roughness: 0.95 });
  const slab = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), slabMat); slab.rotation.x = -Math.PI / 2; slab.receiveShadow = true; root.add(slab);
  const chalkMat = new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, opacity: 0.96, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const chalkMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), chalkMat); chalkMesh.rotation.set(-Math.PI / 2, 0, Math.PI); chalkMesh.renderOrder = 2; root.add(chalkMesh);
  S.parts = { slab, chalkMesh, chalkMat };
  // walls (rebuilt around the course)
  S.walls = new THREE.Group(); root.add(S.walls);
  S.props = new THREE.Group(); root.add(S.props);
  S.bunting = new THREE.Group(); root.add(S.bunting);
  S.wallTex = [wallTexture(2, '#f0c27a', '#d9613f', '#fff1d2'), wallTexture(5, '#a9d8c9', '#2e7f88', '#fff1d2'), wallTexture(4, '#f2b3a0', '#7a4a8c', '#fff1d2'), wallTexture(7, '#f7e0a0', '#3d8a5a', '#fff1d2')];
  S.buntingTex = buntingTexture();

  function setCourse(id) {
    if (S.course === id) return;
    S.course = id;
    const C = COURSES[id];
    const old = S.chalk; S.chalk = chalkTexture(C);
    if (old) old.tex.dispose();
    const k = S.chalk;
    chalkMat.map = k.tex; chalkMat.needsUpdate = true;
    chalkMesh.scale.set(k.wm, k.hm, 1); chalkMesh.position.set((k.x0 + k.x1) / 2, 0.003, (k.z0 + k.z1) / 2);
    const sm = 0.45;
    slab.scale.set(k.wm + sm, k.hm + sm, 1); slab.position.set((k.x0 + k.x1) / 2, 0.0, (k.z0 + k.z1) / 2);
    slabMat.map.repeat.set((k.wm + sm) / 2.2, (k.hm + sm) / 2.2); slabMat.map.needsUpdate = true;
    // walls
    for (const ch of [...S.walls.children]) { S.walls.remove(ch); ch.geometry.dispose(); ch.material.dispose(); }
    for (const ch of [...S.props.children]) { S.props.remove(ch); ch.geometry?.dispose(); }
    for (const ch of [...S.bunting.children]) { S.bunting.remove(ch); ch.geometry.dispose(); ch.material.dispose(); }
    const b = C.bounds, cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
    const hx = (b.x1 - b.x0) / 2 + 5.2, hz = (b.z1 - b.z0) / 2 + 5.2;
    const Hh = 3.6;
    const wall = (len, x, z, ry, tex, rep) => {
      const t = tex.clone(); t.needsUpdate = true; t.wrapS = THREE.RepeatWrapping; t.repeat.set(rep, 1);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(len, Hh), new THREE.MeshStandardMaterial({ map: t, roughness: 1 }));
      m.position.set(x, Hh / 2, z); m.rotation.y = ry; S.walls.add(m); return m;
    };
    wall(hx * 2, cx, cz + hz, Math.PI, S.wallTex[0], Math.max(1, Math.round(hx * 2 / 8)));
    wall(hx * 2, cx, cz - hz, 0, S.wallTex[1], Math.max(1, Math.round(hx * 2 / 8)));
    wall(hz * 2, cx - hx, cz, Math.PI / 2, S.wallTex[2], Math.max(1, Math.round(hz * 2 / 8)));
    wall(hz * 2, cx + hx, cz, -Math.PI / 2, S.wallTex[3], Math.max(1, Math.round(hz * 2 / 8)));
    // wall caps
    const capMat = new THREE.MeshStandardMaterial({ color: '#d9a066', roughness: 1 });
    for (const [w, d, x, z] of [[hx * 2 + 0.6, 0.4, cx, cz + hz], [hx * 2 + 0.6, 0.4, cx, cz - hz], [0.4, hz * 2 + 0.6, cx - hx, cz], [0.4, hz * 2 + 0.6, cx + hx, cz]]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.14, d), capMat); m.position.set(x, Hh + 0.07, z); S.props.add(m);
    }
    // bunting across the courtyard (two lines), sagging like a rope
    const strand = (x0, y0, z0, x1, y1, z1, sag, rep) => {
      const seg = 24, pos = [], uv = [], idx = [];
      for (let i = 0; i <= seg; i++) {
        const u = i / seg, x = x0 + (x1 - x0) * u, z = z0 + (z1 - z0) * u, y = y0 + (y1 - y0) * u - sag * 4 * u * (1 - u);
        pos.push(x, y, z, x, y - 0.42, z); uv.push(u * rep, 1, u * rep, 0);
        if (i < seg) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
      const t = S.buntingTex.clone(); t.needsUpdate = true; t.wrapS = THREE.RepeatWrapping;
      const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: t, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide }));
      S.bunting.add(m);
    };
    const off = 0.25;
    strand(cx - hx + 0.5, 3.15, cz + hz - off, cx + hx - 0.5, 3.15, cz + hz - off, 0.55, Math.max(2, Math.round(hx * 2 / 6)));
    strand(cx - hx + 0.5, 3.15, cz - hz + off, cx + hx - 0.5, 3.15, cz - hz + off, 0.55, Math.max(2, Math.round(hx * 2 / 6)));
    strand(cx - hx + off, 3.15, cz - hz + 0.5, cx - hx + off, 3.15, cz + hz - 0.5, 0.55, Math.max(2, Math.round(hz * 2 / 6)));
    strand(cx + hx - off, 3.15, cz - hz + 0.5, cx + hx - off, 3.15, cz + hz - 0.5, 0.55, Math.max(2, Math.round(hz * 2 / 6)));
    // plants, bench, crates
    const pot = new THREE.MeshStandardMaterial({ color: '#c8643c', roughness: 1 }), leaf = new THREE.MeshStandardMaterial({ color: '#4d9a52', roughness: 1 }), leaf2 = new THREE.MeshStandardMaterial({ color: '#79b85f', roughness: 1 }), bloom = [new THREE.MeshStandardMaterial({ color: '#e0457b', roughness: 1 }), new THREE.MeshStandardMaterial({ color: '#ffc94d', roughness: 1 })];
    const plant = (x, z, sc, kind) => {
      const g = new THREE.Group();
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.22 * sc, 0.16 * sc, 0.38 * sc, 14), pot); p.position.y = 0.19 * sc; g.add(p);
      const bush = new THREE.Mesh(new THREE.SphereGeometry(0.34 * sc, 14, 10), kind ? leaf2 : leaf); bush.position.y = 0.6 * sc; bush.scale.y = 0.85; g.add(bush);
      for (let i = 0; i < 5; i++) { const f = new THREE.Mesh(new THREE.SphereGeometry(0.06 * sc, 8, 6), bloom[(i + kind) % 2]); const a = i * 1.26; f.position.set(Math.cos(a) * 0.28 * sc, 0.62 * sc + (i % 2) * 0.1, Math.sin(a) * 0.28 * sc); g.add(f); }
      g.position.set(x, 0, z); S.props.add(g);
    };
    const wx = hx - 0.5, wz = hz - 0.5;
    plant(cx - wx, cz - wz * 0.5, 1.3, 0); plant(cx + wx, cz + wz * 0.3, 1.2, 1); plant(cx - wx, cz + wz * 0.7, 1.0, 1); plant(cx + wx, cz - wz * 0.8, 1.1, 0);
    plant(cx - wx * 0.3, cz + wz, 1.2, 1); plant(cx + wx * 0.5, cz - wz, 1.2, 0); plant(cx - wx * 0.8, cz - wz, 1.0, 0); plant(cx + wx * 0.9, cz + wz, 1.0, 1);
    const wood = new THREE.MeshStandardMaterial({ color: '#8b5a34', roughness: 1 });
    const bx = cx + wx - 0.4, bz = cz - wz * 0.1;
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.07, 1.6), wood); seat.position.set(bx, 0.45, bz); S.props.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.4, 1.6), wood); back.position.set(bx + 0.2, 0.7, bz); S.props.add(back);
    for (const dz of [-0.65, 0.65]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.45, 0.07), wood); leg.position.set(bx, 0.225, bz + dz); S.props.add(leg); }
    for (const [dx, dz] of [[0, 0], [0.5, 0.15], [0.2, 0.55]]) { const cr = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.34, 0.42), wood); cr.position.set(cx - wx + 0.5 + dx, 0.17 + (dx > 0.3 ? 0 : 0), cz - hz * 0.0 + 1.0 + dz); cr.rotation.y = dx; S.props.add(cr); }
  }
  S.setCourse = setCourse;
  S.dispose = () => { stage.remove(root); };
  stage.add(root);
  return S;
}

// ---- gameplay overlays that live in the 3D scene: highlight under the target, closing ring, reticle, the tejo ----------------------------------
export function ringTexture() {
  return canvasTex(256, 256, (c, w, h) => {
    c.clearRect(0, 0, w, h);
    c.lineWidth = 16; c.strokeStyle = '#ffffff'; c.beginPath(); c.arc(w / 2, h / 2, w / 2 - 14, 0, 6.3); c.stroke();
    c.lineWidth = 5; c.strokeStyle = 'rgba(255,255,255,0.7)'; c.beginPath(); c.arc(w / 2, h / 2, w / 2 - 34, 0, 6.3); c.stroke();
  }, null, 4);
}
export function glowTexture() {
  return canvasTex(128, 128, (c, w, h) => {
    const g = c.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,0.95)'); g.addColorStop(0.45, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  }, null, 1);
}
export function skyTexture() {
  return canvasTex(8, 256, (c, w, h) => {
    const gr = c.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#5aa9e6'); gr.addColorStop(0.5, '#a9d8f4'); gr.addColorStop(1, '#ffe6b8');
    c.fillStyle = gr; c.fillRect(0, 0, w, h);
  }, null, 1);
}

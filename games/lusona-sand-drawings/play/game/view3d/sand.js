// The sand bed: a raked golden-sand heightfield with finger-drawn grooves, pigment in the groove, pebbles on the dots, carved
// stone frames on the fixed tiles, struts as shallow scratches, a gold glow when the one line closes.
// Reads configuration only (W, H, cfg, locked); the simulation never sees any of this.
// Units are metres: one cell = CELL. Line coordinates are in cell units with (0,0) the top-left cell corner.
import { THREE, board3d as B } from '../vendor3d/index.js';
import { buildArcs, loopPaths } from '../src/view.js';
import { isDot, strutOf, trace } from '../src/mirror.js';

export const CELL = 0.3, PAD = 0.66, GROOVE = 0.115;   // groove width in cells
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hash = (i) => { let x = (Math.imul(i + 1, 2654435761)) >>> 0; x = (x ^ (x >>> 15)) >>> 0; x = Math.imul(x, 2246822519) >>> 0; return ((x ^ (x >>> 13)) >>> 0) / 4294967296; };
const cv = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(2, Math.round(w)); c.height = Math.max(2, Math.round(h)); return c; };
const css = (c) => new THREE.Color(c);
const mixHex = (a, b, t) => { const x = css(a), y = css(b); x.lerp(y, t); return '#' + x.getHexString(); };

const PIGMENT_SINGLE = '#ffd27a';

export function createSand({ quality = 'high' } = {}) {
  const Q = quality === 'ultra' ? { res: 2048, vert: 0.0062 } : quality === 'low' ? { res: 640, vert: 0.022 } : quality === 'medium' ? { res: 896, vert: 0.016 } : { res: 1280, vert: 0.011 };
  const group = new THREE.Group(); group.name = 'sand';
  let W = 0, H = 0, PW = 1, PH = 1, ppm = 1, cellPx = 1;
  let plate = null, mat = null, texC = null, texH = null, texE = null, cC = null, cH = null, cE = null, baseC = null, baseH = null, staticC = null, staticH = null;
  let look = null, lastKey = '';
  let pebbles = null, frames = null, frameGeo = null, ringHint = null, ringFocus = null, glowRunner = null, runnerLight = null;
  const pebbleList = [];   // lattice dots currently placed
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _c = new THREE.Color();

  // ----------------------------------------------------------------- shared geometry / materials
  const pebbleGeo = new THREE.SphereGeometry(1, 20, 14);
  const pebbleMat = B.material('stone', { color: '#b8a58d', color2: '#e9dcc4', roughness: 0.62, size: 256, repeat: [1, 1], seed: 21 });
  pebbleMat.bumpMap = null; pebbleMat.map = null; pebbleMat.color.set('#ffffff'); pebbleMat.needsUpdate = true; pebbleMat.envMapIntensity = 0.7;
  const frameMat = B.material('stone', { color: '#6a5d50', color2: '#a89a86', roughness: 0.8, size: 256, repeat: [3, 3], seed: 7 });
  const ringMatHint = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, toneMapped: false, opacity: 0 });
  const ringTex = (() => {
    const c = cv(256, 256), x = c.getContext('2d'), g = x.createRadialGradient(128, 128, 60, 128, 128, 126);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.55, 'rgba(255,255,255,0.0)'); g.addColorStop(0.74, 'rgba(255,255,255,0.95)'); g.addColorStop(0.86, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 256, 256); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  ringMatHint.map = ringTex;
  const flatQuad = new THREE.PlaneGeometry(1, 1); flatQuad.rotateX(-Math.PI / 2);

  // ----------------------------------------------------------------- level geometry + base layers
  function dims(w, h) {
    W = w; H = h; PW = (W + 2 * PAD) * CELL; PH = (H + 2 * PAD) * CELL;
    ppm = Q.res / Math.max(PW, PH); cellPx = CELL * ppm;
  }
  function buildPlate() {
    if (plate) { group.remove(plate); plate.geometry.dispose(); }
    const sx = clamp(Math.round(PW / Q.vert), 40, 420), sz = clamp(Math.round(PH / Q.vert), 40, 420);
    const g = new THREE.PlaneGeometry(PW, PH, sx, sz); g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position, hw = PW / 2, hh = PH / 2, rim = 0.16, corner = 0.34 * CELL * 1.0;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      // distance to the rounded-rect boundary (inside positive)
      const qx = Math.abs(x) - (hw - corner), qz = Math.abs(z) - (hh - corner);
      const d = corner - (Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0));
      const t = clamp(d / rim, 0, 1), s = t * t * (3 - 2 * t);
      // gentle mound: the bed is a heaped patch of sand, slightly domed
      const dome = 0.012 * (1 - Math.min(1, (x * x) / (hw * hw) + (z * z) / (hh * hh)));
      pos.setY(i, 0.0045 + s * (0.0285 + dome));
    }
    g.computeVertexNormals();
    plate = new THREE.Mesh(g, mat); plate.receiveShadow = true; plate.castShadow = false; plate.name = 'sandPlate';
    group.add(plate);
  }
  function ensureTextures() {
    const w = Math.round(PW * ppm), h = Math.round(PH * ppm);
    if (cC && cC.width === w && cC.height === h) return false;
    for (const t of [texC, texH, texE]) t && t.dispose();
    cC = cv(w, h); cH = cv(w, h); cE = cv(w, h); baseC = cv(w, h); baseH = cv(w, h); staticC = cv(w, h); staticH = cv(w, h);
    const mk = (c, srgb) => { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; return t; };
    texC = mk(cC, true); texH = mk(cH, false); texE = mk(cE, true);
    if (!mat) {
      mat = new THREE.MeshStandardMaterial({ roughness: 0.96, metalness: 0, emissive: new THREE.Color('#ffb640'), emissiveIntensity: 0, envMapIntensity: 0.55 });
    }
    mat.map = texC; mat.bumpMap = texH; mat.bumpScale = 3.4; mat.displacementMap = texH; mat.displacementScale = 0.07; mat.displacementBias = -0.0425;
    mat.emissiveMap = texE; mat.needsUpdate = true;
    return true;
  }
  // static sand: rake furrows + grain, per look
  function paintBase() {
    const c = baseC.getContext('2d'), h = baseH.getContext('2d'), w = baseC.width, hgt = baseC.height;
    const warm = (c) => mixHex(c, '#c8903a', 0.28);
    const g = c.createLinearGradient(0, 0, w, hgt); g.addColorStop(0, warm(look.sand0)); g.addColorStop(0.5, warm(mixHex(look.sand0, look.sand1, 0.55))); g.addColorStop(1, warm(look.sand1));
    c.fillStyle = g; c.fillRect(0, 0, w, hgt);
    h.fillStyle = 'rgb(160,160,160)'; h.fillRect(0, 0, w, hgt);
    // large soft variation (wind-blown drifts)
    for (let i = 0; i < 38; i++) {
      const x = hash(i * 3) * w, y = hash(i * 3 + 1) * hgt, r = (0.1 + hash(i * 3 + 2) * 0.22) * w, a = 0.05 + hash(i + 400) * 0.07, dark = i % 2 === 0;
      const rg = c.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, dark ? `rgba(120,80,35,${a})` : `rgba(255,248,225,${a * 1.3})`); rg.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = rg; c.fillRect(x - r, y - r, r * 2, r * 2);
    }
    // rake furrows: long gentle parallel lines
    const step = cellPx * 0.2, ang = -0.06;
    for (let y0 = -step * 3; y0 < hgt + step * 3; y0 += step) {
      const ph = hash(Math.round(y0 * 7) + 11) * TAU, amp = cellPx * 0.025;
      c.beginPath(); h.beginPath();
      for (let x = -4; x <= w + 8; x += 10) {
        const y = y0 + Math.sin(x * 0.012 + ph) * amp + x * ang * 0.3 + Math.sin(x * 0.0035 + ph * 2) * amp * 1.4;
        if (x === -4) { c.moveTo(x, y); h.moveTo(x, y); } else { c.lineTo(x, y); h.lineTo(x, y); }
      }
      c.lineWidth = Math.max(1.2, step * 0.2); c.strokeStyle = 'rgba(80,48,18,0.11)'; c.stroke();
      h.lineWidth = Math.max(1.5, step * 0.3); h.strokeStyle = 'rgba(95,95,95,0.4)'; h.stroke();
      c.translate(0, step * 0.34); h.translate(0, step * 0.34);
      c.lineWidth = Math.max(1, step * 0.14); c.strokeStyle = 'rgba(255,246,218,0.12)'; c.stroke();
      h.lineWidth = Math.max(1, step * 0.18); h.strokeStyle = 'rgba(225,225,225,0.35)'; h.stroke();
      c.translate(0, -step * 0.34); h.translate(0, -step * 0.34);
    }
    // grain: several scales of speckle, light and dark, plus the odd fleck
    const n = Math.round((w * hgt) / 11);
    for (let i = 0; i < n; i++) {
      const x = hash(i * 2 + 5) * w, y = hash(i * 2 + 6) * hgt, k = hash(i + 4000), r = 0.6 + hash(i + 900) * (k > 0.93 ? 2.4 : 1.2);
      c.fillStyle = k < 0.5 ? `rgba(104,64,24,${0.12 + k * 0.4})` : k < 0.93 ? `rgba(255,243,208,${0.14 + (k - 0.5) * 0.7})` : `rgba(255,255,248,0.8)`;
      c.fillRect(x, y, r, r);
      const v = Math.round(146 + k * 34); h.fillStyle = `rgba(${v},${v},${v},0.6)`; h.fillRect(x, y, r + 0.5, r + 0.5);
    }
    // keep the very edge of the height field flat so the displaced rim is a clean curve
    {
      const e = Math.max(6, 0.1 * ppm);
      for (const [x0, y0, x1, y1, w0, h0] of [[0, 0, e, 0, e, hgt], [w, 0, w - e, 0, e, hgt], [0, 0, 0, e, w, e], [0, hgt, 0, hgt - e, w, e]]) {
        const gr = h.createLinearGradient(x0, y0, x1, y1); gr.addColorStop(0, 'rgba(160,160,160,1)'); gr.addColorStop(1, 'rgba(160,160,160,0)');
        h.fillStyle = gr; h.fillRect(x0 === w ? w - e : x0, y0 === hgt ? hgt - e : y0, w0, h0);
      }
    }
    // the bed melts into the earth round its rim
    {
      const e = Math.max(8, 0.13 * ppm);
      for (const [x0, y0, x1, y1, rx, ry, rw, rh] of [[0, 0, e, 0, 0, 0, e, hgt], [w, 0, w - e, 0, w - e, 0, e, hgt], [0, 0, 0, e, 0, 0, w, e], [0, hgt, 0, hgt - e, 0, hgt - e, w, e]]) {
        const gr = c.createLinearGradient(x0, y0, x1, y1); gr.addColorStop(0, 'rgba(150,100,60,1)'); gr.addColorStop(0.55, 'rgba(150,100,60,0.45)'); gr.addColorStop(1, 'rgba(150,100,60,0)');
        c.fillStyle = gr; c.fillRect(rx, ry, rw, rh);
      }
    }
    // bigger sand clumps / tiny shells and flecks
    for (let i = 0; i < 70; i++) {
      const x = hash(i * 5 + 77) * w, y = hash(i * 5 + 78) * hgt, r = 1.2 + hash(i + 33) * 2.6;
      c.fillStyle = i % 3 ? 'rgba(255,250,240,0.35)' : 'rgba(70,45,20,0.35)'; c.beginPath(); c.ellipse(x, y, r * 1.2, r, hash(i) * TAU, 0, TAU); c.fill();
      h.fillStyle = 'rgba(215,215,215,0.7)'; h.beginPath(); h.ellipse(x, y, r * 1.2, r, hash(i) * TAU, 0, TAU); h.fill();
    }
  }

  // ----------------------------------------------------------------- stroking helpers
  const ax = (a) => (PAD + a.cx) * cellPx, ay = (a) => (PAD + a.cy) * cellPx;
  function arcPath(ctx, a, frac = 1) {
    ctx.beginPath();
    const d = a.d * frac;
    if (Math.abs(d) < 1e-4) { const px = ax(a) + Math.cos(a.p) * 0.5 * cellPx, py = ay(a) + Math.sin(a.p) * 0.5 * cellPx; ctx.moveTo(px, py); ctx.lineTo(px + 0.01, py); return; }
    ctx.arc(ax(a), ay(a), 0.5 * cellPx, a.p, a.p + d, d < 0);
  }
  // The arcs are re-created per context (Path2D shared): build a Path2D per arc fraction.
  const path2d = (a, frac) => {
    const p = new Path2D(), d = a.d * frac;
    if (Math.abs(d) < 1e-4) { const px = ax(a) + Math.cos(a.p) * 0.5 * cellPx, py = ay(a) + Math.sin(a.p) * 0.5 * cellPx; p.moveTo(px, py); p.lineTo(px + 0.01, py); return p; }
    p.arc(ax(a), ay(a), 0.5 * cellPx, a.p, a.p + d, d < 0); return p;
  };
  function drawArcs(ch, cc, ce, arcs, colorOf, o = {}) {
    const lw = GROOVE * cellPx, paths = arcs.map((a) => ({ a, p: path2d(a, o.fracOf ? o.fracOf(a) : 1), f: o.fracOf ? o.fracOf(a) : 1 })).filter((q) => q.f > 0);
    for (const c of [ch, cc, ce]) { c.lineCap = 'round'; c.lineJoin = 'round'; }
    // height: berm + stepped U groove
    for (const [k, v] of [[2.8, 168], [2.4, 180], [2.0, 176], [1.75, 160], [1.5, 142], [1.28, 122], [1.08, 102], [0.9, 86], [0.72, 72], [0.55, 60]]) { ch.lineWidth = lw * k; ch.strokeStyle = `rgb(${v},${v},${v})`; for (const q of paths) ch.stroke(q.p); }
    // colour: soft shadow, bed, pigment, thin bright lip
    cc.lineWidth = lw * 1.9; cc.strokeStyle = 'rgba(80,46,16,0.22)'; for (const q of paths) cc.stroke(q.p);
    cc.lineWidth = lw * 1.05; for (const q of paths) { cc.strokeStyle = mixHex(colorOf(q.a), '#3a200c', 0.62); cc.stroke(q.p); }
    cc.lineWidth = lw * 0.42; cc.globalAlpha = 0.9; for (const q of paths) { cc.strokeStyle = mixHex(colorOf(q.a), '#8a5a30', 0.18); cc.stroke(q.p); }
    cc.globalAlpha = 1;
    if (o.glow) {
      ce.lineWidth = lw * 1.5; ce.strokeStyle = 'rgba(255,170,60,0.55)'; for (const q of paths) ce.stroke(q.p);
      ce.lineWidth = lw * 0.8; ce.strokeStyle = '#ffc850'; for (const q of paths) ce.stroke(q.p);
    }
  }
  function drawStruts(ch, cc, cfg) {
    const lw = GROOVE * cellPx * 0.28;
    cc.lineCap = 'round'; ch.lineCap = 'round';
    cc.lineWidth = lw * 1.8; cc.strokeStyle = 'rgba(70,42,16,0.22)'; ch.lineWidth = lw * 2.2; ch.strokeStyle = 'rgb(150,150,150)';
    const seg = (x0, y0, x1, y1) => { for (const c of [cc, ch]) { c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); } cc.stroke(); ch.stroke(); };
    const list = [];
    for (let i = 0; i < W * H; i++) {
      if (!strutOf(W, i, cfg[i])) continue;
      const r = Math.floor(i / W), c = i % W, x = (PAD + c) * cellPx, y = (PAD + r) * cellPx;
      list.push(cfg[i] === 0 ? [x + cellPx, y, x, y + cellPx] : [x, y, x + cellPx, y + cellPx]);
    }
    for (const s of list) seg(...s);
    cc.lineWidth = lw * 0.9; cc.strokeStyle = 'rgba(90,55,22,0.5)'; ch.lineWidth = lw * 1.0; ch.strokeStyle = 'rgb(110,110,110)';
    for (const s of list) seg(...s);
  }

  // ----------------------------------------------------------------- full repaint for a configuration
  let curArcs = null, curTrace = null, curSingle = false, curKey = '', winGlowOn = false;
  function colorFn(single) {
    const pal = look.loops;
    return (a) => (single ? PIGMENT_SINGLE : pal[curTrace.comp[a.a] % pal.length]);
  }
  function paintStatic(cfg, struts, skipCells) {
    const sc = staticC.getContext('2d'), sh = staticH.getContext('2d');
    sc.drawImage(baseC, 0, 0); sh.drawImage(baseH, 0, 0);
    const { arcs } = buildArcs(W, H, cfg);
    curArcs = arcs; curTrace = trace(W, H, cfg); curSingle = curTrace.count === 1;
    if (struts) drawStruts(sh, sc, cfg);
    const use = skipCells && skipCells.size ? arcs.filter((a) => !(a.cell >= 0 && skipCells.has(a.cell))) : arcs;
    drawArcs(sh, sc, cE.getContext('2d'), use, colorFn(curSingle), { glow: false });
  }
  function composeFrom(statics) {
    cC.getContext('2d').drawImage(staticC, 0, 0); cH.getContext('2d').drawImage(staticH, 0, 0);
  }
  function paintEmissive(cfg, on) {
    const ce = cE.getContext('2d'); ce.fillStyle = '#000'; ce.fillRect(0, 0, cE.width, cE.height);
    if (!on) return;
    const { arcs } = buildArcs(W, H, cfg), lw = GROOVE * cellPx;
    ce.lineCap = 'round';
    ce.lineWidth = lw * 1.6; ce.strokeStyle = 'rgba(255,130,20,0.5)';
    for (const a of arcs) { arcPath(ce, a); ce.stroke(); }
    ce.lineWidth = lw * 0.62; ce.strokeStyle = '#ffc850';
    for (const a of arcs) { arcPath(ce, a); ce.stroke(); }
  }

  // ----------------------------------------------------------------- dots (pebbles), fixed-tile frames, rings
  function rebuildDots() {
    if (pebbles) { group.remove(pebbles); pebbles.dispose?.(); }
    const spots = [];
    for (let r = 0; r <= H; r++) for (let c = 0; c <= W; c++) if (isDot(r, c)) spots.push([c, r]);
    pebbles = new THREE.InstancedMesh(pebbleGeo, pebbleMat, spots.length);
    pebbles.castShadow = true; pebbles.receiveShadow = false; pebbles.name = 'pebbles';
    spots.forEach(([c, r], i) => {
      const rad = CELL * (0.15 + hash(i * 7 + 3) * 0.04), sx = 1.0 + (hash(i * 5 + 1) - 0.5) * 0.25, sz = 1.0 + (hash(i * 5 + 2) - 0.5) * 0.25;
      _p.set((c - W / 2) * CELL, 0.03 + rad * 0.16, (r - H / 2) * CELL);
      _q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), hash(i + 55) * TAU); _s.set(rad * sx, rad * 0.66, rad * sz);
      _m.compose(_p, _q, _s); pebbles.setMatrixAt(i, _m);
      _c.set(mixHex('#7a6652', '#d9c7a6', 0.15 + hash(i * 3) * 0.6)); pebbles.setColorAt(i, _c);
    });
    pebbles.instanceMatrix.needsUpdate = true; if (pebbles.instanceColor) pebbles.instanceColor.needsUpdate = true;
    pebbleList.length = 0; spots.forEach(([c, r]) => pebbleList.push([c, r]));
    group.add(pebbles);
  }
  let rim = null;
  function rebuildRim() {
    if (rim) { group.remove(rim); rim.dispose?.(); }
    const per = 2 * (PW + PH), n = Math.round(per / 0.062);
    rim = new THREE.InstancedMesh(pebbleGeo, pebbleMat, n); rim.castShadow = true; rim.receiveShadow = false; rim.name = 'rimStones';
    const hw = PW / 2 - 0.012, hh = PH / 2 - 0.012, cr = 0.34 * CELL;
    for (let i = 0; i < n; i++) {
      let t = (i + hash(i * 3 + 1) * 0.6) / n * per, x, z;
      // walk the rounded-rect boundary
      const sides = [PW - 2 * cr, PH - 2 * cr], arcL = (Math.PI / 2) * cr, order = [];
      const segs = [['t', sides[0]], ['a', arcL], ['r', sides[1]], ['a', arcL], ['b', sides[0]], ['a', arcL], ['l', sides[1]], ['a', arcL]];
      let k = 0; t = t % (2 * sides[0] + 2 * sides[1] + 4 * arcL); let id = 0;
      for (; id < segs.length; id++) { if (t < segs[id][1]) break; t -= segs[id][1]; }
      const [kind, len] = segs[Math.min(id, segs.length - 1)], f = len ? t / len : 0;
      if (kind === 't') { x = -hw + cr + f * len; z = -hh; } else if (kind === 'b') { x = hw - cr - f * len; z = hh; } else if (kind === 'r') { x = hw; z = -hh + cr + f * len; } else if (kind === 'l') { x = -hw; z = hh - cr - f * len; }
      else {
        const corner = Math.floor(id / 2), a = f * Math.PI / 2, cx = corner === 0 || corner === 3 ? hw - cr : -hw + cr, cz = corner < 2 ? -hh + cr : hh - cr;
        const ang = [-Math.PI / 2, 0, Math.PI / 2, Math.PI][corner] + a; x = cx + Math.cos(ang) * cr; z = cz + Math.sin(ang) * cr;
      }
      const jr = (hash(i * 7 + 2) - 0.5) * 0.03, rad = 0.011 + hash(i * 5 + 9) * 0.017, skip = hash(i + 321) < 0.12;
      _p.set(x + jr * Math.sign(x) * 0.5, 0.008 + rad * 0.2, z + jr * Math.sign(z) * 0.5);
      _q.setFromAxisAngle(new THREE.Vector3(0.2, 1, 0.1).normalize(), hash(i + 7) * TAU); _s.set(rad * (skip ? 0 : 1.15), rad * 0.7 * (skip ? 0 : 1), rad * (skip ? 0 : 0.95));
      _m.compose(_p, _q, _s); rim.setMatrixAt(i, _m);
      _c.set(mixHex('#7a6a58', '#c8b79c', hash(i * 11 + 4))); rim.setColorAt(i, _c);
    }
    rim.instanceMatrix.needsUpdate = true; if (rim.instanceColor) rim.instanceColor.needsUpdate = true;
    group.add(rim);
  }
  function rebuildFrames(locked) {
    if (frames) { group.remove(frames); frames.dispose?.(); frames = null; }
    const idx = []; for (let i = 0; i < W * H; i++) if (locked && locked[i]) idx.push(i);
    if (!idx.length) return;
    if (!frameGeo) {
      const s = CELL * 0.86, hole = s - CELL * 0.14, r = CELL * 0.14;
      const sh = new THREE.Shape(); const rrp = (p, hw, rad) => { p.moveTo(-hw + rad, -hw); p.lineTo(hw - rad, -hw); p.quadraticCurveTo(hw, -hw, hw, -hw + rad); p.lineTo(hw, hw - rad); p.quadraticCurveTo(hw, hw, hw - rad, hw); p.lineTo(-hw + rad, hw); p.quadraticCurveTo(-hw, hw, -hw, hw - rad); p.lineTo(-hw, -hw + rad); p.quadraticCurveTo(-hw, -hw, -hw + rad, -hw); };
      rrp(sh, s / 2, r);
      const hp = new THREE.Path(); rrp(hp, hole / 2, r * 0.6); sh.holes.push(hp);
      frameGeo = new THREE.ExtrudeGeometry(sh, { depth: 0.012, bevelEnabled: true, bevelThickness: 0.005, bevelSize: 0.004, bevelSegments: 2, curveSegments: 5 });
      frameGeo.rotateX(-Math.PI / 2); frameGeo.computeVertexNormals();
    }
    frames = new THREE.InstancedMesh(frameGeo, frameMat, idx.length); frames.castShadow = true; frames.receiveShadow = true;
    idx.forEach((i, k) => {
      const c = i % W, r = Math.floor(i / W);
      _p.set((c + 0.5 - W / 2) * CELL, 0.026, (r + 0.5 - H / 2) * CELL); _q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0); _s.set(1, 1, 1);
      _m.compose(_p, _q, _s); frames.setMatrixAt(k, _m);
    });
    frames.instanceMatrix.needsUpdate = true; group.add(frames);
  }
  function makeRing(color) {
    const m = new THREE.Mesh(flatQuad, new THREE.MeshBasicMaterial({ map: ringTex, color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, toneMapped: false }));
    m.renderOrder = 4; m.visible = false; m.scale.set(CELL * 1.2, 1, CELL * 1.2); group.add(m); return m;
  }
  ringHint = makeRing('#ffd36a'); ringFocus = makeRing('#ffffff');
  const hintGlow = new THREE.Mesh(flatQuad, new THREE.MeshBasicMaterial({ color: '#ffcf70', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, fog: false, toneMapped: false }));
  hintGlow.scale.set(CELL * 0.98, 1, CELL * 0.98); hintGlow.renderOrder = 3; hintGlow.visible = false; group.add(hintGlow);

  glowRunner = new THREE.Mesh(new THREE.SphereGeometry(CELL * 0.07, 14, 10), new THREE.MeshBasicMaterial({ color: '#fff3c0', transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false }));
  glowRunner.visible = false; group.add(glowRunner);
  const trail = [];
  for (let i = 0; i < 5; i++) { const t = glowRunner.clone(); t.material = glowRunner.material.clone(); t.material.opacity = 0.6 - i * 0.1; t.scale.setScalar(0.85 - i * 0.12); t.visible = false; group.add(t); trail.push(t); }
  runnerLight = new THREE.PointLight('#ffc060', 0, 1.1, 1.6); runnerLight.visible = false; group.add(runnerLight);

  // ----------------------------------------------------------------- public api
  let anim = null;   // { cell, from, t, dur } finger-draw of one flipped cell
  let lastCfg = null, lastW = 0, lastH = 0, lastStruts = null, lastLook = '', lastLocked = '';
  const toWorld = (cx, cy, out = new THREE.Vector3()) => out.set((cx - W / 2) * CELL, 0.0, (cy - H / 2) * CELL);
  const cellCentre = (i, out) => toWorld((i % W) + 0.5, Math.floor(i / W) + 0.5, out);

  function pointOnCellArcs(i, f, out) {
    // new arcs of cell i, swept in order; returns the tip position (world) at overall fraction f
    const mine = curArcs.filter((a) => a.cell === i);
    const total = mine.length, u = clamp(f, 0, 0.9999) * total, k = Math.floor(u), a = mine[k];
    if (!a) return cellCentre(i, out);
    const ang = a.p + a.d * (u - k);
    return toWorld(a.cx + Math.cos(ang) * 0.5, a.cy + Math.sin(ang) * 0.5, out);
  }

  const api = {
    group, CELL, PAD,
    get dims() { return { W, H, PW, PH }; },
    // call every frame: cfg may change; returns { drawing, tip, dir } for the hand.
    sync(opts, dt, clock) {
      const { W: w, H: h, cfg, locked, struts, lookObj, hintCell, focus, win } = opts;
      const lookKey = lookObj.name;
      let rebuilt = false;
      if (w !== lastW || h !== lastH) { dims(w, h); look = lookObj; ensureTextures(); buildPlate(); paintBase(); lastLook = lookKey; lastW = w; lastH = h; lastCfg = null; rebuildDots(); rebuildRim(); rebuildFrames(locked); lastLocked = locked ? locked.join('') : ''; rebuilt = true; }
      if (lookKey !== lastLook) { look = lookObj; paintBase(); lastLook = lookKey; lastCfg = null; rebuildDots(); }
      const lk = locked ? locked.join('') : '';
      if (lk !== lastLocked) { lastLocked = lk; rebuildFrames(locked); }
      const key = cfg.join('');
      // detect a single-cell change -> animate the finger
      if (lastCfg && key !== lastCfg.join('')) {
        const diff = []; for (let i = 0; i < cfg.length; i++) if (cfg[i] !== lastCfg[i]) diff.push(i);
        if (diff.length === 1 && !opts.calm && !opts.snap) {
          anim = { cell: diff[0], t: 0, dur: opts.quick ? 0.28 : 0.42 };
          const sk = new Set([diff[0]]);
          paintStatic(cfg, struts, sk); anim.final = cfg.slice();
        } else { anim = null; paintStatic(cfg, struts, null); composeFrom(); paintEmissive(cfg, false); winGlowOn = false; texC.needsUpdate = texH.needsUpdate = true; }
        lastCfg = cfg.slice(); lastStruts = struts;
      } else if (!lastCfg || struts !== lastStruts) {
        paintStatic(cfg, struts, null); composeFrom(); paintEmissive(cfg, false); winGlowOn = false; texC.needsUpdate = texH.needsUpdate = true;
        lastCfg = cfg.slice(); lastStruts = struts; anim = null;
      }
      // tip animation
      let out = null;
      if (anim) {
        anim.t += dt;
        const f = clamp(anim.t / anim.dur, 0, 1), e = f * f * (3 - 2 * f);
        const mine = curArcs ? null : null;
        const cc = cC.getContext('2d'), ch = cH.getContext('2d'), ce = cE.getContext('2d');
        cc.drawImage(staticC, 0, 0); ch.drawImage(staticH, 0, 0);
        const sub = buildArcs(W, H, anim.final).arcs.filter((a) => a.cell === anim.cell);
        const n = sub.length || 1, u = e * n;
        // swept portion of each arc of the cell; the other cells are already painted
        drawArcs(ch, cc, ce, sub, colorFn(trace(W, H, anim.final).count === 1), { fracOf: (a) => clamp(u - sub.indexOf(a), 0, 1) });
        texC.needsUpdate = texH.needsUpdate = true;
        const k = Math.min(n - 1, Math.floor(u)), a = sub[k];
        if (a) { const ang = a.p + a.d * clamp(u - k, 0, 1); out = { drawing: true, x: (a.cx + Math.cos(ang) * 0.5 - W / 2) * CELL, z: (a.cy + Math.sin(ang) * 0.5 - H / 2) * CELL, ang: ang + (a.d > 0 ? Math.PI / 2 : -Math.PI / 2), f, cell: anim.cell }; }
        if (f >= 1) { paintStatic(cfg, struts, null); composeFrom(); texC.needsUpdate = texH.needsUpdate = true; anim = null; }
      }
      // win glow
      const single = trace(W, H, cfg).count === 1;
      const glowTarget = !!(win && single && !anim);
      if (glowTarget !== winGlowOn) { paintEmissive(cfg, glowTarget); texE.needsUpdate = true; winGlowOn = glowTarget; }
      mat.emissiveIntensity = winGlowOn ? 0.75 + 0.2 * Math.sin(clock * 3) : 0;
      mat.emissive.set('#ffffff');
      // runner
      if (winGlowOn) {
        const L = loopPaths(W, H, cfg)[0];
        if (L && L.pts.length) {
          const head = ((clock * 0.16) % 1) * L.len, at = (d) => {
            d = (d + L.len) % L.len; let lo = 0, hi = L.cum.length - 1;
            while (hi - lo > 1) { const m = (lo + hi) >> 1; if (L.cum[m] <= d) lo = m; else hi = m; }
            const p = L.pts[lo % L.pts.length], q = L.pts[(lo + 1) % L.pts.length], f = (d - L.cum[lo]) / Math.max(1e-6, L.cum[lo + 1] - L.cum[lo]);
            return [p[0] + (q[0] - p[0]) * f, p[1] + (q[1] - p[1]) * f];
          };
          glowRunner.visible = true;
          const [x, y] = at(head); glowRunner.position.set((x - W / 2) * CELL, 0.045, (y - H / 2) * CELL);
          runnerLight.visible = true; runnerLight.intensity = 1.2; runnerLight.position.set(glowRunner.position.x, 0.16, glowRunner.position.z);
          trail.forEach((t, i) => { const [tx, ty] = at(head - (i + 1) * L.len * 0.012); t.visible = true; t.position.set((tx - W / 2) * CELL, 0.045, (ty - H / 2) * CELL); });
        }
      } else { glowRunner.visible = false; runnerLight.visible = false; trail.forEach((t) => { t.visible = false; }); }
      // hint / focus rings
      const pulse = 0.5 + 0.5 * Math.sin(clock * 5);
      if (hintCell >= 0) { cellCentre(hintCell, _p); ringHint.visible = true; ringHint.position.set(_p.x, 0.05, _p.z); ringHint.material.opacity = 0.7 + 0.3 * pulse; ringHint.scale.set(CELL * (1.15 + pulse * 0.06), 1, CELL * (1.15 + pulse * 0.06)); hintGlow.visible = true; hintGlow.position.set(_p.x, 0.047, _p.z); hintGlow.material.opacity = 0.12 + 0.1 * pulse; }
      else { ringHint.visible = false; hintGlow.visible = false; }
      if (focus >= 0) { cellCentre(focus, _p); ringFocus.visible = true; ringFocus.position.set(_p.x, 0.052, _p.z); ringFocus.material.opacity = 0.9; } else ringFocus.visible = false;
      return out;
    },
    cellCentre: (i, out) => cellCentre(i, out || new THREE.Vector3()),
    // cell index from a world point on the plane (or -1)
    cellAt(x, z) { const c = Math.floor(x / CELL + W / 2), r = Math.floor(z / CELL + H / 2); return c >= 0 && c < W && r >= 0 && r < H ? r * W + c : -1; },
    halfExtent() { return { hw: PW / 2, hh: PH / 2 }; },
    forceRepaint() { lastCfg = null; lastW = 0; },
    dispose() { for (const t of [texC, texH, texE]) t && t.dispose(); plate?.geometry.dispose(); },
  };
  return api;
}

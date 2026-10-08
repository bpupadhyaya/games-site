// Pottery Wheel: the 3D presenter (game-owned). It ONLY READS game.getState().g3 (the pot, its glaze, the fire progress and the camera rect) and never writes
// back. The clay is rebuilt every frame it changes as a lathe mesh from the sim's layers; the wheel, pan, bench and wall are static props.
// Camera maths comes from ../src/cam.js, the same function the pure game uses to turn a fingertip into clay coordinates, so the picture and the touch agree.
import { camFor } from '../src/cam.js';
import { TRADITIONS } from '../src/content.js';
import { N } from '../src/sim.js';

const LIB = '../vendor3d/index.js';
const SEG = 72, RIM = 6, TAU = Math.PI * 2, YV = 4.6;           // radial segments, rim rings, the world height the texture's v spans
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

export async function createPresenter({ kitCanvas, quality = 'high', onFail }) {
  let V3;
  try { V3 = await import(LIB); } catch (e) { console.warn('view3d failed to load; using the 2D fallback', e); onFail?.(); return { stage: null, wrap: (g) => g }; }
  const { createStage, THREE } = V3;
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100dvh;display:block;pointer-events:none;z-index:0';
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  let stage;
  try { stage = createStage({ canvas, quality, dprCap: 2, lighting: 'indoor', shadows: true, fov: 24, shadowSize: 4.2 }); } catch (e) { console.warn(e); stage = { supported: false }; }
  if (!stage.supported) { canvas.remove(); onFail?.(); return { stage: null, wrap: (g) => g }; }
  stage.onContextLost(() => {});
  stage.setLighting('indoor', { hemiSky: 0xffe2c4, hemiGround: 0x3a2518, hemi: 0.62, key: 0xffd4a0, keyI: 3.4, rim: 0xffb27a, rimI: 1.7, exposure: 1.05, sky: 0x1b1310, fog: 0x1b1310 });
  stage.setSky(0x1b1310, 0x1b1310, { near: 30, far: 90 });
  if (stage.scene.environmentIntensity !== undefined) stage.scene.environmentIntensity = 0.55;
  stage.setShadowTarget(0, 1.2, 0);
  const scene = stage.scene, camera = stage.camera;
  camera.near = 0.5; camera.far = 80;

  // ---- props -------------------------------------------------------------------------------------------------------------------------------
  const texFrom = (c, repeat) => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t; };
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  // wall: a warm glow
  { const c = mk(512, 512), g = c.getContext('2d'); const gr = g.createRadialGradient(256, 200, 10, 256, 260, 420); gr.addColorStop(0, '#8a5a3c'); gr.addColorStop(0.45, '#4d3226'); gr.addColorStop(1, '#1d1410'); g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
    g.fillStyle = 'rgba(255,200,140,0.07)'; for (let i = 0; i < 5; i++) g.fillRect(70 + i * 80, 0, 36, 512);
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(40, 26), new THREE.MeshBasicMaterial({ map: texFrom(c), fog: false })); wall.position.set(0, 6, -9); scene.add(wall); }
  // bench: planks
  { const c = mk(512, 512), g = c.getContext('2d'); g.fillStyle = '#6b4a33'; g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#6f4d36' : '#5f4130'; g.fillRect(0, i * 64, 512, 62); g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, i * 64 + 62, 512, 2); }
    let seed = 7; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${rnd() < 0.5 ? '30,15,5' : '150,100,60'},${0.06 + rnd() * 0.08})`; g.fillRect(rnd() * 512, rnd() * 512, 20 + rnd() * 90, 1); }
    const t = texFrom(c, true); t.repeat.set(5, 5);
    const bench = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshStandardMaterial({ map: t, roughness: 0.85 })); bench.rotation.x = -Math.PI / 2; bench.position.y = -0.85; bench.receiveShadow = true; scene.add(bench); }
  // splash pan and wheel
  const wheel = new THREE.Group(); scene.add(wheel);
  { const pan = new THREE.Mesh(new THREE.CylinderGeometry(2.55, 2.2, 0.5, 72, 1, true), new THREE.MeshStandardMaterial({ color: 0x5b4a3e, roughness: 0.55, side: THREE.DoubleSide })); pan.position.y = -0.57; pan.receiveShadow = true; scene.add(pan);
    const pb = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 0.05, 72), new THREE.MeshStandardMaterial({ color: 0x4a3c32, roughness: 0.7 })); pb.position.y = -0.84; pb.receiveShadow = true; scene.add(pb);
    const lip = new THREE.Mesh(new THREE.TorusGeometry(2.55, 0.06, 12, 96), new THREE.MeshStandardMaterial({ color: 0x8a7766, roughness: 0.5 })); lip.rotation.x = Math.PI / 2; lip.position.y = -0.32; scene.add(lip);
    const c = mk(512, 512), g = c.getContext('2d'); g.fillStyle = '#2e2e32'; g.fillRect(0, 0, 512, 512);
    for (let r = 20; r < 256; r += 9) { g.strokeStyle = `rgba(255,255,255,${0.04 + (r % 27 === 2 ? 0.06 : 0)})`; g.lineWidth = 1.4; g.beginPath(); g.arc(256, 256, r, 0, TAU); g.stroke(); }
    for (let i = 0; i < 12; i++) { g.save(); g.translate(256, 256); g.rotate(i * Math.PI / 6); g.fillStyle = 'rgba(255,200,120,0.13)'; g.fillRect(40, -4, 200, 8); g.restore(); }
    const head = new THREE.Mesh(new THREE.CylinderGeometry(1.8, 1.8, 0.16, 72), [new THREE.MeshStandardMaterial({ color: 0x3b3b40, metalness: 0.55, roughness: 0.38 }), new THREE.MeshStandardMaterial({ map: texFrom(c), metalness: 0.5, roughness: 0.42 }), new THREE.MeshStandardMaterial({ color: 0x2a2a2e, metalness: 0.5, roughness: 0.5 })]);
    head.position.y = -0.08; head.receiveShadow = true; head.castShadow = true; wheel.add(head);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(1.8, 0.045, 12, 96), new THREE.MeshStandardMaterial({ color: 0xc08a58, metalness: 0.85, roughness: 0.3 })); rim.rotation.x = Math.PI / 2; rim.position.y = -0.005; wheel.add(rim);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.8, 0.5, 40), new THREE.MeshStandardMaterial({ color: 0x2a2a2e, metalness: 0.5, roughness: 0.5 })); neck.position.y = -0.4; scene.add(neck); }

  // ---- the pot ----------------------------------------------------------------------------------------------------------------------------------
  const nRings = (N + 1) + RIM + (N + 1);
  const pos = new Float32Array(nRings * (SEG + 1) * 3), nor = new Float32Array(pos.length), uvs = new Float32Array(nRings * (SEG + 1) * 2);
  const idx = new Uint16Array((nRings - 1) * SEG * 6);
  for (let r = 0; r < nRings - 1; r++) for (let s = 0; s < SEG; s++) {
    const a = r * (SEG + 1) + s, b = a + 1, c = a + SEG + 1, d = c + 1, o = (r * SEG + s) * 6;
    idx[o] = a; idx[o + 1] = c; idx[o + 2] = b; idx[o + 3] = b; idx[o + 4] = c; idx[o + 5] = d;
  }
  for (let r = 0; r < nRings; r++) for (let s = 0; s <= SEG; s++) uvs[(r * (SEG + 1) + s) * 2] = s / SEG;
  const geo = new THREE.BufferGeometry();
  const posA = new THREE.BufferAttribute(pos, 3), norA = new THREE.BufferAttribute(nor, 3), uvA = new THREE.BufferAttribute(uvs, 2);
  geo.setAttribute('position', posA); geo.setAttribute('normal', norA); geo.setAttribute('uv', uvA);
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  const outerRings = (N + 1) + RIM;                                  // rings 0 .. outerRings-1 are the outside and the lip
  geo.addGroup(0, (outerRings - 1) * SEG * 6, 0);                     // decorated outside
  geo.addGroup((outerRings - 1) * SEG * 6, (nRings - outerRings) * SEG * 6, 1);   // plain inside
  const matOut = new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0, side: THREE.DoubleSide, envMapIntensity: 1 });
  const matIn = new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0, side: THREE.DoubleSide, envMapIntensity: 0.8 });
  const potMesh = new THREE.Mesh(geo, [matOut, matIn]);
  potMesh.castShadow = true; potMesh.receiveShadow = true; potMesh.frustumCulled = false; scene.add(potMesh);

  const prof = { r: new Float32Array(nRings), y: new Float32Array(nRings), nr: new Float32Array(nRings), ny: new Float32Array(nRings), v: new Float32Array(nRings) };
  let lastHash = -1;
  function buildPot(pot) {
    const P = prof;
    for (let k = 0; k <= N; k++) {
      P.r[k] = k === 0 ? pot.Ro[0] : k === N ? pot.Ro[N - 1] : (pot.Ro[k - 1] + pot.Ro[k]) / 2;
      P.y[k] = k < N ? pot.y0[k] : pot.H;
    }
    const open = pot.Ri[N - 1] > 0.025, Rt = P.r[N], Yt = pot.H;
    const ri = (k) => (k === 0 ? pot.Ri[0] : k === N ? pot.Ri[N - 1] : (pot.Ri[k - 1] + pot.Ri[k]) / 2);
    const Rin = open ? ri(N) : 0;
    for (let j = 1; j <= RIM; j++) {
      const q = j / (RIM + 1), at = N + j;
      if (open) {
        const a = (Rt - Rin) / 2, b = Math.min(a, 0.045), c = (Rt + Rin) / 2, ph = q * Math.PI;
        P.r[at] = c + a * Math.cos(ph); P.y[at] = Yt + b * Math.sin(ph); P.nr[at] = Math.cos(ph) / Math.max(a, 1e-3); P.ny[at] = Math.sin(ph) / Math.max(b, 1e-3);
        const l = Math.hypot(P.nr[at], P.ny[at]) || 1; P.nr[at] /= l; P.ny[at] /= l;
      } else {
        P.r[at] = Rt * (1 - q); P.y[at] = Yt; P.nr[at] = 0.05 * (1 - q); P.ny[at] = 1;
      }
      P.v[at] = Yt / YV;
    }
    for (let k = N; k >= 0; k--) { const at = N + RIM + 1 + (N - k); P.r[at] = open || k < N ? ri(k) : 0; P.y[at] = k < N ? pot.y0[k] : pot.H; P.v[at] = P.y[at] / YV; }
    for (let k = 0; k <= N; k++) P.v[k] = P.y[k] / YV;
    for (let k = 0; k <= N; k++) {
      const a = Math.max(0, k - 1), b = Math.min(N, k + 1), dr = P.r[b] - P.r[a], dy = P.y[b] - P.y[a], l = Math.hypot(dr, dy) || 1;
      P.nr[k] = dy / l; P.ny[k] = -dr / l;
    }
    for (let k = N; k >= 0; k--) {
      const at = N + RIM + 1 + (N - k), a = Math.max(0, k - 1), b = Math.min(N, k + 1);
      const ra = P.r[N + RIM + 1 + (N - a)], rb = P.r[N + RIM + 1 + (N - b)];
      const dr = rb - ra, dy = P.y[b] - P.y[a], l = Math.hypot(dr, dy) || 1;
      P.nr[at] = -dy / l; P.ny[at] = dr / l;
    }
    const ecc = pot.ecc, ph0 = pot.eccPh ?? 0.7;
    for (let r = 0; r < nRings; r++) {
      const y = P.y[r], t = y / Math.max(0.5, pot.H);
      let wob = 0; if (pot.wob) { const f = clamp(t, 0, 1) * (N - 1), i0 = Math.floor(f), i1 = Math.min(N - 1, i0 + 1); wob = pot.wob[i0] + (pot.wob[i1] - pot.wob[i0]) * (f - i0); }
      const ea = ecc * (0.7 + 0.5 * t), wa = wob * 0.065;
      const ox = ea * Math.cos(ph0) + wa * Math.cos(y * 2.3 + 1), oz = ea * Math.sin(ph0) + wa * Math.sin(y * 2.3 + 1);
      for (let s = 0; s <= SEG; s++) {
        const a = (s / SEG) * TAU, ca = Math.cos(a), sa = Math.sin(a), o = (r * (SEG + 1) + s);
        pos[o * 3] = P.r[r] * ca + ox; pos[o * 3 + 1] = y; pos[o * 3 + 2] = P.r[r] * sa + oz;
        nor[o * 3] = P.nr[r] * ca; nor[o * 3 + 1] = P.ny[r]; nor[o * 3 + 2] = P.nr[r] * sa;
        uvs[o * 2 + 1] = P.v[r];
      }
    }
    posA.needsUpdate = true; norA.needsUpdate = true; uvA.needsUpdate = true;
  }
  const potHash = (pot) => {
    let h = pot.ecc * 1000 + pot.H * 7;
    for (let i = 0; i < N; i++) h += pot.Ro[i] * (i + 1) + pot.Ri[i] * (i + 3) + pot.h[i] * (i + 5) + pot.wob[i] * (i + 2);
    return h;
  };

  // ---- the surface texture: raw clay, then glaze with decorated bands ----------------------------------------------------------------------------------------
  const TW = 1024, TH = 512;
  const texC = mk(TW, TH), texInC = mk(64, 64);
  const potTex = texFrom(texC, true), inTex = texFrom(texInC, true);
  matOut.map = potTex; matIn.map = inTex;
  let texKey = '';
  function speckles(g, seed, n, light) {
    let s = seed; const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    for (let i = 0; i < n; i++) { g.fillStyle = rnd() < 0.5 ? `rgba(40,20,8,${0.08 + rnd() * 0.18})` : `rgba(255,235,205,${(light ? 0.1 : 0.06) + rnd() * 0.1})`; const sz = 1 + rnd() * 2.6; g.fillRect(rnd() * TW, rnd() * TH, sz, sz); }
  }
  function rawTexture(g, wet) {
    g.fillStyle = wet ? '#8c5f45' : '#b99573'; g.fillRect(0, 0, TW, TH);
    let s = 99; const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
    for (let y = 0; y < TH; y += 3 + rnd() * 5) { g.fillStyle = `rgba(${rnd() < 0.5 ? '60,30,15' : '255,225,190'},${0.05 + rnd() * 0.07})`; g.fillRect(0, y, TW, 1 + rnd() * 1.5); }
    speckles(g, 5, 1800, !wet);
    for (let i = 0; i < 70; i++) { const x = rnd() * TW; g.fillStyle = `rgba(255,230,200,${0.012 + rnd() * 0.016})`; g.fillRect(x, 0, 2 + rnd() * 5, TH); }
  }
  function motif(g, m, col, x0, w, y0, h, rep) {
    g.save(); g.strokeStyle = col; g.fillStyle = col; g.lineCap = 'round'; g.lineJoin = 'round';
    const pw = w / rep, lw = Math.max(3, h * 0.09);
    g.lineWidth = lw;
    const per = (fn) => { for (let i = 0; i < rep; i++) fn(x0 + i * pw, pw, i); };
    if (m === 'solid') { g.fillRect(x0, y0, w, h); }
    else if (m === 'lines') { for (let k = 0; k < 4; k++) { const y = y0 + h * (0.18 + k * 0.21); g.beginPath(); g.moveTo(x0, y); g.lineTo(x0 + w, y); g.stroke(); } }
    else if (m === 'dots') per((x, p) => { for (let k = 0; k < 2; k++) { g.beginPath(); g.arc(x + p * (0.28 + 0.44 * k), y0 + h * (k ? 0.68 : 0.32), Math.max(2.5, h * 0.1), 0, TAU); g.fill(); } });
    else if (m === 'waves') { for (let k = 0; k < 2; k++) { g.beginPath(); for (let i = 0; i <= w; i += 4) { const y = y0 + h * (k ? 0.68 : 0.34) + Math.sin(i / pw * TAU) * h * 0.14; if (i) g.lineTo(x0 + i, y); else g.moveTo(x0, y); } g.stroke(); } }
    else if (m === 'zigzag') { g.lineWidth = lw * 1.3; g.beginPath(); per((x, p, i) => { if (!i) g.moveTo(x, y0 + h * 0.8); g.lineTo(x + p * 0.5, y0 + h * 0.2); g.lineTo(x + p, y0 + h * 0.8); }); g.stroke(); }
    else if (m === 'meander') { g.lineWidth = lw * 1.4; g.beginPath(); per((x, p, i) => { const u = p / 6, yb = y0 + h * 0.85, yt = y0 + h * 0.15; if (!i) g.moveTo(x, yb); g.lineTo(x, yt); g.lineTo(x + u * 4, yt); g.lineTo(x + u * 4, y0 + h * 0.5); g.lineTo(x + u * 2, y0 + h * 0.5); g.lineTo(x + u * 2, y0 + h * 0.7); g.lineTo(x + u * 5, y0 + h * 0.7); g.lineTo(x + u * 5, yb); g.lineTo(x + p, yb); }); g.stroke(); }
    else if (m === 'triangles') per((x, p, i) => { g.beginPath(); if (i % 2) { g.moveTo(x, y0 + h * 0.12); g.lineTo(x + p, y0 + h * 0.12); g.lineTo(x + p / 2, y0 + h * 0.88); } else { g.moveTo(x, y0 + h * 0.88); g.lineTo(x + p, y0 + h * 0.88); g.lineTo(x + p / 2, y0 + h * 0.12); } g.closePath(); g.fill(); });
    else if (m === 'scroll') per((x, p) => { g.beginPath(); for (let t = 0; t <= 1; t += 0.04) { const a = t * TAU * 1.5 + Math.PI; g.lineTo(x + p * 0.5 + Math.cos(a) * p * 0.3 * (1 - t * 0.55) - p * 0.1, y0 + h * 0.5 + Math.sin(a) * h * 0.3 * (1 - t * 0.55)); } g.stroke(); g.beginPath(); g.moveTo(x + p * 0.85, y0 + h * 0.5); g.quadraticCurveTo(x + p * 0.95, y0 + h * 0.2, x + p * 1.0, y0 + h * 0.5); g.stroke(); });
    else if (m === 'leaves') { g.beginPath(); g.moveTo(x0, y0 + h * 0.5); g.lineTo(x0 + w, y0 + h * 0.5); g.stroke(); per((x, p, i) => { for (const sgn of [-1, 1]) { g.beginPath(); g.ellipse(x + p * 0.5, y0 + h * (0.5 + sgn * 0.24), p * 0.2, h * 0.17, sgn * (i % 2 ? 0.5 : -0.5), 0, TAU); g.fill(); } }); }
    else if (m === 'petals') per((x, p) => { g.beginPath(); g.moveTo(x + p * 0.5, y0 + h * 0.9); g.quadraticCurveTo(x + p * 0.05, y0 + h * 0.5, x + p * 0.5, y0 + h * 0.08); g.quadraticCurveTo(x + p * 0.95, y0 + h * 0.5, x + p * 0.5, y0 + h * 0.9); g.stroke(); });
    else if (m === 'scallops') { for (let k = 0; k < 2; k++) per((x, p) => { g.beginPath(); g.arc(x + p / 2, y0 + h * (k ? 0.72 : 0.38), p * 0.5, Math.PI, 0); g.stroke(); }); }
    else if (m === 'drips') per((x, p, i) => { const L = h * (0.5 + 0.5 * ((i * 37) % 7) / 7); g.fillRect(x + p * 0.3, y0, p * 0.4, L); g.beginPath(); g.arc(x + p * 0.5, y0 + L, p * 0.2, 0, TAU); g.fill(); });
    else if (m === 'speckle') { let s = 31; const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; for (let i = 0; i < w * h / 90; i++) { g.globalAlpha = 0.3 + rnd() * 0.7; g.fillRect(x0 + rnd() * w, y0 + rnd() * h, 1.5 + rnd() * 3, 1.5 + rnd() * 3); } g.globalAlpha = 1; }
    else if (m === 'comb') { for (let k = 0; k < 4; k++) { g.beginPath(); for (let i = 0; i <= w; i += 4) { const y = y0 + h * (0.16 + k * 0.22) + Math.sin(i / pw * TAU + k * 0.4) * h * 0.1; if (i) g.lineTo(x0 + i, y); else g.moveTo(x0, y); } g.stroke(); } }
    g.restore();
  }
  function buildTexture(gz, stage2, live) {
    const g = texC.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    if (!gz) {
      const wet = ['centre', 'open', 'pull', 'shape'].includes(stage2);
      rawTexture(g, wet);
      const gi = texInC.getContext('2d'); gi.fillStyle = wet ? '#6f4a36' : '#a07e5e'; gi.fillRect(0, 0, 64, 64);
    } else {
      const T = TRADITIONS[gz.trad], base = T.base[gz.base];
      rawTexture(g, false);
      g.fillStyle = base; g.globalAlpha = 0.93; g.fillRect(0, 0, TW, TH); g.globalAlpha = 1;
      speckles(g, 17, 700, true);
      const bands = live ? [...gz.bands, live] : gz.bands;
      for (const b of bands) {
        const acc = T.accent[b.acc ?? 0], yTop = (1 - (b.y + b.half) / YV) * TH, hh = (b.half * 2 / YV) * TH;
        g.fillStyle = acc; g.globalAlpha = 0.9; g.fillRect(0, yTop, TW, Math.max(2, hh * 0.06)); g.fillRect(0, yTop + hh - Math.max(2, hh * 0.06), TW, Math.max(2, hh * 0.06)); g.globalAlpha = 1;
        motif(g, b.motif, acc, 0, TW, yTop + hh * 0.08, hh * 0.84, 16);
      }
      const gi = texInC.getContext('2d'); gi.fillStyle = base; gi.fillRect(0, 0, 64, 64);
    }
    potTex.needsUpdate = true; inTex.needsUpdate = true;
  }
  const motifName = (gz, m) => (typeof m === 'number' ? TRADITIONS[gz.trad].motifs[m] : m);
  const texSig = (g) => { const gz = g.glaze; return (gz ? `${gz.trad}.${gz.base}.${gz.acc}|${gz.bands.map((b) => `${b.y.toFixed(2)},${b.half.toFixed(2)},${b.motif},${b.acc}`).join(';')}` : 'raw') + '|' + (gz ? '' : (['centre', 'open', 'pull', 'shape'].includes(g.stage) ? 'w' : 't')); };

  // ---- materials by fire progress -------------------------------------------------------------------------------------------------------------------------------
  const heatCol = new THREE.Color(1, 0.42, 0.1), rimBase = stage.lights.rim.color.clone(), rimHot = new THREE.Color(1, 0.55, 0.25);
  function setLook(g) {
    const f = g.fire ?? 0;
    if (!g.glaze) {
      const wet = ['centre', 'open', 'pull', 'shape'].includes(g.stage);
      matOut.roughness = wet ? 0.28 : 0.78; matIn.roughness = wet ? 0.3 : 0.8; matOut.envMapIntensity = wet ? 1.2 : 0.5;
      matOut.emissive.setRGB(0, 0, 0); matIn.emissive.setRGB(0, 0, 0);
      stage.lights.rim.color.copy(rimBase);
    } else {
      const T = TRADITIONS[g.glaze.trad], heat = smooth(0, 0.35, f) * (1 - smooth(0.55, 0.95, f)), chalk = 1 - smooth(0.3, 0.7, f);
      const rough = 0.88 + (T.gloss - 0.88) * smooth(0.5, 0.92, f);
      matOut.roughness = rough; matIn.roughness = Math.min(0.9, rough + 0.1); matOut.envMapIntensity = 0.5 + 1.1 * smooth(0.6, 1, f);
      const e = 0.22 * chalk;
      matOut.emissive.setRGB(e + heatCol.r * heat * 0.9, e + heatCol.g * heat * 0.9, e + heatCol.b * heat * 0.9);
      matIn.emissive.copy(matOut.emissive);
      stage.lights.rim.color.copy(rimBase).lerp(rimHot, heat);
    }
  }

  // ---- per frame --------------------------------------------------------------------------------------------------------------------------------------------------------
  function frame(game) {
    const st = game.getState(), g = st.g3;
    stage.setVisible(!!g.visible);
    if (!g.visible || !g.pot || !g.rect || !g.W) return;
    const pot = g.pot;
    const h = potHash(pot);
    if (h !== lastHash) { buildPot(pot); lastHash = h; }
    let live = null;
    const gs = st.ses && g.glaze && g.glaze === st.ses.glaze ? st.ses.gs : null;
    if (gs && gs.band) live = { y: gs.band.y, half: gs.band.half, motif: TRADITIONS[g.glaze.trad].motifs[g.glaze.motif], acc: g.glaze.acc };
    const sig = texSig(g) + (live ? `|live${live.half.toFixed(2)}${live.y.toFixed(2)}${live.motif}` : '');
    if (sig !== texKey) { buildTexture(g.glaze ? { ...g.glaze, bands: g.glaze.bands.map((b) => ({ ...b, motif: motifName(g.glaze, b.motif) })) } : null, g.stage, live); texKey = sig; }
    setLook(g);
    potMesh.rotation.y = -pot.theta; wheel.rotation.y = -pot.theta;
    const cam = camFor(g.W, g.H, g.rect, g.box);
    camera.fov = cam.fovDeg; camera.aspect = cam.aspect; camera.near = 0.5; camera.far = 80;
    camera.position.set(cam.pos[0], cam.pos[1], cam.pos[2]);
    camera.lookAt(cam.target[0], cam.target[1], cam.target[2]);
    camera.updateProjectionMatrix();
    stage.setShadowTarget(0, 1.2, 0);
    stage.update(0);
  }
  return { stage, ok: true, wrap(game) { const r = game.render.bind(game); game.render = (ctx, view) => { r(ctx, view); try { frame(game); } catch (e) { if (!frame.warned) { frame.warned = true; console.warn('3D frame failed', e); } } }; return game; } };
}

// Carrom 3D presenter. READS what the 2D layer handed over this frame (src/v3.js: the board pose and every piece, in the board's canonical
// space) and never writes game state. One WebGL canvas sits behind the kit's transparent 2D canvas (HUD, buttons, aim line, text stay 2D and keep
// all input). The scene: a peacock-green baize table lit by a brass lamp, a thick turned-wood board with a raised frame, and chunky turned coins
// (lathe profile with bevelled edges, printed top faces), a steel-and-amber striker, soft contact shadows.
// Taps stay exact: the camera is orthographic and pitched, and the table plane is stretched by 1/sin(pitch) so that a point of the playing surface
// lands on screen at exactly the (x, y) the 2D layer computed; the surface is lifted into place so heights never shift the aim.
// No WebGL, ?flat=1 or a lost context: v3.on = false and every screen draws the flat 2D art; a restored context rebuilds the scene.
import * as THREE from '../vendor3d/three.js';
import { v3 } from '../src/v3.js';
import { meta } from '../src/game.js';
import { boardPart, pieceTop } from '../src/art.js';
import { PLAY, FRAME, K, CX, CY } from '../src/layout.js';
import { R_COIN, R_STR, R_POCKET } from '../src/physics.js';

const D2R = Math.PI / 180;
const PITCH = 50 * D2R, SIN = Math.sin(PITCH), COS = Math.cos(PITCH);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TIERS = [{ name: 'high', dpr: 2, tex: 1 }, { name: 'medium', dpr: 1.5, tex: 1 }, { name: 'low', dpr: 1, tex: 0.5 }];
const tick = () => new Promise((r) => setTimeout(r, 0));
const HS = 24, RAIL = 16, FS = PLAY + 2 * FRAME;           // board body height, rail height above the playing surface, outer size (canonical units)
const RC = R_COIN * K, RS = R_STR * K, HC = 8.5, HSTR = 11;   // piece radii and heights (canonical units)
const CAP = 40;

const cvs = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
function tex(c, rep, srgb = true) { const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); } return t; }
let rs = 1; const rnd = () => ((rs = (Math.imul(rs, 1664525) + 1013904223) >>> 0) / 4294967296);

function baizeCanvas(k) {   // peacock-green baize: a woven nap with flecks
  rs = 5; const N = 256 * k, c = cvs(N, N), g = c.getContext('2d'); g.scale(k, k);
  g.fillStyle = '#1b5557'; g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 2) { g.fillStyle = (y / 2) % 2 ? 'rgba(255,255,255,0.035)' : 'rgba(0,20,20,0.06)'; g.fillRect(0, y, 256, 1); }
  for (let x = 0; x < 256; x += 2) { g.fillStyle = (x / 2) % 2 ? 'rgba(255,255,255,0.03)' : 'rgba(0,20,20,0.05)'; g.fillRect(x, 0, 1, 256); }
  for (let i = 0; i < 2600; i++) { g.fillStyle = rnd() < 0.5 ? 'rgba(0,30,30,0.12)' : 'rgba(120,200,190,0.10)'; g.fillRect(rnd() * 256, rnd() * 256, 1.2, 1.2); }
  return c;
}
function softCanvas() {   // a soft rounded-rect shadow: concentric translucent rounded rects (no ctx.filter: Safari lacks it)
  const c = cvs(128, 128), g = c.getContext('2d');
  for (let i = 0; i < 22; i++) { const m = 4 + i * 2.6; g.fillStyle = 'rgba(2,10,10,0.07)'; g.beginPath(); g.roundRect(m, m, 128 - 2 * m, 128 - 2 * m, Math.max(2, 40 - i * 1.6)); g.fill(); }
  return c;
}
function discShadow() {
  const c = cvs(64, 64), g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 6, 32, 32, 31);
  gr.addColorStop(0, 'rgba(0,6,6,0.75)'); gr.addColorStop(0.6, 'rgba(0,6,6,0.4)'); gr.addColorStop(1, 'rgba(0,6,6,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return c;
}
function roundRectShape(w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y); return s;
}
// the frame: a rounded square ring whose hole is the playing surface with a round notch at each corner (the pockets); top face UV-mapped to the painted frame texture
const PK = { x: 8 * K, r: R_POCKET * K };   // pocket centre offset from the surface corner, radius (canonical units)
function pocketNotches(h) {
  const d = Math.sqrt(PK.r * PK.r - PK.x * PK.x), pts = [];
  // corners in counter-clockwise order (x right, y up in shape space): BL, BR, TR, TL; the traversal enters on the edge it came along
  for (const [sx, sy, vFirst] of [[-1, -1, true], [1, -1, false], [1, 1, true], [-1, 1, false]]) {
    const cx = sx * (h - PK.x), cy = sy * (h - PK.x);
    const aV = Math.atan2(-sy * d, sx * PK.x), aH = Math.atan2(sy * PK.x, -sx * d);   // where the circle leaves the vertical edge / re-enters at the horizontal edge (the long way round, outside the square)
    const a0 = vFirst ? aV : aH, a1 = vFirst ? aH : aV, TAU = Math.PI * 2, mod = (x) => ((x % TAU) + TAU) % TAU, diag = Math.atan2(sy, sx);
    const ccw = mod(a1 - a0), da = mod(diag - a0) < ccw ? ccw : ccw - TAU;
    for (let i = 0; i <= 14; i++) { const a = a0 + da * i / 14; pts.push([cx + Math.cos(a) * PK.r, cy + Math.sin(a) * PK.r]); }
  }
  return pts;
}
function frameGeo() {
  const s = roundRectShape(FS - 2, FS - 2, 20), hole = new THREE.Path(), h = PLAY / 2, hp = pocketNotches(h);
  hole.moveTo(hp[0][0], hp[0][1]); for (let i = 1; i < hp.length; i++) hole.lineTo(hp[i][0], hp[i][1]); hole.closePath(); s.holes.push(hole);
  const dep = HS + RAIL - 3, g = new THREE.ExtrudeGeometry(s, { depth: dep, bevelEnabled: true, bevelThickness: 3, bevelSize: 1.6, bevelSegments: 2, steps: 1, curveSegments: 8 });
  g.rotateX(-Math.PI / 2);
  const P = g.attributes.position, N = g.attributes.normal, UV = g.attributes.uv;
  for (let i = 0; i < P.count; i++) if (Math.abs(N.getY(i)) > 0.9) UV.setXY(i, P.getX(i) / FS + 0.5, 0.5 - P.getZ(i) / FS);
  return g;
}
function pocketCanvas() { const c = cvs(128, 128), g = c.getContext('2d'), gr = g.createRadialGradient(54, 50, 4, 64, 64, 64); gr.addColorStop(0, '#1b120c'); gr.addColorStop(0.7, '#060302'); gr.addColorStop(1, '#000'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); return c; }
// a turned coin: bevelled cylinder body (lathe); the printed top face is a separate disc just above it
function coinBody(R, H) {
  const b = Math.min(2.2, H * 0.28), pts = [[0.01, 0], [R - b, 0], [R - 0.2, b * 0.55], [R, b * 1.6], [R, H - b * 1.6], [R - 0.2, H - b * 0.55], [R - b, H], [0.01, H]].map((p) => new THREE.Vector2(p[0], p[1]));
  return new THREE.LatheGeometry(pts, 40);
}

export async function createPresenter({ kitCanvas }) {
  if (typeof OffscreenCanvas === 'undefined') return { ok: false };
  const qs = new URLSearchParams(location.search);
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;height:100dvh;display:block;pointer-events:none;z-index:0;visibility:hidden';
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' }); } catch (e) { console.warn('WebGL unavailable; flat 2D art', e); return { ok: false }; }
  if (!renderer.getContext()) return { ok: false };
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.NoToneMapping; renderer.setClearColor(0x0c2a2c, 1);
  let tier = qs.has('tier') ? clamp(Number(qs.get('tier')), 0, 2) : (navigator.hardwareConcurrency || 8) <= 4 ? 1 : 0;
  await tick();

  const scene = new THREE.Scene();
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 9000);
  scene.add(new THREE.HemisphereLight(0xe8fff6, 0x10302e, 0.55));
  const key = new THREE.DirectionalLight(0xfff0d0, 0.95); scene.add(key); scene.add(key.target);
  const lamp = new THREE.PointLight(0xffe6bc, 1, 0, 2); scene.add(lamp);

  const G = new THREE.Group(); G.scale.set(1, 1, 1 / SIN); scene.add(G);   // z is the 2D layer's y, stretched so the pitched ortho view maps it 1:1
  const k = TIERS[tier].tex;
  const baize = tex(baizeCanvas(k > 0.9 ? 1 : 0.5), [1, 1]);
  const table = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: baize, bumpMap: baize, bumpScale: 0.8, roughness: 0.95, metalness: 0 })); G.add(table);
  const flat = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const soft = tex(softCanvas());
  const boardShadow = new THREE.Mesh(flat, new THREE.MeshBasicMaterial({ map: soft, transparent: true, depthWrite: false, opacity: 0.9, toneMapped: false })); boardShadow.renderOrder = 1; G.add(boardShadow);

  // ---- the board (canonical units; the group is scaled by the board's on-screen scale f and lifted so the playing surface sits at its 2D place)
  const B = new THREE.Group(); G.add(B);
  const sideMat = new THREE.MeshStandardMaterial({ color: 0x5b3419, roughness: 0.55, metalness: 0.02 });
  let theme = '';
  const frameMat = new THREE.MeshStandardMaterial({ roughness: 0.42, metalness: 0.03, emissive: 0xffffff, emissiveIntensity: 0.2 });
  const faceMat = new THREE.MeshStandardMaterial({ roughness: 0.34, metalness: 0, emissive: 0xffffff, emissiveIntensity: 0.3 });
  const frame = new THREE.Mesh(frameGeo(), [frameMat, sideMat]); B.add(frame);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(PLAY, PLAY).rotateX(-Math.PI / 2), faceMat); face.position.y = HS; B.add(face);
  const pocketMat = new THREE.MeshBasicMaterial({ map: tex(pocketCanvas()), toneMapped: false }), pocketGeo = new THREE.CircleGeometry(PK.r, 40).rotateX(-Math.PI / 2);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { const m = new THREE.Mesh(pocketGeo, pocketMat); m.position.set(sx * (PLAY / 2 - PK.x), HS - 0.6, sz * (PLAY / 2 - PK.x)); B.add(m); }
  function setTheme(th) {
    if (th === theme) return; theme = th;
    frameMat.map?.dispose(); faceMat.map?.dispose(); frameMat.emissiveMap = frameMat.map = tex(boardPart('frame', th)); faceMat.emissiveMap = faceMat.map = tex(boardPart('face', th)); frameMat.needsUpdate = faceMat.needsUpdate = true;
  }

  // ---- pieces
  const TONE = { W: 0xe6d9b8, B: 0x1b1b21, Q: 0xb3262a, S: 0xaeb4bf };
  const bodies = { W: coinBody(RC, HC), B: coinBody(RC, HC), Q: coinBody(RC, HC), S: coinBody(RS, HSTR) };
  const bodyMat = {}, topMat = {}, topGeo = {}, pools = { W: [], B: [], Q: [], S: [] };
  for (const kk of ['W', 'B', 'Q', 'S']) {
    bodyMat[kk] = new THREE.MeshStandardMaterial({ color: TONE[kk], roughness: kk === 'S' ? 0.28 : 0.38, metalness: kk === 'S' ? 0.55 : 0.05 });
    const t = tex(pieceTop(kk)); topMat[kk] = new THREE.MeshStandardMaterial({ map: t, color: kk === 'B' ? 0x2a2a2a : 0xffffff, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: kk === 'B' ? 0.3 : 0.22, roughness: 0.85, metalness: 0 });
    topGeo[kk] = new THREE.CircleGeometry(kk === 'S' ? RS : RC, 40).rotateX(-Math.PI / 2);
  }
  const take = (kk, n) => { const p = pools[kk]; let o = p[n]; if (!o) { o = new THREE.Group(); const b = new THREE.Mesh(bodies[kk], bodyMat[kk]), t = new THREE.Mesh(topGeo[kk], topMat[kk]); t.position.y = (kk === 'S' ? HSTR : HC) + 0.06; o.add(b); o.add(t); B.add(o); p[n] = o; } return o; };
  const blobMat = new THREE.MeshBasicMaterial({ map: tex(discShadow()), transparent: true, depthWrite: false, toneMapped: false });
  const blobs = new THREE.InstancedMesh(flat, blobMat, CAP); blobs.frustumCulled = false; blobs.count = 0; blobs.renderOrder = 3; B.add(blobs);

  // ---------------------------------------------------------------- per frame
  const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _q = new THREE.Quaternion();
  let lost = false, lastNow = 0, clock = 0, fadeIn = 0, shown = false, frameAvg = 16, slowFrames = 0, sizeKey = '';
  const cssW = () => Math.max(1, window.innerWidth), cssH = () => Math.max(1, window.innerHeight);
  const cpu = () => meta.cssPerUnit || Math.min(cssW(), cssH()) / 720;
  function applyTier() { renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, TIERS[tier].dpr)); sizeKey = ''; }
  applyTier();
  function render() {
    const P = v3.pose; if (!P) return;
    const W = cssW(), Hh = cssH(), c = cpu();
    const offX = (W - meta.width * c) / 2, offY = (Hh - meta.height * c) / 2, x0 = -offX / c, x1 = (W - offX) / c, y0 = -offY / c, y1 = (Hh - offY) / c, cx = (x0 + x1) / 2, yc = (y0 + y1) / 2;
    const sk = `${W}x${Hh}|${c.toFixed(4)}|${tier}`; if (sk !== sizeKey) { sizeKey = sk; renderer.setSize(W, Hh, false); }
    cam.left = -(x1 - x0) / 2; cam.right = (x1 - x0) / 2; cam.top = (y1 - y0) / 2; cam.bottom = -(y1 - y0) / 2; cam.updateProjectionMatrix();
    const tz = yc / SIN; cam.position.set(cx, SIN * 3000, tz + COS * 3000); cam.up.set(0, 1, 0); cam.lookAt(cx, 0, tz); cam.updateMatrixWorld(true);
    key.position.set(P.cx - 520, 1100, P.cy * 0.9 + 380); key.target.position.set(P.cx, 0, P.cy); key.target.updateMatrixWorld();
    const fl = 1 + 0.03 * Math.sin(clock * 6.3) + 0.02 * Math.sin(clock * 11.1 + 1.3);
    lamp.position.set(P.cx, 620, P.cy - 120); lamp.intensity = 0.45e6 * fl;
    table.position.set(cx, 0, yc); table.scale.set(x1 - x0 + 200, 1, (y1 - y0) / SIN + 200 / SIN * 0 + 200); baize.repeat.set((x1 - x0 + 200) / 256, ((y1 - y0) / SIN + 200) / 256);
    setTheme(v3.theme);
    const f = P.f;
    B.scale.set(f, f, f); B.position.set(P.cx, 0, P.cy + HS * f * COS);
    boardShadow.position.set(P.cx + 14 * f, 0.3, P.cy + 30 * f); boardShadow.scale.set((FS + 90) * f, 1, (FS + 90) * f);
    const per = { W: 0, B: 0, Q: 0, S: 0 }; let nb = 0;
    for (const a of v3.pieces) {
      if (a.alpha < 0.12 || per[a.k] >= 24 || nb >= CAP) continue;
      const o = take(a.k, per[a.k]++), H = a.k === 'S' ? HSTR : HC, R = (a.k === 'S' ? RS : RC) * a.s, lift = a.lift * 9, sink = (1 - a.alpha) * 6;
      o.visible = true; o.position.set(a.x - CX, HS + lift - sink, a.y - CY); o.scale.set(a.s, a.s * (0.6 + 0.4 * a.alpha), a.s);
      _p.set(a.x - CX + (0.28 + lift * 0.02) * R, HS + 0.25, a.y - CY + (0.42 + lift * 0.03) * R); const sc = R * (2.7 + lift * 0.05); _s.set(sc, 1, sc);
      blobs.setMatrixAt(nb++, _m.compose(_p, _q, _s));
    }
    for (const kk in pools) for (let i = per[kk]; i < pools[kk].length; i++) if (pools[kk][i]) pools[kk][i].visible = false;
    blobs.count = nb; blobs.instanceMatrix.needsUpdate = true;
    renderer.render(scene, cam);
  }
  function post() {
    if (lost) return;
    const now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1); lastNow = now; clock += dt;
    if (!v3.active || !v3.pose) { if (shown) { shown = false; canvas.style.visibility = 'hidden'; } return; }
    if (!shown) { shown = true; canvas.style.visibility = 'visible'; }
    if (fadeIn < 1) { fadeIn = Math.min(1, fadeIn + dt / 0.25); canvas.style.opacity = String(fadeIn); }
    render();
    const ft = dt * 1000; if (ft > 0) frameAvg = frameAvg * 0.95 + ft * 0.05;
    if (frameAvg > 26 && tier < 2) { if (++slowFrames > 90) { tier++; slowFrames = 0; frameAvg = 16; applyTier(); } } else slowFrames = 0;
  }

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; v3.on = false; shown = false; canvas.style.visibility = 'hidden'; });
  canvas.addEventListener('webglcontextrestored', () => { lost = false; fadeIn = 0; canvas.style.opacity = '0'; sizeKey = ''; theme = ''; applyTier(); v3.on = true; });

  await tick();
  return {
    ok: true, renderer, scene, camera: cam,
    attach() { v3.on = true; fadeIn = 0; canvas.style.opacity = '0'; },
    pre() {}, post,
    get tier() { return TIERS[tier].name; },
  };
}

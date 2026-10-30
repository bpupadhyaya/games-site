// Crossword 3D presenter. READS what board.js registered this frame in src/v3.js (square colours and lift), never writes game state.
// One WebGL canvas sits behind the kit's transparent 2D canvas; board.js cuts a window in its paper where the board is, and this file
// renders the board into exactly that rectangle: a lacquered tray with a brass lip, a polished floor, ivory squares as real chamfered
// tiles that cast shadows, and raised glossy black blocks. The camera looks straight down the board with a very small field of view and
// the board's own coordinates, so letters, numbers, taps and the zoom/pan of big grids stay aligned with what is on screen.
// No WebGL, ?flat=1 or a lost context: v3.on = false and the flat 2D board is drawn instead.
import * as THREE from '../vendor3d/three.js';
import { v3 } from '../src/v3.js';
import { meta } from '../src/game.js';

const D2R = Math.PI / 180, FOV = 10, MAXC = 13 * 13;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TIERS = [{ name: 'high', dpr: 2, shadow: 2048 }, { name: 'medium', dpr: 1.5, shadow: 1024 }, { name: 'low', dpr: 1, shadow: 0 }];
const tick = () => new Promise((r) => setTimeout(r, 0));

// a chamfered rounded slab (footprint 1 x 1, height 1) so edges catch the light
function slabGeo(r, bev) {
  const s = new THREE.Shape(), h = 0.5 - bev;
  s.moveTo(-h + r, -h); s.lineTo(h - r, -h); s.quadraticCurveTo(h, -h, h, -h + r); s.lineTo(h, h - r); s.quadraticCurveTo(h, h, h - r, h);
  s.lineTo(-h + r, h); s.quadraticCurveTo(-h, h, -h, h - r); s.lineTo(-h, -h + r); s.quadraticCurveTo(-h, -h, -h + r, -h);
  const g = new THREE.ExtrudeGeometry(s, { depth: 1 - 2 * bev, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 2, curveSegments: 3 });
  g.translate(0, 0, bev); g.computeVertexNormals();
  return g;
}
function ringGeo(x0, y0, x1, y1, r0, hx0, hy0, hx1, hy1, r1, depth, bev) {   // outer rounded rect with a rounded hole
  const rr = (s, a, b, c, d, r) => { s.moveTo(a + r, b); s.lineTo(c - r, b); s.quadraticCurveTo(c, b, c, b + r); s.lineTo(c, d - r); s.quadraticCurveTo(c, d, c - r, d); s.lineTo(a + r, d); s.quadraticCurveTo(a, d, a, d - r); s.lineTo(a, b + r); s.quadraticCurveTo(a, b, a + r, b); };
  const sh = new THREE.Shape(); rr(sh, x0, y0, x1, y1, r0);
  const hole = new THREE.Path(); rr(hole, hx0, hy0, hx1, hy1, r1); sh.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(sh, { depth: depth - 2 * bev, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 3, curveSegments: 6 });
  g.translate(0, 0, bev); g.computeVertexNormals();
  return g;
}
function grainTex() {
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
  x.fillStyle = '#808080'; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i++) { const v = 100 + Math.random() * 60; x.fillStyle = `rgba(${v},${v},${v},0.35)`; x.fillRect(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 60, 1); }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

export async function createPresenter({ kitCanvas }) {
  const qs = new URLSearchParams(location.search);
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;height:100dvh;display:block;pointer-events:none;z-index:0;visibility:hidden';
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' }); } catch (e) { console.warn('WebGL unavailable; flat 2D board', e); return { ok: false }; }
  if (!renderer.getContext()) return { ok: false };
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x0c2230, 1);
  let tier = qs.has('tier') ? clamp(Number(qs.get('tier')), 0, 2) : (navigator.hardwareConcurrency || 8) <= 4 ? 1 : 0;

  await tick();
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 100, 60000);
  const hemi = new THREE.HemisphereLight(0xffffff, 0x8899aa, 0.38); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff1dc, 0.9); sun.castShadow = true; sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.35; scene.add(sun, sun.target);
  const buildEnv = () => { try { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; pm.dispose(); scene.environmentIntensity = 0.5; } catch { /* no IBL */ } };
  buildEnv();
  await tick();

  // geometry is unit-sized and scaled per instance
  const tileGeo = slabGeo(0.07, 0.045), blockGeo = slabGeo(0.05, 0.07);
  const tiles = new THREE.InstancedMesh(tileGeo, new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.0 }), MAXC);
  const blocks = new THREE.InstancedMesh(blockGeo, new THREE.MeshStandardMaterial({ roughness: 0.22, metalness: 0.35 }), MAXC);
  for (const m of [tiles, blocks]) { m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; m.count = 0; scene.add(m); }
  const floorMat = new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.2 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), floorMat); floor.receiveShadow = true; scene.add(floor);
  const grain = grainTex();
  const trayMat = new THREE.MeshStandardMaterial({ roughness: 0.38, metalness: 0.15, bumpMap: grain, bumpScale: 0.6 });
  const lipMat = new THREE.MeshStandardMaterial({ roughness: 0.28, metalness: 0.85 });
  let tray = null, lip = null, trayKey = '';
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();
  const lin = (css) => _c.setStyle(css).clone();

  function applyTier() {
    const t = TIERS[tier];
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, t.dpr));
    renderer.shadowMap.enabled = t.shadow > 0; sun.castShadow = t.shadow > 0;
    if (t.shadow) { sun.shadow.mapSize.set(t.shadow, t.shadow); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
    scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { if (m && m.isMaterial) m.needsUpdate = true; }); });
  }
  applyTier();

  const cpu = () => meta.cssPerUnit || (Math.min(window.innerWidth, window.innerHeight) / 720);
  const cssW = () => Math.max(1, window.innerWidth), cssH = () => Math.max(1, window.innerHeight);
  let lastNow = 0, frameAvg = 16, slow = 0, game = null, lost = false;

  function buildTray(b, T) {
    const key = `${b.x}|${b.y}|${b.size}|${b.pad}|${T.frame}|${T.rim}`;
    if (key === trayKey) return; trayKey = key;
    for (const m of [tray, lip]) if (m) { scene.remove(m); m.geometry.dispose(); }
    const B = b.size, p = b.pad, d = Math.max(b.s * 0.55, 8), cx = b.x + B / 2, cy = -(b.y + B / 2), R = B * 0.03;
    const ox = -B / 2, oy = -B / 2, ix = ox + p - 1.5, iy = oy + p - 1.5, iw = B - 2 * p + 3;
    tray = new THREE.Mesh(ringGeo(ox, oy, ox + B, oy + B, R, ix - 3, iy - 3, ix + iw + 3, iy + iw + 3, 3, d, Math.min(d * 0.25, 5)), trayMat);
    tray.position.set(cx, cy, 0); tray.castShadow = true; tray.receiveShadow = true; scene.add(tray);
    lip = new THREE.Mesh(ringGeo(ix - 3, iy - 3, ix + iw + 3, iy + iw + 3, 3, ix + 1, iy + 1, ix + iw - 1, iy + iw - 1, 1, d * 0.42, 1.2), lipMat);
    lip.position.set(cx, cy, 0); lip.castShadow = false; scene.add(lip);
  }

  function post() {
    if (!game || lost) return;
    const st = v3.stage;
    const now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1); lastNow = now;
    if (!st) { canvas.style.visibility = 'hidden'; return; }
    canvas.style.visibility = 'visible';
    const { geo: b, n, T } = st, W = cssW(), H = cssH(), c = cpu(), offX = (W - meta.width * c) / 2, offY = (H - meta.height * c) / 2;
    const rect = st.zoomed ? b.view : { x: b.x, y: b.y, w: b.size, h: b.size };
    const rc = { x: rect.x * c + offX, y: rect.y * c + offY, w: rect.w * c, h: rect.h * c };
    const cs = b.s, gap = Math.max(0.8, Math.min(1.8, cs * 0.04)), tileD = Math.max(cs * 0.13, 3), blockD = Math.max(cs * 0.3, 7), liftD = cs * 0.16;
    // floor (the dark grid lines between squares) + tray
    const fl = st.zoomed ? rect : { x: b.x + b.pad - 1.5, y: b.y + b.pad - 1.5, w: b.size - 2 * b.pad + 3, h: b.size - 2 * b.pad + 3 };
    floor.scale.set(fl.w, fl.h, 1); floor.position.set(fl.x + fl.w / 2, -(fl.y + fl.h / 2), -0.5); floorMat.color.copy(lin(T.ink));
    if (st.zoomed) { if (tray) { tray.visible = false; lip.visible = false; } } else { buildTray(b, T); tray.visible = lip.visible = true; trayMat.color.copy(lin(T.frame)).multiplyScalar(T.dark ? 2.2 : 1.3); lipMat.color.set('#d4ab55'); }
    let nt = 0, nb = 0;
    for (let i = 0; i < n * n; i++) {
      const q = st.cells[i], r = b.cells[i]; if (!q) continue;
      const x = r.x + gap + (q.dx || 0), y = r.y + gap, w = r.w - 2 * gap, h = r.h - 2 * gap;
      if (q.k === 0) { _p.set(x + w / 2, -(y + h / 2), 0); _s.set(w, h, blockD); blocks.setMatrixAt(nb, _m.compose(_p, _q.identity(), _s)); blocks.setColorAt(nb, lin(T.block).lerp(lin(T.blockHi), 0.35)); nb++; }
      else { const z = (q.lift || 0) * liftD, d = tileD + z; _p.set(x + w / 2, -(y + h / 2), 0); _s.set(w, h, d); tiles.setMatrixAt(nt, _m.compose(_p, _q.identity(), _s)); tiles.setColorAt(nt, lin(q.face)); nt++; }
    }
    tiles.count = nt; blocks.count = nb;
    for (const m of [tiles, blocks]) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
    // camera: straight down the board through its centre; the visible height is the rectangle's height in world units
    const visH = rect.h, visW = rect.w, cxw = rect.x + rect.w / 2, cyw = -(rect.y + rect.h / 2);
    const dist = (visH / 2) / Math.tan(FOV * D2R / 2);
    camera.aspect = rc.w / rc.h; camera.fov = FOV; camera.position.set(cxw, cyw, dist); camera.up.set(0, 1, 0); camera.lookAt(cxw, cyw, 0); camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
    const E = Math.max(visW, visH) * 0.75;
    sun.position.set(cxw - 0.5 * dist, cyw + 0.6 * dist, 0.62 * dist); sun.target.position.set(cxw, cyw, 0); sun.target.updateMatrixWorld();
    const sc = sun.shadow.camera; if (sc.right !== E || sc.far !== dist * 3) { sc.left = -E; sc.right = E; sc.top = E; sc.bottom = -E; sc.near = dist * 0.2; sc.far = dist * 3; sc.updateProjectionMatrix(); }
    renderer.setSize(W, H, false);
    renderer.setViewport(rc.x, H - rc.y - rc.h, rc.w, rc.h); renderer.setScissor(rc.x, H - rc.y - rc.h, rc.w, rc.h); renderer.setScissorTest(true);
    renderer.render(scene, camera);
    const ft = dt * 1000; if (ft > 0) frameAvg = frameAvg * 0.95 + ft * 0.05;
    if (frameAvg > 26 && tier < 2) { if (++slow > 90) { tier++; slow = 0; frameAvg = 16; applyTier(); } } else slow = 0;
  }

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; v3.on = false; canvas.style.visibility = 'hidden'; });
  canvas.addEventListener('webglcontextrestored', () => { lost = false; buildEnv(); applyTier(); trayKey = ''; v3.on = true; });
  return { ok: true, attach(g) { game = g; v3.on = true; }, post, get tier() { return tier; } };
}

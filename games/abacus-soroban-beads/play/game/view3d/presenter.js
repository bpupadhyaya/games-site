// Abacus Soroban 3D presenter. READS the game (v3.frame, filled by the 2D layer each frame); never writes game state. One WebGL canvas sits behind
// the kit's transparent 2D canvas: a soroban lying on a lacquered desk seen from above, built from the SAME virtual-unit geometry the 2D layer uses for
// hit-testing (abacusGeo), so a thumb on a bead is a thumb on the 3D bead. The camera is a perspective camera whose centre plane (the rods) maps
// exactly 1 virtual unit to meta.cssPerUnit CSS px. No WebGL or a lost context: v3.on = false and every screen draws the flat 2D art.
import * as THREE from '../vendor3d/three.js';
import { v3, isDesk } from '../src/v3.js';
import { meta } from '../src/game.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TIERS = [{ name: 'high', dpr: 2, shadow: 2048 }, { name: 'medium', dpr: 1.5, shadow: 1024 }, { name: 'low', dpr: 1, shadow: 0 }];
const tick = () => new Promise((r) => setTimeout(r, 0));
const FOV = 26, CAP = 128;
const mixC = (a, b, t) => new THREE.Color(a).lerp(new THREE.Color(b), t);

function rrPath(p, x, y, w, h, r) {
  p.moveTo(x + r, y); p.lineTo(x + w - r, y); p.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false); p.lineTo(x + w, y + h - r); p.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
  p.lineTo(x + r, y + h); p.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false); p.lineTo(x, y + r); p.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
}
function rng(seed) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }
function woodTex(a, b, vein, size = 512) {
  const c = document.createElement('canvas'); c.width = c.height = size; const x = c.getContext('2d'), r = rng(7);
  const g = x.createLinearGradient(0, 0, size, size * 0.4); g.addColorStop(0, a); g.addColorStop(0.5, b); g.addColorStop(1, a); x.fillStyle = g; x.fillRect(0, 0, size, size);
  x.lineCap = 'round';
  for (let k = 0; k < 70; k++) { const y = r() * size, w = 0.6 + r() * 2.2; x.strokeStyle = `rgba(${vein},${0.05 + r() * 0.16})`; x.lineWidth = w; x.beginPath(); x.moveTo(0, y); x.bezierCurveTo(size * 0.3, y + (r() - 0.5) * 14, size * 0.65, y + (r() - 0.5) * 14, size, y + (r() - 0.5) * 6); x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t;
}
function deskTex(T) {
  const S = 1024, c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d'), r = rng(11), n = 6, ph = S / n;
  const base = mixC(T.wood1, T.bg0, 0.45);
  for (let i = 0; i < n; i++) {
    const k = 0.78 + r() * 0.5, col = base.clone().multiplyScalar(k * 0.95);
    x.fillStyle = `#${col.getHexString()}`; x.fillRect(0, i * ph, S, ph);
    for (let j = 0; j < 40; j++) { const y = i * ph + 4 + r() * (ph - 8); x.strokeStyle = `rgba(0,0,0,${0.05 + r() * 0.12})`; x.lineWidth = 0.6 + r() * 1.6; x.beginPath(); x.moveTo(0, y); x.bezierCurveTo(S * 0.3, y + (r() - 0.5) * 8, S * 0.7, y + (r() - 0.5) * 8, S, y + (r() - 0.5) * 4); x.stroke(); }
    x.fillStyle = 'rgba(0,0,0,0.55)'; x.fillRect(0, i * ph, S, 3);
    x.fillStyle = 'rgba(255,255,255,0.07)'; x.fillRect(0, i * ph + 3, S, 2);
    const j = r() * S * 0.8; x.fillStyle = 'rgba(0,0,0,0.5)'; x.fillRect(j, i * ph, 3, ph);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t;
}
// A bead is a round bicone: lathe profile around the rod, hole in the middle, slightly rounded ridge. Axis ends along world Z (the rod).
function beadGeo(bw, bh, hole) {
  const hx = bw / 2, hy = bh / 2, fw = bw * 0.17, pts = [];
  const half = [[hole, -hy], [fw * 0.92, -hy], [fw * 1.28, -hy * 0.975], [hx * 0.74, -hy * 0.58], [hx * 0.93, -hy * 0.2], [hx * 0.99, -hy * 0.055], [hx, 0]];
  for (const [r, y] of half) pts.push(new THREE.Vector2(r, y));
  for (let i = half.length - 2; i >= 0; i--) pts.push(new THREE.Vector2(half[i][0], -half[i][1]));
  const g = new THREE.LatheGeometry(pts, 40); g.rotateX(Math.PI / 2); g.computeVertexNormals(); return g;
}

export async function createPresenter({ kitCanvas }) {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;height:100dvh;display:block;pointer-events:none;z-index:0;visibility:hidden;opacity:0;transition:opacity .35s';
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' }); } catch (e) { console.warn('WebGL unavailable; flat 2D art', e); return { ok: false }; }
  if (!renderer.getContext()) return { ok: false };
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.9;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  let tier = (navigator.hardwareConcurrency || 8) <= 4 ? 1 : 0;

  await tick();
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 10, 40000);
  const key = new THREE.DirectionalLight(0xffe6c8, 1.7); key.castShadow = true; key.shadow.bias = -0.0003; key.shadow.normalBias = 1.2; key.shadow.radius = 5;
  const fill = new THREE.DirectionalLight(0xbfd0ff, 0.25); fill.position.set(900, 1200, 700);
  const hemi = new THREE.HemisphereLight(0xfff4e6, 0x30201a, 0.3);
  scene.add(key, key.target, fill, hemi);
  const buildEnv = () => { try { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; pm.dispose(); scene.environmentIntensity = 0.32; } catch { /* no IBL */ } };
  buildEnv();
  await tick();

  // ---- desk
  const deskMat = new THREE.MeshStandardMaterial({ roughness: 0.55, metalness: 0.0, envMapIntensity: 0.35 });
  const desk = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000), deskMat); desk.rotation.x = -Math.PI / 2; desk.receiveShadow = true; scene.add(desk);

  // ---- abacus (rebuilt when the geometry or the look changes)
  const root = new THREE.Group(), tilt = new THREE.Group(); scene.add(root); root.add(tilt);
  let built = null, buildKey = '', beads = null, bead = null;
  const mats = {};
  const matsFor = (T, slot) => {
    const k = T.name; if (mats.k === k) return mats; mats.k = k;
    for (const m of Object.values(mats)) if (m && m.dispose) m.dispose();
    mats.wood = new THREE.MeshStandardMaterial({ map: woodTex(T.wood0, T.wood1, '40,16,6'), roughness: 0.38, envMapIntensity: 0.7 });
    mats.beam = new THREE.MeshStandardMaterial({ map: woodTex(T.beam0, T.beam1, '90,60,20'), roughness: 0.42, envMapIntensity: 0.6 });
    mats.floor = new THREE.MeshStandardMaterial({ color: mixC(T.wood1, '#000000', 0.72), roughness: 0.85 });
    mats.rod = new THREE.MeshStandardMaterial({ color: T.rod, metalness: 0.9, roughness: 0.28, envMapIntensity: 1.2 });
    mats.dot = new THREE.MeshStandardMaterial({ color: '#2a140a', roughness: 0.6 });
    mats.bead = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(T.bead), roughness: 0.2, metalness: 0.0, clearcoat: 1, clearcoatRoughness: 0.12, envMapIntensity: 1.15 });
    deskMat.map = deskTex(T); deskMat.map.repeat.set(9, 9); deskMat.needsUpdate = true;
    return mats;
  };
  function build(g, T) {
    if (built) { tilt.remove(built); built.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); }
    if (bead) bead.dispose();
    const M = matsFor(T, g.slot), grp = new THREE.Group(), { slot, fr, bw } = g;
    const W = g.w, H = g.h, depth = bw * 1.24, r0 = slot * 0.5, iw = W - fr * 1.56, ih = H - fr * 1.56, bev = slot * 0.07;
    const shape = new THREE.Shape(); rrPath(shape, -W / 2, -H / 2, W, H, r0);
    const hole = new THREE.Path(); rrPath(hole, -iw / 2, -ih / 2, iw, ih, r0 * 0.55); shape.holes.push(hole);
    const fg = new THREE.ExtrudeGeometry(shape, { depth: depth - 2 * bev, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 3, curveSegments: 14 });
    fg.rotateX(Math.PI / 2); fg.translate(0, depth / 2 - bev, 0);
    const uv = fg.attributes.uv, s = 1 / (slot * 12); for (let i = 0; i < uv.count; i++) uv.setXY(i, 0.5 + uv.getX(i) * s, 0.5 + uv.getY(i) * s);
    const frame = new THREE.Mesh(fg, M.wood); frame.castShadow = true; frame.receiveShadow = true; grp.add(frame);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(iw + 2, ih + 2), M.floor); floor.rotation.x = -Math.PI / 2; floor.position.y = -bw * 0.585; floor.receiveShadow = true; grp.add(floor);
    const cy = g.y + H / 2, cx = g.x + W / 2, bz = (g.beamTop + g.beamH / 2) - cy;
    const beam = new THREE.Mesh(new THREE.BoxGeometry(iw + 2, depth - bev, g.beamH), M.beam); beam.position.set(0, -bev / 2, bz); beam.castShadow = true; beam.receiveShadow = true; grp.add(beam);
    const rr_ = Math.max(1.6, slot * 0.045), rl = g.bottom - g.top + fr * 0.3;
    const rg = new THREE.CylinderGeometry(rr_, rr_, rl, 14); rg.rotateX(Math.PI / 2);
    for (let r = 0; r < g.rods; r++) {
      const rod = new THREE.Mesh(rg, M.rod); rod.position.set(g.rodX(r) - cx, 0, (g.top + g.bottom) / 2 - cy); rod.castShadow = true; grp.add(rod);
      if (r % 3 === 0) { const dot = new THREE.Mesh(new THREE.CircleGeometry(slot * 0.1, 18), M.dot); dot.rotation.x = -Math.PI / 2; dot.position.set(g.rodX(r) - cx, depth / 2 - bev + 0.4, bz); grp.add(dot); }
    }
    bead = beadGeo(g.bw, g.bh, rr_ * 1.25);
    beads = new THREE.InstancedMesh(bead, M.bead, CAP); beads.castShadow = true; beads.receiveShadow = true; beads.frustumCulled = false; beads.count = 0;
    beads.setColorAt(0, new THREE.Color(1, 1, 1)); grp.add(beads);
    tilt.add(grp); built = grp; buildKey = `${T.name}|${g.rods}|${Math.round(g.slot * 10)}|${Math.round(W)}|${Math.round(H)}`;
    built.userData = { cx, cy };
  }
  function applyTier() {
    const t = TIERS[tier];
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, t.dpr));
    renderer.shadowMap.enabled = t.shadow > 0; key.castShadow = t.shadow > 0;
    if (t.shadow) { key.shadow.mapSize.set(t.shadow, t.shadow); if (key.shadow.map) { key.shadow.map.dispose(); key.shadow.map = null; } }
    scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { m.needsUpdate = true; }); });
  }
  applyTier();

  const _m = new THREE.Matrix4(), _c = new THREE.Color(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(1, 1, 1);
  const cssW = () => Math.max(1, window.innerWidth), cssH = () => Math.max(1, window.innerHeight);
  let game = null, lost = false, lastNow = 0, clock = 0, frameAvg = 16, slowFrames = 0, shown = false, hideT = 0;
  function post() {
    if (!game || lost) return;
    const f = v3.frame, now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1); lastNow = now; clock += dt;
    if (!f) { if (shown && ++hideT > 3) { canvas.style.visibility = 'hidden'; canvas.style.opacity = '0'; shown = false; } return; }
    hideT = 0;
    const { g, A, T } = f, calm = game.getState().prefs?.calm;
    const k = `${T.name}|${g.rods}|${Math.round(g.slot * 10)}|${Math.round(g.w)}|${Math.round(g.h)}`;
    if (k !== buildKey) build(g, T);
    // camera: the rod plane maps 1 virtual unit -> cssPerUnit css px
    const cpu = meta.cssPerUnit || Math.min(cssW(), cssH()) / 720, W = cssW(), H = cssH();
    const D = (H / (2 * cpu)) / Math.tan(FOV * Math.PI / 360);
    camera.fov = FOV; camera.aspect = W / H; camera.position.set(0, D, 0); camera.up.set(0, 0, -1); camera.lookAt(0, 0, 0); camera.updateProjectionMatrix(); camera.updateMatrixWorld(true);
    const cx = built.userData.cx, cy = built.userData.cy;
    root.position.set(cx - meta.width / 2 + (v3.dx || 0), 0, cy - meta.height / 2);
    const tl = f.tilt ? (calm ? -0.2 : -0.2 + 0.04 * Math.sin(clock * 0.5)) : 0;
    tilt.scale.setScalar(f.tilt ? 0.93 : 1); tilt.rotation.set(tl, f.tilt && !calm ? 0.06 * Math.sin(clock * 0.37) : 0, 0);
    // beads
    let n = 0;
    const put = (r, y, glow) => { _p.set(g.rodX(r) - cx, 0, y - cy); _m.compose(_p, _q, _s); beads.setMatrixAt(n, _m); const v = 1 + glow * 0.9; beads.setColorAt(n, _c.setRGB(v, v, v)); n++; };
    for (let r = 0; r < g.rods; r++) {
      const gl = A.glow?.[r] ?? 0;
      put(r, g.heavenY(A.hp[r]), gl);
      for (let i = 0; i < 4; i++) put(r, g.earthY(i, A.ep[r][i]), gl);
    }
    beads.count = n; beads.instanceMatrix.needsUpdate = true; if (beads.instanceColor) beads.instanceColor.needsUpdate = true;
    // bead colour comes from the look's bead colour through the material colour (instance colour only brightens)
    mats.bead.color.set(T.bead);
    // light + shadow framing
    const span = Math.max(g.w, g.h) * 1.1;
    key.position.set(-span * 0.5, span * 3.2, -span * 0.55).add(root.position); key.target.position.copy(root.position); key.target.updateMatrixWorld();
    Object.assign(key.shadow.camera, { left: -span, right: span, top: span, bottom: -span, near: span, far: span * 7 }); key.shadow.camera.updateProjectionMatrix();
    desk.position.y = -g.bw * 0.62;
    renderer.setSize(W, H, false);
    renderer.render(scene, camera);
    if (!shown) { shown = true; canvas.style.visibility = 'visible'; requestAnimationFrame(() => { canvas.style.opacity = '1'; }); }
    const ft = dt * 1000; if (ft > 0) frameAvg = frameAvg * 0.95 + ft * 0.05;
    if (frameAvg > 26 && tier < 2) { if (++slowFrames > 90) { tier++; slowFrames = 0; frameAvg = 16; applyTier(); } } else slowFrames = 0;
  }

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; v3.on = false; canvas.style.visibility = 'hidden'; canvas.style.opacity = '0'; shown = false; });
  canvas.addEventListener('webglcontextrestored', () => {
    lost = false; buildEnv(); mats.k = null; buildKey = ''; applyTier(); v3.on = true;
  });
  await tick();
  return {
    ok: true, renderer, scene, camera,
    attach(g) { game = g; v3.on = true; },
    post,
    get tier() { return TIERS[tier].name; },
  };
}

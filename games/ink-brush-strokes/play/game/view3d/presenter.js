// Ink Brush 3D presenter. READS what the screens ask for (v3.want, the sheet canvas) and never touches the game state. One WebGL canvas sits behind
// the kit's transparent 2D canvas: a scholar's desk by a paper window (daylight, a lattice shadow across the walnut), an indigo felt mat, the sheet of
// xuan paper lying on it, bronze paperweights, an ink stone, a water dropper, a seal box and the brush. The sheet's texture is what the 2D screens draw
// (paper, guide, ink as it is laid down, the seal); the camera is tilted and v3.map.to() maps a pointer position through it onto the sheet, so the
// 2D game logic still sees the flat-layout coordinates it always did. No WebGL, ?flat=1 or a lost context: v3.on = false and the flat art draws.
import * as THREE from '../vendor3d/three.js';
import { v3 } from '../src/v3.js';
import { meta } from '../src/game.js';
import { PW, PH, FELT_Y, PAPER_Y, FELT_W, FELT_D, LOOKS, deskMesh, feltMesh, paperMesh, inkStone, dropper, sealBox, weight, restBlocks, brush, lattice, softDot, blobShadow, clearCaches } from './world.js';

const TAU = Math.PI * 2, D2R = Math.PI / 180;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TIERS = [{ name: 'high', dpr: 2, shadow: 2048, tex: 1280 }, { name: 'medium', dpr: 1.5, shadow: 1024, tex: 1024 }, { name: 'low', dpr: 1, shadow: 0, tex: 640 }];
const tick = () => new Promise((r) => setTimeout(r, 0));

export async function createPresenter({ kitCanvas }) {
  const qs = new URLSearchParams(location.search), noop = { ok: false };
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;height:100dvh;display:block;pointer-events:none;z-index:0;visibility:hidden';
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' }); } catch (e) { console.warn('WebGL unavailable; flat 2D art', e); return noop; }
  if (!renderer.getContext()) return noop;
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = LOOKS.day.exp;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  let tier = qs.has('tier') ? clamp(Number(qs.get('tier')), 0, 2) : (navigator.hardwareConcurrency || 8) <= 4 ? 1 : 0;
  await tick();

  // ---------------------------------------------------------------- scene and light: daylight through a paper window
  const L = LOOKS.day, scene = new THREE.Scene();
  scene.background = new THREE.Color(L.bg); scene.fog = new THREE.Fog(L.bg, 330, 760);
  const camera = new THREE.PerspectiveCamera(28, 1, 5, 1200);
  const sun = new THREE.DirectionalLight(L.sun, L.sunI), SUN_DIR = new THREE.Vector3(-0.62, 0.6, -0.5).normalize();
  sun.position.copy(SUN_DIR).multiplyScalar(130); sun.target.position.set(0, 0, 4);
  sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.05; sun.shadow.radius = 4;
  Object.assign(sun.shadow.camera, { left: -44, right: 44, top: 44, bottom: -44, near: 40, far: 260 });
  const hemi = new THREE.HemisphereLight(L.sky, L.ground, L.hemiI);
  const fill = new THREE.DirectionalLight(0xbcd0ff, 0.28); fill.position.set(60, 40, 90);
  scene.add(sun, sun.target, hemi, fill);
  const win = lattice(); win.position.copy(SUN_DIR).multiplyScalar(78).add(sun.target.position); win.lookAt(sun.target.position); scene.add(win);
  const buildEnv = () => { try { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; pm.dispose(); scene.environmentIntensity = 0.45; } catch { /* no IBL */ } };
  buildEnv();
  await tick();

  // ---------------------------------------------------------------- the desk
  const world = new THREE.Group(); scene.add(world);
  world.add(deskMesh(), feltMesh());
  const paper = paperMesh(); world.add(paper);
  const sheetTex = { t: null, canvas: null, ver: -1 };
  function setSheet(sh) {
    if (!sh) return;
    if (sheetTex.t && sheetTex.canvas === sh.canvas) { if (sheetTex.ver !== sh.ver) { sheetTex.t.needsUpdate = true; sheetTex.ver = sh.ver; } return; }
    const old = sheetTex.t, t = new THREE.CanvasTexture(sh.canvas); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.minFilter = THREE.LinearFilter; t.generateMipmaps = false;
    sheetTex.t = t; sheetTex.canvas = sh.canvas; sheetTex.ver = sh.ver; const m = paper.userData.mat; m.map = t; m.emissiveMap = t; m.needsUpdate = true; if (old) old.dispose();
  }
  const stone = inkStone(), drop = dropper(), seal = sealBox(), rest = restBlocks(), wts = [weight(), weight()], brushG = brush();
  stone.position.set(-3, FELT_Y - 0.1, -PH / 2 - 8); stone.rotation.y = 0.12;
  drop.position.set(12, FELT_Y - 0.1, -PH / 2 - 5.5); drop.rotation.y = 0.9;
  seal.position.set(-14, FELT_Y - 0.1, PH / 2 + 6.2);
  rest.position.set(PW / 2 + 6.6, FELT_Y - 0.1, 8); rest.rotation.y = 0.04;
  wts[0].position.set(0, PAPER_Y, -PH / 2 + 3.4); wts[1].position.set(0, PAPER_Y, PH / 2 - 3.4);
  stone.scale.setScalar(0.85); drop.scale.setScalar(0.85); seal.scale.setScalar(0.78);
  world.add(stone, drop, seal, rest, ...wts);
  // the brush: the tip follows what the screens ask for; at rest it lies on the brush rest beside the sheet
  scene.add(brushG);
  const REST_TIP = new THREE.Vector3(PW / 2 + 6.6, FELT_Y + 1.7, 11), REST_DIR = new THREE.Vector3(0.03, 0.1, -1).normalize();
  const bp = { tip: REST_TIP.clone(), dir: REST_DIR.clone(), lift: 0, sq: 0 }, tipGoal = new THREE.Vector3(), dirGoal = new THREE.Vector3();
  const shadowBlob = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: blobShadow(), transparent: true, depthWrite: false, opacity: 0.8, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
  shadowBlob.rotation.x = -Math.PI / 2; shadowBlob.renderOrder = 3; scene.add(shadowBlob);
  // dust in the window light
  const DN = 110, dpos = new Float32Array(DN * 3), dseed = Array.from({ length: DN }, (_, i) => (i * 7.31) % 100);
  const dgeo = new THREE.BufferGeometry(); dgeo.setAttribute('position', new THREE.BufferAttribute(dpos, 3));
  const dust = new THREE.Points(dgeo, new THREE.PointsMaterial({ map: softDot('255,246,226'), size: 0.55, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xfff0d6 }));
  dust.frustumCulled = false; scene.add(dust);
  function updateDust(t) {
    for (let i = 0; i < DN; i++) { const sd = dseed[i], u = ((t * 0.01 + sd * 0.137) % 1); dpos[i * 3] = -45 + ((sd * 37.1) % 90) + Math.sin(t * 0.3 + sd) * 3; dpos[i * 3 + 1] = 3 + u * 48; dpos[i * 3 + 2] = -40 + ((sd * 53.7) % 80) + Math.cos(t * 0.23 + sd * 2) * 3; }
    dgeo.attributes.position.needsUpdate = true;
  }

  let vk = '';
  function applyTier() {
    const t = TIERS[tier];
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, t.dpr));
    renderer.shadowMap.enabled = t.shadow > 0; sun.castShadow = t.shadow > 0; win.visible = t.shadow > 0;
    if (t.shadow) { sun.shadow.mapSize.set(t.shadow, t.shadow); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
    scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { m.needsUpdate = true; }); });
    v3.texCap = t.tex; v3.dpr = Math.min(window.devicePixelRatio || 1, t.dpr); vk = '';
  }
  applyTier();
  await tick();

  // ---------------------------------------------------------------- camera: yaw/tilt/fov per screen; distance + off-axis shift fitted to a screen rectangle
  const cur = { yaw: 0, tilt: 60, fov: 28, dist: 100, ox: 0, oy: 0, tx: 0, ty: PAPER_Y, tz: 0 };
  let snapNext = true, lastKind = '';
  const _v = new THREE.Vector3(), _t = new THREE.Vector3(), cssW = () => Math.max(1, window.innerWidth), cssH = () => Math.max(1, window.innerHeight);
  function place(cam, p) {
    const W = cssW(), H = cssH(), dir = _v.set(Math.sin(p.yaw * D2R) * Math.cos(p.tilt * D2R), Math.sin(p.tilt * D2R), Math.cos(p.yaw * D2R) * Math.cos(p.tilt * D2R));
    cam.fov = p.fov; cam.aspect = W / H; _t.set(p.tx, p.ty, p.tz);
    cam.position.copy(_t).addScaledVector(dir, p.dist); cam.up.set(0, 1, 0); cam.lookAt(_t);
    if (p.ox || p.oy) cam.setViewOffset(W, H, p.ox, p.oy, W, H); else cam.clearViewOffset();
    cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
  }
  const fitCam = new THREE.PerspectiveCamera();
  const toCss = (cam, x, y, z, out) => { _v.set(x, y, z).project(cam); out.x = (_v.x + 1) / 2 * cssW(); out.y = (1 - _v.y) / 2 * cssH(); return out; };
  function fit(rc, pts, base) {
    const p = { ...base, ox: 0, oy: 0, dist: 150 }, q = { x: 0, y: 0 }; let bb = null;
    for (let it = 0; it < 10; it++) {
      place(fitCam, p); bb = { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 };
      for (const [x, y, z] of pts) { toCss(fitCam, x, y, z, q); bb.x0 = Math.min(bb.x0, q.x); bb.x1 = Math.max(bb.x1, q.x); bb.y0 = Math.min(bb.y0, q.y); bb.y1 = Math.max(bb.y1, q.y); }
      const s = Math.min(rc.w / Math.max(1, bb.x1 - bb.x0), rc.h / Math.max(1, bb.y1 - bb.y0));
      if (Math.abs(s - 1) < 0.0003) break;
      p.dist /= s;
    }
    p.ox = (bb.x0 + bb.x1) / 2 - (rc.x + rc.w / 2); p.oy = (bb.y0 + bb.y1) / 2 - (rc.y + rc.h / 2);
    return p;
  }
  const cpu = () => meta.cssPerUnit || Math.min(cssW() / meta.width, cssH() / meta.height);
  const offX = () => (cssW() - meta.width * cpu()) / 2, offY = () => (cssH() - meta.height * cpu()) / 2;
  const rectCss = (r, s = 1) => { const w = r.w * cpu() * s, h = r.h * cpu() * s; return { x: r.x * cpu() + offX() + (r.w * cpu() - w) / 2, y: r.y * cpu() + offY() + (r.h * cpu() - h) / 2, w, h }; };

  // sheet <-> screen. u, v in 0..1 over the sheet (v from the top edge)
  const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -PAPER_Y), hit = new THREE.Vector3(), ndc = new THREE.Vector2();
  v3.map.to = (vx, vy) => {
    const r = v3.want && v3.want.rect; if (!r) return { x: vx, y: vy, inside: false };
    ndc.set(((vx * cpu() + offX()) / cssW()) * 2 - 1, -(((vy * cpu() + offY()) / cssH()) * 2 - 1)); ray.setFromCamera(ndc, camera);
    if (!ray.ray.intersectPlane(plane, hit)) return { x: vx, y: vy, inside: false };
    const u = hit.x / PW + 0.5, v = hit.z / PH + 0.5;
    return { x: r.x + u * r.w, y: r.y + v * r.h, inside: u >= -0.01 && u <= 1.01 && v >= -0.01 && v <= 1.01 };
  };

  // ---------------------------------------------------------------- per frame
  let lost = false, lastNow = 0, clock = 0, frameAvg = 16, slowFrames = 0, fadeIn = 0, attached = false, wasBare = false;
  const sheetPoint = (r, x, y, out) => out.set(((x - r.x) / r.w - 0.5) * PW, PAPER_Y, ((y - r.y) / r.h - 0.5) * PH);
  function post() {
    if (!attached || lost) return;
    const now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1); lastNow = now; clock += dt;
    const want = v3.want;
    if (!want) { canvas.style.visibility = 'hidden'; wasBare = true; return; }       // flat backdrop screens: nothing to render
    if (wasBare || want.kind !== lastKind) { snapNext = true; wasBare = false; lastKind = want.kind; }
    if (v3.sheet) setSheet(v3.sheet);
    canvas.style.visibility = 'visible';
    const hero = want.kind === 'hero', bare = want.kind === 'bare';
    paper.visible = !bare; shadowBlob.visible = !bare;
    const paperPts = [[-PW / 2, PAPER_Y, -PH / 2], [PW / 2, PAPER_Y, -PH / 2], [-PW / 2, PAPER_Y, PH / 2], [PW / 2, PAPER_Y, PH / 2]];
    const goal = bare
      ? fit(rectCss(want.rect, 1.32), [[-FELT_W / 2, FELT_Y, -FELT_D / 2], [FELT_W / 2, FELT_Y, -FELT_D / 2], [-FELT_W / 2, FELT_Y, FELT_D / 2], [FELT_W / 2, FELT_Y, FELT_D / 2]], { yaw: 3 * Math.sin(clock * TAU / 50), tilt: 66, fov: 28, tx: 0, ty: FELT_Y, tz: 0 })
      : hero
      ? fit(rectCss(want.rect, 0.9), paperPts, { yaw: -5 + 4 * Math.sin(clock * TAU / 36), tilt: 54 + 3 * Math.sin(clock * TAU / 23), fov: 28, tx: 0, ty: PAPER_Y, tz: 0 })
      : fit(rectCss(want.rect, 0.97), paperPts, { yaw: 0, tilt: 60, fov: 28, tx: 0, ty: PAPER_Y, tz: 0 });
    const a = snapNext || !(hero || bare) ? 1 : 1 - Math.exp(-dt * 4);
    for (const k of Object.keys(goal)) cur[k] += (goal[k] - cur[k]) * a;
    snapNext = false;
    place(camera, cur);

    // paperweights lie on the margins of a lesson sheet (not on the free scroll, where ink can go anywhere)
    wts[0].visible = wts[1].visible = !want.free && !bare;
    // the brush
    const b = want.brush;
    if (b) {
      sheetPoint(want.rect, b.x, b.y, tipGoal); dirGoal.set(0.32, 1, -0.42).normalize();
      bp.lift += ((b.down ? 0 : 1.8) - bp.lift) * (1 - Math.exp(-dt * 14)); tipGoal.y += 0.25 + bp.lift;
      bp.sq += ((b.down ? 1 : 0) - bp.sq) * (1 - Math.exp(-dt * 16));
    } else { tipGoal.copy(REST_TIP); dirGoal.copy(REST_DIR); bp.lift = 0; bp.sq += (0 - bp.sq) * (1 - Math.exp(-dt * 8)); }
    const dist = bp.tip.distanceTo(tipGoal);
    bp.tip.lerp(tipGoal, 1 - Math.exp(-dt * (b ? 22 : 6))); bp.dir.lerp(dirGoal, 1 - Math.exp(-dt * (b ? 10 : 6))).normalize();
    brushG.position.copy(bp.tip); brushG.position.y += b ? Math.min(3.5, dist * 0.12) : 0;      // arcs up a little while travelling
    brushG.quaternion.setFromUnitVectors(_v.set(0, 1, 0), bp.dir);
    brushG.userData.hair.scale.set(1 + 0.22 * bp.sq, 1 - 0.14 * bp.sq, 1 + 0.22 * bp.sq);
    const tone = b ? clamp(b.tone, 0, 1) : 0.9, g = Math.round(14 + (1 - tone) * 70), wet = b ? clamp(b.load, 0, 1) : 0.4;
    brushG.userData.hairMat.color.setRGB((g + 4) / 255, (g + 6) / 255, (g + 10) / 255); brushG.userData.hairMat.clearcoat = 0.25 + 0.6 * wet;
    // soft contact shadow on the sheet / felt under the tip
    const h = Math.max(0, brushG.position.y - PAPER_Y);
    shadowBlob.position.set(brushG.position.x + 0.5 + h * 0.3, (b ? PAPER_Y : FELT_Y) + 0.05, brushG.position.z + 0.6 + h * 0.25);
    const sc = 3 + h * 0.7; shadowBlob.scale.set(sc * 1.4, sc, 1); shadowBlob.material.opacity = b ? clamp(0.8 - h * 0.12, 0.15, 0.8) : 0.45;
    dust.visible = hero || bare; if (dust.visible) updateDust(clock);
    sun.intensity = L.sunI * (1 + 0.2 * (want.fin || 0));

    const k = `${cssW()}x${cssH()}`; if (k !== vk) { vk = k; renderer.setSize(cssW(), cssH(), false); }
    if (fadeIn < 1) { fadeIn = Math.min(1, fadeIn + dt / 0.45); v3.fade = fadeIn; }
    renderer.render(scene, camera);
    const ft = dt * 1000; if (ft > 0) frameAvg = frameAvg * 0.95 + ft * 0.05;
    if (frameAvg > 26 && tier < 2) { if (++slowFrames > 90) { tier++; slowFrames = 0; frameAvg = 16; applyTier(); } } else slowFrames = 0;
  }

  // ---------------------------------------------------------------- context loss: the flat art takes over, then back to 3D
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; v3.on = false; v3.map.active = false; canvas.style.visibility = 'hidden'; });
  canvas.addEventListener('webglcontextrestored', () => {
    lost = false; buildEnv(); clearCaches(); applyTier(); sheetTex.ver = -1;
    scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { if (m.map) m.map.needsUpdate = true; }); });
    fadeIn = 0; v3.fade = 0; v3.on = true; snapNext = true;
  });

  place(camera, cur); try { renderer.compile(scene, camera); } catch { /* compiled lazily */ }
  await tick();

  return {
    ok: true, renderer, scene, camera, sun,
    attach() { attached = true; v3.on = true; v3.fade = 0; fadeIn = 0; snapNext = true; },
    post,
    get tier() { return TIERS[tier].name; },
    loseContext() { const ext = renderer.getContext().getExtension('WEBGL_lose_context'); ext?.loseContext(); return ext; },
  };
}

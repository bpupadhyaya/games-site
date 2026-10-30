// Gabata 3D presenter. It does not touch the game: the 2D layer (view.js) describes each frame's board in v3.scene / v3.marks, this file draws
// it lit and answers the projection questions (v3.at, v3.pick, v3.toBoard). One WebGL canvas sits behind the kit's transparent 2D canvas:
// a carved three-row board on a coiled grass mat in a stone-walled highland courtyard (clay coffee pot, little cups, cool morning light).
// The camera is fitted to the rectangle the layout gives the board, so the 2D plates, counts, arrows and taps line up with the tilted board.
// No WebGL or a lost context: v3.on = false and every screen draws the flat 2D art; a restored context rebuilds the environment.
import * as THREE from '../vendor3d/three.js';
import { v3 } from '../src/v3.js';
import { meta } from '../src/game.js';
import { CELLS, HOLE_R } from '../src/art.js';
import { S as SC, HX, HZ, TOP, RIM, SEED_R, BOARD_Y, PITS, toWorld, toBoard, seedSlot, seedKit, buildBoard, buildCourtyard, buildLights, radialTex } from './world.js';

const TAU = Math.PI * 2, D2R = Math.PI / 180, CAP = 150, R0 = BOARD_Y + RIM;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TIERS = [{ name: 'high', dpr: 2, shadow: 2048, tex: 2048 }, { name: 'medium', dpr: 1.5, shadow: 1024, tex: 1536 }, { name: 'low', dpr: 1, shadow: 0, tex: 1024 }];
const tick = () => new Promise((r) => setTimeout(r, 0));

export async function createPresenter({ kitCanvas }) {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;height:100dvh;display:block;pointer-events:none;z-index:0;visibility:hidden';
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' }); } catch (e) { console.warn('WebGL unavailable; flat 2D art', e); return { ok: false }; }
  if (!renderer.getContext()) return { ok: false };
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.85;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  let tier = (navigator.hardwareConcurrency || 8) <= 4 ? 1 : 0;

  await tick();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x151a22);
  scene.fog = new THREE.Fog(0x8d9bb0, 190, 620);
  const camera = new THREE.PerspectiveCamera(30, 1, 2, 3000);
  const lights = buildLights(scene);
  const buildEnv = () => { try { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; pm.dispose(); scene.environmentIntensity = 0.5; } catch { /* no IBL */ } };
  buildEnv();
  await tick();
  const yard = buildCourtyard(scene, { quality: tier < 2 ? 1 : 0 });
  await tick();

  // ---- boards (cached per theme and texture size) and the seeds (one instanced mesh, per-seed tint)
  const boards = new Map(); let board = null, boardKey = '', themeNow = 'acacia';
  function setBoard(theme) {
    const k = `${theme}|${TIERS[tier].tex}`; if (k === boardKey) return;
    let b = boards.get(k); if (!b) { b = buildBoard(theme, TIERS[tier].tex); boards.set(k, b); }
    if (board) scene.remove(board); board = b; boardKey = k; scene.add(b); themeNow = theme;
  }
  const kit = seedKit('acacia'), kits = {};
  const seeds = new THREE.InstancedMesh(kit.geo, kit.mat, CAP); seeds.castShadow = true; seeds.receiveShadow = true; seeds.count = 0; seeds.frustumCulled = false; seeds.setColorAt(0, new THREE.Color(1, 1, 1)); scene.add(seeds);
  const tintOf = (theme, v) => (kits[theme] || (kits[theme] = seedKit(theme))).tint(v);
  const flatQuad = new THREE.PlaneGeometry(1, 1); flatQuad.rotateX(-Math.PI / 2);
  const blobs = new THREE.InstancedMesh(flatQuad, new THREE.MeshBasicMaterial({ map: radialTex('0,0,0', 0.9), transparent: true, depthWrite: false, opacity: 0.5 }), 48);
  blobs.renderOrder = 1; blobs.frustumCulled = false; blobs.count = 0; scene.add(blobs);

  // ---- rings and glows (legal holes, hints, captures) as light lying on the board
  const ringTex = () => {
    const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
    const g = x.createRadialGradient(64, 64, 20, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,0.14)'); g.addColorStop(0.55, 'rgba(255,255,255,0.3)'); g.addColorStop(0.7, 'rgba(255,255,255,1)'); g.addColorStop(0.84, 'rgba(255,255,255,0.9)'); g.addColorStop(0.94, 'rgba(255,255,255,0.3)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  };
  const ringT = ringTex(), glowT = radialTex('255,255,255', 0.9);
  const marks = Array.from({ length: 56 }, () => { const m = new THREE.Mesh(flatQuad, new THREE.MeshBasicMaterial({ map: ringT, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); m.renderOrder = 3; m.visible = false; scene.add(m); return m; });
  const parseCol = (s) => {
    let m = /^#([0-9a-f]{6})$/i.exec(s); if (m) { const n = parseInt(m[1], 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255, 1]; }
    m = /rgba?\(([^)]+)\)/.exec(s); if (m) { const p = m[1].split(',').map(Number); return [p[0] / 255, p[1] / 255, p[2] / 255, p.length > 3 ? p[3] : 1]; }
    return [1, 0.85, 0.5, 1];
  };
  function applyTier() {
    const t = TIERS[tier];
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, t.dpr));
    renderer.shadowMap.enabled = t.shadow > 0; lights.sun.castShadow = t.shadow > 0;
    if (t.shadow) { lights.sun.shadow.mapSize.set(t.shadow, t.shadow); if (lights.sun.shadow.map) { lights.sun.shadow.map.dispose(); lights.sun.shadow.map = null; } }
    blobs.material.opacity = t.shadow ? 0.4 : 0.6;
    scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { m.needsUpdate = true; }); });
  }
  applyTier();

  // ---------------------------------------------------------------- camera: tilt / fov per view, distance + off-axis shift fitted to the board rectangle
  const cur = { yaw: 0, tilt: 58, fov: 28, dist: 100, ox: 0, oy: 0, tx: 0, ty: TOP * 0.5, tz: 0 };
  const _v = new THREE.Vector3(), _t = new THREE.Vector3(), cssW = () => Math.max(1, window.innerWidth), cssH = () => Math.max(1, window.innerHeight);
  function place(cam, p) {
    const W = cssW(), H = cssH(), dir = _v.set(Math.sin(p.yaw * D2R) * Math.cos(p.tilt * D2R), Math.sin(p.tilt * D2R), Math.cos(p.yaw * D2R) * Math.cos(p.tilt * D2R));
    cam.fov = p.fov; cam.aspect = W / H; _t.set(p.tx, p.ty, p.tz);
    cam.position.copy(_t).addScaledVector(dir, p.dist); cam.up.set(0, 1, 0); cam.lookAt(_t);
    if (p.ox || p.oy) cam.setViewOffset(W, H, p.ox, p.oy, W, H); else cam.clearViewOffset();
    cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
  }
  const fitCam = new THREE.PerspectiveCamera();
  const toCss = (cam, x, y, z, out = { x: 0, y: 0 }) => { _v.set(x, y, z).project(cam); out.x = (_v.x + 1) / 2 * cssW(); out.y = (1 - _v.y) / 2 * cssH(); return out; };
  function fit(rc, pts, base) {
    const p = { ...base, ox: 0, oy: 0, dist: 100 }, q = { x: 0, y: 0 }; let bb = null;
    for (let it = 0; it < 8; it++) {
      place(fitCam, p); bb = { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 };
      for (const [x, y, z] of pts) { toCss(fitCam, x, y, z, q); bb.x0 = Math.min(bb.x0, q.x); bb.x1 = Math.max(bb.x1, q.x); bb.y0 = Math.min(bb.y0, q.y); bb.y1 = Math.max(bb.y1, q.y); }
      const s = Math.min(rc.w / Math.max(1, bb.x1 - bb.x0), rc.h / Math.max(1, bb.y1 - bb.y0));
      if (Math.abs(s - 1) < 0.002) break; p.dist /= s;
    }
    p.ox = (bb.x0 + bb.x1) / 2 - (rc.x + rc.w / 2); p.oy = (bb.y0 + bb.y1) / 2 - (rc.y + rc.h / 2);
    return p;
  }
  const cpu = () => meta.cssPerUnit || (Math.min(cssW(), cssH()) / 720);
  const offX = () => (cssW() - meta.width * cpu()) / 2, offY = () => (cssH() - meta.height * cpu()) / 2;
  const virt = (q) => ({ x: (q.x - offX()) / cpu(), y: (q.y - offY()) / cpu() });
  const padPts = (pad) => { const x = HX + pad, z = HZ + pad; return [[-x, 0, -z], [x, 0, -z], [-x, TOP, -z], [x, TOP, -z], [-x, 0, z], [x, 0, z], [-x, TOP, z], [x, TOP, z]]; };
  v3.frame = (geo, kind, t, up) => {
    const rc = { x: geo.x * cpu() + offX(), y: geo.y * cpu() + offY(), w: geo.w * cpu(), h: geo.h * cpu() };
    let goal;
    if (kind === 'play' && up) {
      // the board stood up the screen (quarter turn, human side on the right): the steepest pitch that still gives the biggest board
      const cands = []; for (let tl = 44; tl <= 72; tl += 4) cands.push(fit(rc, padPts(2.2), { yaw: -90, tilt: tl, fov: 26, tx: 0, ty: TOP * 0.5, tz: 0 }));
      const near = Math.min(...cands.map((c) => c.dist)); goal = cands.filter((c) => c.dist <= near * 1.03).pop();
    } else if (kind === 'play') {
      const asp = rc.w / rc.h, tilt = clamp(Math.asin(clamp((2 * HX) / (2 * HZ) / asp, 0.2, 1)) / D2R, 44, 55);
      goal = fit(rc, padPts(2.2), { yaw: 0, tilt, fov: 26, tx: 0, ty: TOP * 0.5, tz: 0 });
    } else {
      const a = t || 0;
      goal = fit(rc, padPts(0.8), { yaw: -7 + 5 * Math.sin(a * TAU / 36), tilt: 28 + 2.5 * Math.sin(a * TAU / 23), fov: 32, tx: 0, ty: TOP * 0.5, tz: 0 });
    }
    Object.assign(cur, goal); place(camera, cur);
  };

  // ---------------------------------------------------------------- projection for the 2D layer
  const pa = { x: 0, y: 0 }, pb = { x: 0, y: 0 };
  v3.at = (bx, by, lift = 0) => {
    const w = toWorld(bx, by), y = R0 + lift, p = virt(toCss(camera, w.x, y, w.z, { x: 0, y: 0 }));
    const w2 = toWorld(bx + 1, by);
    toCss(camera, w.x, y, w.z, pa); toCss(camera, w2.x, y, w2.z, pb);
    p.k = Math.hypot(pb.x - pa.x, pb.y - pa.y) / cpu(); return p;
  };
  const ray = new THREE.Raycaster(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -R0), hit = new THREE.Vector3(), ndc = new THREE.Vector2();
  v3.toBoard = (vx, vy) => {
    ndc.set(((vx * cpu() + offX()) / cssW()) * 2 - 1, 1 - ((vy * cpu() + offY()) / cssH()) * 2);
    ray.setFromCamera(ndc, camera);
    if (!ray.ray.intersectPlane(plane, hit)) return null;
    const b = toBoard(hit.x, hit.z); return [b.bx, b.by];
  };
  v3.pick = (vx, vy) => {
    const b = v3.toBoard(vx, vy); if (!b) return -1;
    let best = -1, bd = 1e9;
    for (let i = 0; i < 18; i++) { const c = CELLS[i], d = Math.hypot(b[0] - c.cx, b[1] - c.cy); if (d <= HOLE_R + 18 && d < bd) { bd = d; best = i; } }
    return best;
  };

  // ---------------------------------------------------------------- seeds
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
  let nSeed = 0, nBlob = 0, clock = 0;
  function seed(x, y, z, yaw, tx, tz, v, sc = 1, blob = 0) {
    if (nSeed >= CAP) return;
    _e.set(tx, yaw, tz, 'YXZ'); _q.setFromEuler(_e); _s.set(sc, sc, sc); _p.set(x, y, z);
    seeds.setMatrixAt(nSeed, _m.compose(_p, _q, _s)); seeds.setColorAt(nSeed, tintOf(themeNow, v)); nSeed++;
    if (blob > 0 && nBlob < 48) { const s = SEED_R * 3.4 * (1 + (y - R0) * 0.1) * blob; blobs.setMatrixAt(nBlob++, _m.compose(_p.set(x + 0.3, R0 + 0.03, z + 0.45), _q.identity(), _s.set(s, 1, s))); }
  }
  function drawScene(sc) {
    nSeed = 0; nBlob = 0;
    for (let i = 0; i < 18; i++) {
      const n = Math.min(sc.cells[i], 44); if (n <= 0) continue;
      const P = PITS[i];
      for (let k = 0; k < n; k++) { const s = seedSlot(i, k); seed(P.x + s.x, BOARD_Y + s.y, P.z + s.z, s.rot, s.tx, s.tz, s.v); }
    }
    for (const f of sc.flights) {
      const A = toWorld(f.ax, f.ay);
      if (f.kind === 'drop') {
        const P = PITS[f.cell], rs = seedSlot(f.cell, f.k), x1 = P.x + rs.x, z1 = P.z + rs.z, y1 = BOARD_Y + rs.y, y0 = R0 + 4.4, e = f.e;
        seed(A.x + (x1 - A.x) * e, y0 + (y1 - y0) * e + f.s * 1.8, A.z + (z1 - A.z) * e, f.seed * 0.7, 0.3 * Math.sin(f.seed), 0.2, f.seed, 1, 0.8);
      } else {
        const B = toWorld(f.bx, f.by), e = f.e;
        seed(A.x + (B.x - A.x) * e, R0 + 1.4 + e * 2 + f.s * 7, A.z + (B.z - A.z) * e, f.seed, 0.2, 0.1, f.seed, 1 - 0.3 * f.t, 0.9);
      }
    }
    if (sc.hand) {   // the seeds being sown travel as a hovering clump
      const H = toWorld(sc.hand.x, sc.hand.y), n = Math.min(sc.hand.n, 9);
      for (let k = 0; k < n; k++) { const a = k * 2.4 + (sc.still ? 0 : clock * 0.6), rd = 0.9 * Math.sqrt(k + 0.3); seed(H.x + Math.cos(a) * rd, R0 + 4.3 + (k % 3) * 0.55, H.z + Math.sin(a) * rd, a * 1.7, 0.3 * k, 0.2 * k, k, 1, k === 0 ? 2.4 : 0); }
    }
    seeds.count = nSeed; seeds.instanceMatrix.needsUpdate = true; if (seeds.instanceColor) seeds.instanceColor.needsUpdate = true;
    blobs.count = nBlob; blobs.instanceMatrix.needsUpdate = true;
  }
  const _c = new THREE.Color();
  function drawMarks(list) {
    let k = 0;
    for (const mk of list) {
      if (k >= marks.length) break;
      const P = PITS[mk.i], m = marks[k++], [r, g, b, al] = parseCol(mk.col);
      m.visible = true; m.position.set(P.x, R0 + 0.12, P.z);
      const rad = (HOLE_R * 0.9 + (mk.grow || 0) * 0.9) * SC, s = mk.fill ? rad * 2.3 : rad / 0.77;
      m.scale.set(s, 1, s); m.material.map = mk.fill ? glowT : ringT;
      m.material.color.copy(_c.setRGB(r * r * 1.25, g * g * 1.25, b * b * 1.25));
      m.material.opacity = clamp(mk.a * al * (mk.fill ? 0.9 : 1) * (mk.lw >= 5 ? 1 : 0.85), 0, 1);
    }
    for (; k < marks.length; k++) marks[k].visible = false;
  }

  // steam from the coffee pot
  const sp = yard.steam.geometry.attributes.position, sd = yard.steam.geometry.attributes.aSeed.array;
  const steamCol = new Float32Array(sd.length * 3); yard.steam.geometry.setAttribute('color', new THREE.BufferAttribute(steamCol, 3));
  yard.steam.material.vertexColors = true; yard.steam.material.blending = THREE.AdditiveBlending; yard.steam.material.opacity = 0.5;
  function steam(calm) {
    for (let i = 0; i < sd.length; i++) {
      const u = (clock * 0.07 + sd[i]) % 1, r = u * u, sway = Math.sin(clock * 0.9 + sd[i] * 20) * (1.2 + u * 4);
      sp.setXYZ(i, yard.spout.x + sway + u * 4 * (sd[i] - 0.5) + u * 6, yard.spout.y + u * 36, yard.spout.z + Math.cos(clock * 0.7 + sd[i] * 11) * (1 + u * 3));
      const a = calm ? 0.05 : Math.sin(Math.PI * Math.min(1, u * 1.1)) * 0.2 * (1 - r * 0.5); steamCol[i * 3] = steamCol[i * 3 + 1] = steamCol[i * 3 + 2] = a;
    }
    sp.needsUpdate = true; yard.steam.geometry.attributes.color.needsUpdate = true;
  }

  // ---------------------------------------------------------------- per frame
  const loseExt = renderer.getContext().getExtension('WEBGL_lose_context');   // kept: it cannot be fetched while the context is lost
  let lost = false, lastNow = 0, frameAvg = 16, slowFrames = 0, fadeIn = 0;
  function pre() {
    if (lost) return;
    v3.scene = null; v3.marks.length = 0;
  }
  function post() {
    if (lost) return;
    const now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1); lastNow = now;
    const sc = v3.scene;
    if (!sc) { canvas.style.visibility = 'hidden'; return; }
    canvas.style.visibility = 'visible';
    if (!sc.still) clock += dt;
    setBoard(sc.theme === 'clay' ? 'clay' : 'acacia');
    drawScene(sc);
    drawMarks(v3.marks);
    steam(sc.still);
    if (!sc.still) lights.sun.intensity = 2.1 + Math.sin(clock * 0.45) * 0.08;
    if (fadeIn < 1) { fadeIn = Math.min(1, fadeIn + dt / 0.4); v3.fade = fadeIn; }
    renderer.setSize(cssW(), cssH(), false);
    renderer.render(scene, camera);
    const ft = dt * 1000; if (ft > 0) frameAvg = frameAvg * 0.95 + ft * 0.05;
    if (frameAvg > 26 && tier < 2) { if (++slowFrames > 90) { tier++; slowFrames = 0; frameAvg = 16; setBoard(themeNow); applyTier(); } } else slowFrames = 0;
  }

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; v3.on = false; });
  canvas.addEventListener('webglcontextrestored', () => {
    lost = false; buildEnv(); applyTier();
    scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { for (const k of ['map', 'bumpMap']) if (m[k]) m[k].needsUpdate = true; }); });
    fadeIn = 0; v3.fade = 0; v3.on = true;
  });

  await tick();
  setBoard('acacia'); await tick();
  place(camera, cur); try { renderer.compile(scene, camera); } catch { /* compiled lazily */ }
  await tick();

  return {
    ok: true, renderer, scene, camera,
    attach() { v3.on = true; v3.fade = 0; fadeIn = 0; },
    pre, post,
    get tier() { return TIERS[tier].name; },
    loseContext() { loseExt?.loseContext(); return Boolean(loseExt); },
    restoreContext() { loseExt?.restoreContext(); return Boolean(loseExt); },
  };
}

// Domino 3D presenter. READS the game state (game.getState()) and what the 2D layer asked for this frame (src/v3.js), never writes game
// state. One WebGL canvas sits behind the kit's transparent 2D canvas: bone dominoes lying on a painted terracotta park table at dusk.
// The 2D layout plane is laid on the table (layout x -> world X, layout y -> world Z, stretched by K so a tilted camera shows it
// without squashing), the camera is fitted so the play zone fills its screen rectangle, and v3.proj / v3.unproj carry points between
// layout and screen so the 2D hit tests keep working. No WebGL or a lost context: v3.on = false and every screen draws the flat 2D art.
import * as THREE from '../vendor3d/three.js';
import { v3 } from '../src/v3.js';
import { meta } from '../src/game.js';
import { layoutFor } from '../src/layout.js';
import { tileGeometry, tileMaterial, disposeTileMaterials, buildTable, buildLantern, buildGround, buildBokeh, buildLights, skyTexture, radialTex } from './world.js';

const D2R = Math.PI / 180;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return ((h >>> 0) % 10007) / 10007; };
const TIERS = [{ name: 'high', dpr: 2, shadow: 2048, tex: 1024 }, { name: 'medium', dpr: 1.5, shadow: 1024, tex: 1024 }, { name: 'low', dpr: 1, shadow: 0, tex: 512 }];
const tick = () => new Promise((r) => setTimeout(r, 0));
const S = 0.05;                     // cm per layout unit (a 55-unit rack tile is 2.75 cm wide)
const THICK = 0.42;                 // tile thickness / width
const TILT = { play: 48, env: 38 };

export async function createPresenter({ kitCanvas, dev = false }) {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;height:100dvh;display:block;pointer-events:none;z-index:0;visibility:hidden';
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' }); } catch (e) { console.warn('WebGL unavailable; flat 2D art', e); return { ok: false }; }
  if (!renderer.getContext()) return { ok: false };
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.92;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  let tier = (navigator.hardwareConcurrency || 8) <= 4 ? 1 : 0;

  await tick();
  const scene = new THREE.Scene();
  scene.background = skyTexture();
  scene.fog = new THREE.Fog(0x2a1620, 160, 520);
  const camera = new THREE.PerspectiveCamera(30, 1, 2, 3000);
  const lights = buildLights(scene);
  const buildEnv = () => { try { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; pm.dispose(); scene.environmentIntensity = 0.32; } catch { /* no IBL */ } };
  buildEnv();
  await tick();
  const bokeh = buildBokeh(); scene.add(buildGround()); scene.add(bokeh);
  const lanterns = [0, 1].map(() => { const l = buildLantern(); scene.add(l); return l; });
  let table = null, tableKey = '';
  await tick();

  // ---------------------------------------------------------------- tiles
  const geo = tileGeometry();
  const pool = new Map();            // key -> { mesh, glow, face, x, y, z, yaw, seen, first }
  const flat = new THREE.PlaneGeometry(1, 1); flat.rotateX(-Math.PI / 2);
  const glowTex = radialTex('255,214,120', 0.95), ringC = document.createElement('canvas'); ringC.width = ringC.height = 128;
  { const x = ringC.getContext('2d'), g = x.createRadialGradient(64, 64, 22, 64, 64, 64); g.addColorStop(0, 'rgba(143,230,210,0)'); g.addColorStop(0.62, 'rgba(143,230,210,0.12)'); g.addColorStop(0.78, 'rgba(160,240,222,1)'); g.addColorStop(0.9, 'rgba(143,230,210,0.5)'); g.addColorStop(1, 'rgba(143,230,210,0)'); x.fillStyle = g; x.fillRect(0, 0, 128, 128); }
  const ringTex = new THREE.CanvasTexture(ringC); ringTex.colorSpace = THREE.SRGBColorSpace;
  const markMeshes = Array.from({ length: 8 }, () => { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: ringTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); m.renderOrder = 2; m.visible = false; scene.add(m); return m; });
  const dustT = radialTex('230,205,170', 0.8);
  const dust = Array.from({ length: 8 }, () => { const m = new THREE.Mesh(flat, new THREE.MeshBasicMaterial({ map: dustT, transparent: true, depthWrite: false })); m.renderOrder = 2; m.visible = false; m.userData = { t: 9 }; scene.add(m); return m; });
  let dustI = 0;
  const puff = (x, z, s) => { const m = dust[dustI++ % dust.length]; m.userData = { t: 0, x, z, s }; };

  function applyTier() {
    const t = TIERS[tier];
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, t.dpr));
    renderer.shadowMap.enabled = t.shadow > 0; lights.sun.castShadow = t.shadow > 0;
    if (t.shadow) { lights.sun.shadow.mapSize.set(t.shadow, t.shadow); if (lights.sun.shadow.map) { lights.sun.shadow.map.dispose(); lights.sun.shadow.map = null; } }
    scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { if (m && m.isMaterial) m.needsUpdate = true; }); });
  }
  applyTier();

  // ---------------------------------------------------------------- the layout plane on the table, and the camera
  const cur = { yaw: 0, tilt: 54, fov: 28, dist: 100, ox: 0, oy: 0, tx: 0, ty: 0, tz: 0 };
  const zoneNow = { cx: 0, cy: 0, K: 1.4 };    // layout centre and depth stretch of the plane on the table
  let snap = true, viewKey = '';
  const _v = new THREE.Vector3(), _t = new THREE.Vector3();
  const cssW = () => Math.max(1, window.innerWidth), cssH = () => Math.max(1, window.innerHeight);
  const cpu = () => meta.cssPerUnit || (Math.min(cssW(), cssH()) / 720);
  const offX = () => (cssW() - meta.width * cpu()) / 2, offY = () => (cssH() - meta.height * cpu()) / 2;
  const rectCss = (r) => ({ x: r.x0 * cpu() + offX(), y: r.y0 * cpu() + offY(), w: (r.x1 - r.x0) * cpu(), h: (r.y1 - r.y0) * cpu() });

  function place(cam, p) {
    const W = cssW(), H = cssH();
    _v.set(Math.sin(p.yaw * D2R) * Math.cos(p.tilt * D2R), Math.sin(p.tilt * D2R), Math.cos(p.yaw * D2R) * Math.cos(p.tilt * D2R));
    cam.fov = p.fov; cam.aspect = W / H; _t.set(p.tx, p.ty, p.tz);
    cam.position.copy(_t).addScaledVector(_v, p.dist); cam.up.set(0, 1, 0); cam.lookAt(_t);
    if (p.ox || p.oy) cam.setViewOffset(W, H, p.ox, p.oy, W, H); else cam.clearViewOffset();
    cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
  }
  const fitCam = new THREE.PerspectiveCamera();
  const toCss = (cam, x, y, z, out) => { _v.set(x, y, z).project(cam); out.x = (_v.x + 1) / 2 * cssW(); out.y = (1 - _v.y) / 2 * cssH(); return out; };
  function fit(rc, pts, base) {
    const p = { ...base, ox: 0, oy: 0, dist: 90 }, q = { x: 0, y: 0 }; let bb = null;
    for (let it = 0; it < 8; it++) {
      place(fitCam, p); bb = { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 };
      for (const [x, y, z] of pts) { toCss(fitCam, x, y, z, q); bb.x0 = Math.min(bb.x0, q.x); bb.x1 = Math.max(bb.x1, q.x); bb.y0 = Math.min(bb.y0, q.y); bb.y1 = Math.max(bb.y1, q.y); }
      const s = Math.min(rc.w / Math.max(1, bb.x1 - bb.x0), rc.h / Math.max(1, bb.y1 - bb.y0));
      if (Math.abs(s - 1) < 0.002) break; p.dist /= s;
    }
    p.ox = (bb.x0 + bb.x1) / 2 - (rc.x + rc.w / 2); p.oy = (bb.y0 + bb.y1) / 2 - (rc.y + rc.h / 2);
    p.bw = bb.x1 - bb.x0; p.bh = bb.y1 - bb.y0;
    return p;
  }
  const fitCache = new Map();
  // Solve the depth stretch K so the tilted rectangle comes out with the aspect of its screen rectangle, then fit the camera.
  function planFor(zone, mode, base, fixedK = 0) {
    const key = `${mode}|${zone.x0},${zone.y0},${zone.x1},${zone.y1}|${cssW()}x${cssH()}|${cpu().toFixed(4)}`;
    let r = fitCache.get(key); if (r) return r;
    const rc = rectCss(zone), zw = (zone.x1 - zone.x0) * S, zh = (zone.y1 - zone.y0) * S;
    const make = (K) => { const hw = zw / 2, hd = zh * K / 2; return fit(rc, [[-hw, 0, -hd], [hw, 0, -hd], [-hw, 0, hd], [hw, 0, hd]], base); };
    let lo = 0.9, hi = 3.4, p = null;
    if (!fixedK) for (let i = 0; i < 12; i++) { const K = (lo + hi) / 2; p = make(K); if (p.bh / p.bw < rc.h / rc.w) lo = K; else hi = K; }
    const K = fixedK || (lo + hi) / 2; p = make(K);
    r = { p, K }; fitCache.set(key, r); if (fitCache.size > 24) fitCache.delete(fitCache.keys().next().value);
    return r;
  }
  const worldOf = (x, y) => [(x - zoneNow.cx) * S, (y - zoneNow.cy) * S * zoneNow.K];
  const virt = (q) => ({ x: (q.x - offX()) / cpu(), y: (q.y - offY()) / cpu() });
  const q0 = { x: 0, y: 0 };
  v3.proj = (x, y) => { const [X, Z] = worldOf(x, y), v = virt(toCss(camera, X, 0.3, Z, q0)); return [v.x, v.y]; };
  v3.unproj = (sx, sy) => {
    const cx = sx * cpu() + offX(), cy = sy * cpu() + offY();
    _v.set((cx / cssW()) * 2 - 1, 1 - (cy / cssH()) * 2, 0.5).unproject(camera);
    const o = camera.position, dx = _v.x - o.x, dy = _v.y - o.y, dz = _v.z - o.z;
    if (dy > -1e-6) return null;
    const k = -o.y / dy, X = o.x + dx * k, Z = o.z + dz * k;
    return [X / S + zoneNow.cx, Z / (S * zoneNow.K) + zoneNow.cy];
  };

  // Menus and documents: a rectangle drawn by the 2D layer at screen position (sx, sy) lies where it is drawn; its footprint on the table is
  // sized from the local scale of the view so it keeps the drawn size.
  const gv = { x: 0, y: 0 };
  function onScreen(t) {
    const u = v3.unproj(t.x + t.w / 2, t.y + t.h / 2);
    if (!u) return null;
    const X = (u[0] - zoneNow.cx) * S, Z = (u[1] - zoneNow.cy) * S * zoneNow.K;
    const at = (x, z) => { const v = virt(toCss(camera, x, 0, z, gv)); return [v.x, v.y]; };
    const a = at(X, Z), b = at(X + 1, Z), c = at(X, Z + 1);
    return [X, Z, t.w / Math.max(1e-3, Math.hypot(b[0] - a[0], b[1] - a[1])), t.h / Math.max(1e-3, Math.hypot(c[0] - a[0], c[1] - a[1]))];
  }

  function playZone(L) {
    const P = L.play, rr = P.rackRect(0, 10);
    const x0 = L.C.x0 - 6, x1 = (P.wide ? P.hint.x - 16 : L.C.x1) + 6;
    return { x0, x1, y0: P.seats[2].labelY - P.labelSize - 34, y1: rr.y + rr.h + 8 };
  }
  function framing(sceneId, L, t) {
    if (sceneId === 'playing' || sceneId === 'auto') {
      const z = playZone(L), r = planFor(z, 'play', { yaw: 0, tilt: TILT.play, fov: 32, tx: 0, ty: 0, tz: 0 });
      return { m: 'play', zone: z, K: r.K, p: r.p };
    }
    const z = { x0: L.U.x0, x1: L.U.x1, y0: L.U.y0, y1: L.U.y1 }, r = planFor(z, 'env', { yaw: 0, tilt: TILT.env, fov: 34, tx: 0, ty: 0, tz: 0 }, 1);
    return { m: 'env', zone: z, K: r.K, p: { ...r.p, yaw: 5 * Math.sin(t * Math.PI * 2 / 38) } };
  }

  // The table, lanterns and cup follow the zone (resize, rotation).
  function dress(zone, K) {
    const zw = (zone.x1 - zone.x0) * S, zh = (zone.y1 - zone.y0) * S * K;
    const tw = Math.max(zw + 30, 70), td = Math.max(zh + 40, 90), key = `${Math.round(tw)}x${Math.round(td)}|${TIERS[tier].tex}`;
    if (key !== tableKey) {
      if (table) { scene.remove(table); table.userData.dispose(); }
      table = buildTable(tw, td, TIERS[tier].tex); scene.add(table); tableKey = key;
    }
    const hw = zw / 2, hd = zh / 2;
    lanterns[0].position.set(-(hw + 8), 0, -(hd - 3)); lanterns[1].position.set(hw + 8, 0, -(hd - 3));
    const sc = lights.sun.shadow.camera, ext = Math.max(hw, hd) + 14;
    sc.left = -ext; sc.right = ext; sc.top = ext; sc.bottom = -ext; sc.updateProjectionMatrix();
    lights.sun.position.set(-hw * 0.9 - 30, 95, hd * 0.6 + 40); lights.sun.target.position.set(0, 0, 0);
  }

  // ---------------------------------------------------------------- per frame
  let game = null, lost = false, lastNow = 0, frameAvg = 16, slowFrames = 0, fadeIn = 0, mode = '', clock = 0;
  const seatPos = {};
  function pre() {
    if (!game || lost) return;
    const st = game.getState(), L = layoutFor(meta.width, meta.height);
    const vk = `${cssW()}x${cssH()}|${meta.width}x${meta.height}|${st.scene}`; if (vk !== viewKey) { viewKey = vk; snap = true; }
    const now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1);
    const goal = framing(st.scene, L, clock);
    if (goal.m !== mode) { mode = goal.m; snap = true; }
    const k = snap || goal.m === 'play' ? 1 : 1 - Math.exp(-dt * 4);
    for (const key of ['yaw', 'tilt', 'fov', 'dist', 'ox', 'oy', 'tx', 'ty', 'tz']) cur[key] += (goal.p[key] - cur[key]) * k;
    snap = false;
    zoneNow.cx = (goal.zone.x0 + goal.zone.x1) / 2; zoneNow.cy = (goal.zone.y0 + goal.zone.y1) / 2; zoneNow.K = goal.K;
    dress(goal.zone, goal.K);
    place(camera, cur);
    // dusk lights hang above the far edge in the menus; the play table fills the screen, so they fade out there
    for (const s of bokeh.children) {
      const u = s.userData; _v.set(u.nx, u.ny, 0.5).unproject(camera); const dx = _v.x - camera.position.x, dy = _v.y - camera.position.y, dz = _v.z - camera.position.z, l = Math.hypot(dx, dy, dz);
      s.position.set(camera.position.x + dx / l * 400, camera.position.y + dy / l * 400, camera.position.z + dz / l * 400); s.scale.setScalar(u.size * 400 * 0.22);
      s.material.opacity = goal.m === 'env' ? u.base : 0;
    }
    v3.mode = goal.m; v3.zone = goal.zone;
    v3.tiles.length = 0; v3.marks.length = 0;
  }

  function tileFor(t) {
    let e = pool.get(t.key);
    if (!e) {
      const mesh = new THREE.Mesh(geo, tileMaterial(t.down ? -1 : t.a, t.b)); mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
      const glow = new THREE.Mesh(markMeshes[0].geometry, new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); glow.renderOrder = 2; glow.visible = false;
      scene.add(mesh); scene.add(glow);
      e = { mesh, glow, face: `${t.down ? -1 : t.a}-${t.b}`, x: 0, y: 0, z: 0, yaw: 0, seen: -1, first: true, air: 0, settle: null };
      pool.set(t.key, e);
    }
    return e;
  }
  function post() {
    if (!game || lost) return;
    const now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1); lastNow = now; clock += dt;
    const seatSum = {}, frame = clock;
    for (const t of v3.tiles) {
      const e = tileFor(t), face = `${t.down ? -1 : t.a}-${t.b}`;
      if (face !== e.face) { e.mesh.material = tileMaterial(t.down ? -1 : t.a, t.b); e.face = face; }
      let X, Z, wW, wD;
      if (mode === 'env') { const o = onScreen(t); if (!o) continue; [X, Z, wW, wD] = o; } else { [X, Z] = worldOf(t.x + t.w / 2, t.y + t.h / 2); wW = t.w * S; wD = t.h * S * zoneNow.K; }
      const th = Math.max(0.5, wW * THICK);
      const tyaw = (hash(t.key) - 0.5) * (t.w < 34 ? 0.02 : 0.05);
      const ty = (t.lift ? 0.45 : 0) + (t.drag ? 2.6 : 0);
      if (e.first) {
        // a tile that just left an opponent's hand drops in from that seat; others are dealt onto the table from just above it
        const from = t.from != null && seatPos[t.from] ? seatPos[t.from] : null;
        if (from && !t.down) { e.x = from[0]; e.z = from[1]; e.y = 5; e.yaw = tyaw + 0.8; } else { e.x = X; e.z = Z; e.y = t.drag ? ty : 4 + hash(t.key + 'y') * 3; e.yaw = tyaw + (hash(t.key + 'r') - 0.5) * 0.6; e.settle = null; }
        e.first = false;
      }
      const k = t.drag || snap ? 1 : 1 - Math.exp(-dt * 11);
      const dx = X - e.x, dz = Z - e.z;
      e.x += dx * k; e.z += dz * k; e.yaw += (tyaw - e.yaw) * (t.drag ? 1 : 1 - Math.exp(-dt * 9));
      // height: glide above the table while travelling, then settle with a small bounce and a puff of dust
      const air = clamp(Math.hypot(dx, dz) / 9, 0, 1);
      if (e.air > 0.25 && air < 0.1 && !t.drag && t.w > 30) { e.settle = clock; puff(e.x, e.z, 1); }
      e.air = air;
      let y = e.y + (ty + air * 1.4 - e.y) * (1 - Math.exp(-dt * 12));
      if (e.settle != null) { const s = (clock - e.settle) / 0.28; if (s < 1) y += Math.abs(Math.sin(s * Math.PI * 2)) * 0.22 * (1 - s) * (1 - s); else e.settle = null; }
      e.y = y;
      const m = e.mesh;
      m.position.set(e.x, Math.max(0, y), e.z); m.rotation.set(t.drag ? -0.06 : 0, e.yaw, 0, 'YXZ'); m.scale.set(wW, th, wD); m.visible = true;
      if (t.down) { (seatSum[t.seat] ||= { x: 0, z: 0, n: 0 }); seatSum[t.seat].x += X; seatSum[t.seat].z += Z; seatSum[t.seat].n++; }
      const g = e.glow;
      if (t.hl) { g.visible = true; g.position.set(e.x, 0.04, e.z); g.scale.set(wW * 2.1, 1, wD * 1.7); g.material.opacity = 0.55 + 0.35 * Math.sin(clock * 5); } else g.visible = false;
      e.seen = frame;
    }
    for (const [key, e] of pool) if (e.seen !== frame) { scene.remove(e.mesh); scene.remove(e.glow); e.glow.material.dispose(); pool.delete(key); }
    for (const s in seatSum) seatPos[s] = [seatSum[s].x / seatSum[s].n, seatSum[s].z / seatSum[s].n];
    // glows (whose turn it is)
    let k = 0;
    for (const mk of v3.marks) {
      if (k >= markMeshes.length) break;
      const m = markMeshes[k++], [X, Z] = worldOf(mk.x, mk.y), r = mk.r * S * 2.2;
      m.visible = true; m.position.set(X, 0.05, Z); m.scale.set(r, 1, r * zoneNow.K); m.material.opacity = 0.55 + 0.35 * Math.sin(clock * 6);
    }
    for (; k < markMeshes.length; k++) markMeshes[k].visible = false;
    for (const m of dust) {
      const u = m.userData; if (!(u.t <= 0.6)) { m.visible = false; continue; }
      u.t += dt; const f = Math.min(1, u.t / 0.6), s = (3 + f * 6) * u.s;
      m.visible = true; m.position.set(u.x, 0.2 + f * 0.5, u.z); m.scale.set(s, 1, s); m.material.opacity = 0.4 * (1 - f) * (1 - f);
    }
    // lanterns breathe
    for (let i = 0; i < 2; i++) {
      const f = 1 + 0.07 * Math.sin(clock * 7.3 + i * 2) + 0.04 * Math.sin(clock * 13.1 + i) + 0.02 * Math.sin(clock * 23.7);
      const ud = lanterns[i].userData; ud.light.intensity = 2200 * f; ud.halo.material.opacity = clamp(0.8 + (f - 1) * 1.4, 0, 1); ud.flame.scale.set(0.8 * (2 - f), 1.9 * f, 0.8 * (2 - f));
    }
    if (fadeIn < 1) { fadeIn = Math.min(1, fadeIn + dt / 0.45); v3.fade = fadeIn; }
    renderer.setSize(cssW(), cssH(), false);
    renderer.render(scene, camera);
    const ft = dt * 1000; if (ft > 0) frameAvg = frameAvg * 0.95 + ft * 0.05;
    if (frameAvg > 26 && tier < 2) { if (++slowFrames > 90) { tier++; slowFrames = 0; frameAvg = 16; tableKey = ''; applyTier(); } } else slowFrames = 0;
  }

  let loseExt = null;
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; v3.on = false; canvas.style.visibility = 'hidden'; });
  canvas.addEventListener('webglcontextrestored', () => {
    lost = false; buildEnv(); disposeTileMaterials();
    for (const e of pool.values()) e.mesh.material = tileMaterial(e.face.startsWith('-1') ? -1 : Number(e.face.split('-')[0]), Number(e.face.split('-')[1]));
    if (table) { scene.remove(table); table.userData.dispose(); table = null; tableKey = ''; }
    applyTier(); fadeIn = 0; v3.fade = 0; v3.on = true; canvas.style.visibility = 'visible'; snap = true; fitCache.clear();
  });

  await tick();
  place(camera, cur); try { renderer.compile(scene, camera); } catch { /* compiled lazily */ }
  await tick();

  const api = {
    ok: true,
    attach(g) { game = g; v3.on = true; v3.fade = 0; fadeIn = 0; canvas.style.visibility = 'visible'; snap = true; },
    pre, post,
    get tier() { return TIERS[tier].name; },
  };
  if (dev) {
    // development only (env.config.dev): QA scripts drive the context-loss test and read the scene
    Object.assign(api, { renderer, scene, camera, pool, loseContext() { loseExt = renderer.getContext().getExtension('WEBGL_lose_context'); loseExt?.loseContext(); return Boolean(loseExt); }, restoreContext() { loseExt?.restoreContext(); } });
  }
  return api;
}

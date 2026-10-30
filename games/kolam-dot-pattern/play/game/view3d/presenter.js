// Kolam 3D presenter. READS what view.js asks for this frame (v3.want), never touches the game state. One WebGL canvas sits behind the kit's
// transparent 2D canvas: a granite doorstep in low morning sun, the rice-flour pattern on it, a brass bowl of flour and a water pot.
// On the play / Watch & Learn / Sandbox pages the camera looks straight down and is fitted so the flour plane covers EXACTLY the board
// rectangle the 2D layer uses, so finger tracking, the tip, marks, hints and rings (still drawn in 2D on top) line up without any change to
// the input code. The title uses a tilted, slowly drifting camera with the door sill behind the step. No WebGL, ?flat=1 or a lost context:
// v3.on = false and every screen draws the flat 2D art; a restored context rebuilds the environment and returns to 3D.
import * as THREE from '../vendor3d/three.js';
import { v3 } from '../src/v3.js';
import { meta } from '../src/game.js';
import { boardGeo } from '../src/boardview.js';
import { bezPoint } from '../src/board.js';
import { PITCH, SLAB_H, MARGIN, SLAB_M, lookOf, slabMesh, floorMesh, wetMesh, paintFlour, flourBowl, waterPot, doorSill, softDot, clearCaches } from './world.js';

const TAU = Math.PI * 2, D2R = Math.PI / 180;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TIERS = [{ name: 'high', dpr: 2, shadow: 2048, tex: 2048 }, { name: 'medium', dpr: 1.5, shadow: 1024, tex: 1536 }, { name: 'low', dpr: 1, shadow: 0, tex: 1024 }];
const tick = () => new Promise((r) => setTimeout(r, 0));
const FLOUR_Y = SLAB_H + 0.04;
const rev = (c) => [c[6], c[7], c[4], c[5], c[2], c[3], c[0], c[1]];

// where the flour is landing: the end of the drawn part [0, b] of seq (unit coordinates)
export function tipOf(seq, b) {
  if (!seq || !seq.length || b <= 0) return null;
  const i = Math.min(seq.length - 1, Math.max(0, Math.ceil(b) - 1)), t = clamp(b - i, 0, 1), q = seq[i];
  return bezPoint(q.dir === 1 ? rev(q.c) : q.c, t);
}

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
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  let tier = qs.has('tier') ? clamp(Number(qs.get('tier')), 0, 2) : (navigator.hardwareConcurrency || 8) <= 4 ? 1 : 0;
  await tick();

  // ---------------------------------------------------------------- scene, low sun, sky, environment
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 5, 2500);
  // the low morning sun through the doorway: a wide, soft-edged pool of warm light across the step
  const sun = new THREE.SpotLight(0xffd2a0, 3, 0, 0.62, 1, 0);
  sun.position.set(-260, 190, -210); sun.target.position.set(6, 0, 8);
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04; sun.shadow.radius = 4;
  Object.assign(sun.shadow.camera, { near: 180, far: 800 });
  const hemi = new THREE.HemisphereLight(0xbfd2ff, 0x3a2014, 0.55);
  const rim = new THREE.DirectionalLight(0xa8c0ff, 0.35); rim.position.set(120, 60, 140);
  scene.add(sun, sun.target, hemi, rim);
  const buildEnv = () => { try { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; pm.dispose(); scene.environmentIntensity = 0.3; } catch { /* no IBL */ } };
  buildEnv();
  await tick();

  // ---------------------------------------------------------------- world
  const world = new THREE.Group(); scene.add(world);
  let look = '', floor = null, slab = null, wet = null, slabKey = '', slabW = 60, slabD = 60;
  const bowl = flourBowl(), pot = waterPot(); world.add(bowl, pot);
  let sill = null, sillW = 0;
  // flour plane: a canvas texture laid on the stone
  let fc = document.createElement('canvas'); fc.width = fc.height = 16;
  let ftex = new THREE.CanvasTexture(fc); ftex.colorSpace = THREE.SRGBColorSpace; ftex.anisotropy = 4;
  const fmat = new THREE.MeshStandardMaterial({ map: ftex, bumpMap: ftex, bumpScale: 1.6, emissive: 0xffffff, emissiveMap: ftex, emissiveIntensity: 0.12, transparent: true, roughness: 0.95, metalness: 0, depthWrite: false, envMapIntensity: 0.35, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const flour = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), fmat); flour.rotation.x = -Math.PI / 2; flour.position.y = FLOUR_Y; flour.receiveShadow = true; flour.renderOrder = 2; world.add(flour);
  let flourKey = '', flourDims = '';
  // flour trickling from the fingers (out of shot) onto the growing tip
  const SN = 110, spos = new Float32Array(SN * 3), sseed = Array.from({ length: SN }, (_, i) => [((i * 0.618) % 1), Math.sin(i * 12.9898) * 0.5 + 0.5, Math.cos(i * 4.1) * 0.5 + 0.5]);
  const sgeo = new THREE.BufferGeometry(); sgeo.setAttribute('position', new THREE.BufferAttribute(spos, 3));
  const smat = new THREE.PointsMaterial({ map: softDot('255,252,244'), size: 0.55, transparent: true, opacity: 0, depthWrite: false, color: 0xfffaf0 });
  const stream = new THREE.Points(sgeo, smat); stream.frustumCulled = false; stream.renderOrder = 3; scene.add(stream);
  let streamA = 0; const tipW = new THREE.Vector3(), tipS = new THREE.Vector3(), tipV = new THREE.Vector3(); let tipInit = false;
  // dust motes in the morning light (title / menu screens)
  const DN = 120, dpos = new Float32Array(DN * 3), dseed = Array.from({ length: DN }, (_, i) => (i * 7.31) % 100);
  const dgeo = new THREE.BufferGeometry(); dgeo.setAttribute('position', new THREE.BufferAttribute(dpos, 3));
  const dust = new THREE.Points(dgeo, new THREE.PointsMaterial({ map: softDot('255,232,196'), size: 0.7, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffe2b8 }));
  dust.frustumCulled = false; scene.add(dust);
  function updateDust(t) {
    for (let i = 0; i < DN; i++) { const sd = dseed[i], u = ((t * 0.012 + sd * 0.137) % 1); dpos[i * 3] = -70 + ((sd * 37.1) % 140) + Math.sin(t * 0.3 + sd) * 3; dpos[i * 3 + 1] = 4 + u * 60; dpos[i * 3 + 2] = -60 + ((sd * 53.7) % 110) + Math.cos(t * 0.23 + sd * 2) * 3; }
    dgeo.attributes.position.needsUpdate = true;
  }

  function setLook(id) {
    if (id === look) return; look = id; const L = lookOf(id);
    if (floor) { world.remove(floor); floor.geometry.dispose(); floor.material.dispose(); }
    floor = floorMesh(L.floor); floor.material.color.set(L.floorTint ?? 0xffffff); world.add(floor);
    scene.background = new THREE.Color(L.bg); scene.fog = new THREE.Fog(L.bg, L.fog[0], L.fog[1]);
    sun.color.set(L.sun); sun.intensity = L.sunI; hemi.color.set(L.sky); hemi.groundColor.set(L.ground); hemi.intensity = L.hemiI;
    rim.color.set(L.rim[0]); rim.intensity = L.rim[1]; renderer.toneMappingExposure = L.exp; fmat.color.set(L.powder);
    slabKey = ''; flourKey = '';
  }
  function setBoard(B, id) {
    const key = `${look}|${id}`;
    if (key === slabKey) return; slabKey = key;
    slabW = (B.bounds.w + SLAB_M * 2) * PITCH; slabD = (B.bounds.h + SLAB_M * 2) * PITCH;
    if (slab) { world.remove(slab); slab.geometry.dispose(); slab.material.dispose(); }
    if (wet) { world.remove(wet); wet.geometry.dispose(); wet.material.dispose(); }
    slab = slabMesh(slabW, slabD, lookOf(look)); world.add(slab);
    wet = wetMesh(slabW * 0.96, slabD * 0.96); wet.position.y = SLAB_H + 0.01; world.add(wet);
    const fw = (B.bounds.w + MARGIN * 2) * PITCH, fd = (B.bounds.h + MARGIN * 2) * PITCH;
    flour.scale.set(fw, fd, 1);
    if (Math.abs(sillW - slabW) > 0.5) { if (sill) world.remove(sill); sillW = slabW; sill = doorSill(slabW + 24); world.add(sill); }
    sill.position.set(0, 0, -slabD / 2 - 7.5);
    flourKey = '';
  }
  // the flour texture: px per dot unit follows the on-screen size (sharp on tablets), capped by tier
  function paint(want, cssPerDot) {
    const B = want.B, uw = B.bounds.w + MARGIN * 2, uh = B.bounds.h + MARGIN * 2;
    const cap = TIERS[tier].tex, s = Math.floor(clamp(cssPerDot * Math.min(2, window.devicePixelRatio || 1) * 1.1, 60, cap / Math.max(uw, uh)));
    const dims = `${Math.round(uw * s)}x${Math.round(uh * s)}`;
    if (dims !== flourDims) {
      flourDims = dims; fc = document.createElement('canvas'); fc.width = Math.round(uw * s); fc.height = Math.round(uh * s);
      const old = ftex; ftex = new THREE.CanvasTexture(fc); ftex.colorSpace = THREE.SRGBColorSpace; ftex.anisotropy = 4; fmat.map = ftex; fmat.bumpMap = ftex; fmat.emissiveMap = ftex; fmat.needsUpdate = true; old.dispose(); flourKey = '';
    }
    const key = `${slabKey}|${want.key}`;
    if (key === flourKey) return; flourKey = key;
    paintFlour(fc, B, want.parts, s);
    ftex.needsUpdate = true;
  }
  function applyTier() {
    const t = TIERS[tier];
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, t.dpr));
    renderer.shadowMap.enabled = t.shadow > 0; sun.castShadow = t.shadow > 0;
    if (t.shadow) { sun.shadow.mapSize.set(t.shadow, t.shadow); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
    scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { m.needsUpdate = true; }); });
    vk = ''; flourDims = '';
  }
  let vk = '';
  applyTier();
  await tick();

  // ---------------------------------------------------------------- camera: fixed yaw/tilt/fov per screen; distance + off-axis shift fitted to a rectangle
  const cur = { yaw: 0, tilt: 89.9, fov: 30, dist: 200, ox: 0, oy: 0, tx: 0, ty: FLOUR_Y, tz: 0 };
  let snapNext = true, lastKind = '';
  const _v = new THREE.Vector3(), _t = new THREE.Vector3(), cssW = () => Math.max(1, window.innerWidth), cssH = () => Math.max(1, window.innerHeight);
  function place(cam, p) {
    const W = cssW(), H = cssH(), dir = _v.set(Math.sin(p.yaw * D2R) * Math.cos(p.tilt * D2R), Math.sin(p.tilt * D2R), Math.cos(p.yaw * D2R) * Math.cos(p.tilt * D2R));
    cam.fov = p.fov; cam.aspect = W / H; _t.set(p.tx, p.ty, p.tz);
    cam.position.copy(_t).addScaledVector(dir, p.dist); cam.up.set(-Math.sin(p.yaw * D2R), 0, -Math.cos(p.yaw * D2R)); cam.lookAt(_t);
    if (p.ox || p.oy) cam.setViewOffset(W, H, p.ox, p.oy, W, H); else cam.clearViewOffset();
    cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
  }
  const fitCam = new THREE.PerspectiveCamera();
  const toCss = (cam, x, y, z, out) => { _v.set(x, y, z).project(cam); out.x = (_v.x + 1) / 2 * cssW(); out.y = (1 - _v.y) / 2 * cssH(); return out; };
  function fit(rc, pts, base, fill = 'min') {
    const p = { ...base, ox: 0, oy: 0, dist: 300 }, q = { x: 0, y: 0 }; let bb = null;
    for (let it = 0; it < 10; it++) {
      place(fitCam, p); bb = { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 };
      for (const [x, y, z] of pts) { toCss(fitCam, x, y, z, q); bb.x0 = Math.min(bb.x0, q.x); bb.x1 = Math.max(bb.x1, q.x); bb.y0 = Math.min(bb.y0, q.y); bb.y1 = Math.max(bb.y1, q.y); }
      const sx = rc.w / Math.max(1, bb.x1 - bb.x0), sy = rc.h / Math.max(1, bb.y1 - bb.y0), s = fill === 'max' ? Math.max(sx, sy) : Math.min(sx, sy);
      if (Math.abs(s - 1) < 0.0003) break;
      p.dist /= s;
    }
    p.ox = (bb.x0 + bb.x1) / 2 - (rc.x + rc.w / 2); p.oy = (bb.y0 + bb.y1) / 2 - (rc.y + rc.h / 2);
    return p;
  }
  const cpu = () => meta.cssPerUnit || Math.min(cssW() / meta.width, cssH() / meta.height);
  const offX = () => (cssW() - meta.width * cpu()) / 2, offY = () => (cssH() - meta.height * cpu()) / 2;
  const rectCss = (r) => ({ x: r.x * cpu() + offX(), y: r.y * cpu() + offY(), w: r.w * cpu(), h: r.h * cpu() });
  // dot-unit point -> world (the board is centred on the origin)
  const uw = (B, u, v, y = FLOUR_Y) => [(u - B.cx) * PITCH, y, (v - B.cy) * PITCH];

  // props go in the largest free band of the board area (below / above / right / left of the slab), hidden when nothing fits
  function placeProps(B, g, area) {
    const ax0 = ((area.x - g.ox) / g.S - B.cx) * PITCH, ax1 = ((area.x + area.w - g.ox) / g.S - B.cx) * PITCH;
    const az0 = ((area.y - g.oy) / g.S - B.cy) * PITCH, az1 = ((area.y + area.h - g.oy) / g.S - B.cy) * PITCH;
    const hw = (B.bounds.w / 2 + 0.7) * PITCH, hd = (B.bounds.h / 2 + 0.7) * PITCH, need = 13.5;
    const bands = [
      { k: 'below', s: az1 - hd, put: (s) => { bowl.position.set(Math.min(ax1 - 10, hw * 0.62), 0, hd + Math.max(s / 2 + 1, 7.5)); pot.position.set(Math.max(ax0 + 8, -hw * 0.66), 0, hd + Math.max(s / 2, 5.5)); } },
      { k: 'above', s: -hd - az0, put: (s) => { bowl.position.set(Math.min(ax1 - 10, hw * 0.55), 0, -hd - Math.max(s / 2, 7.5)); pot.position.set(Math.max(ax0 + 8, -hw * 0.6), 0, -hd - Math.max(s / 2, 5.5)); } },
      { k: 'right', s: ax1 - hw, put: (s) => { bowl.position.set(hw + s / 2, 0, hd * 0.45); pot.position.set(hw + s / 2, 0, -hd * 0.45); } },
      { k: 'left', s: -hw - ax0, put: (s) => { bowl.position.set(-hw - s / 2, 0, hd * 0.45); pot.position.set(-hw - s / 2, 0, -hd * 0.45); } },
    ].sort((a, b) => b.s - a.s);
    const best = bands[0];
    bowl.visible = pot.visible = best.s >= need;
    if (bowl.visible) best.put(best.s);
    bowl.rotation.y = 0.6; pot.rotation.y = -0.3;
    for (const o of [bowl, pot]) o.position.y = Math.abs(o.position.x) < slabW / 2 - 6 && Math.abs(o.position.z) < slabD / 2 - 6 ? SLAB_H : 0;
  }

  // ---------------------------------------------------------------- per frame
  let lost = false, lastNow = 0, clock = 0, frameAvg = 16, slowFrames = 0, fadeIn = 0, attached = false, lastBoard = null, lastBoardId = 'bare';
  function post() {
    if (!attached || lost) return;
    const now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1); lastNow = now; clock += dt;
    const want = v3.want || { kind: 'bare', theme: 'stone' };
    setLook(want.theme || 'stone');
    const kind = want.kind;
    if (kind !== lastKind) { snapNext = snapNext || kind === 'board' || lastKind === 'board' || !lastKind; lastKind = kind; }
    let goal = null, snap = false;
    if (kind === 'board' || kind === 'hero') { lastBoard = want.B; lastBoardId = want.id; setBoard(want.B, want.id); }
    else if (!lastBoard) { lastBoard = { bounds: { w: 4, h: 4, minX: 0, minY: 0 }, cx: 2, cy: 2, dots: [] }; setBoard(lastBoard, 'bare'); }
    else setBoard(lastBoard, lastBoardId);
    const B = lastBoard;
    if (kind === 'board') {
      const g = boardGeo(B, want.area, want.pad);
      const r = rectCss({ x: g.ox + B.bounds.minX * g.S, y: g.oy + B.bounds.minY * g.S, w: B.bounds.w * g.S, h: B.bounds.h * g.S });
      const pts = [uw(B, B.bounds.minX, B.bounds.minY), uw(B, B.bounds.minX + B.bounds.w, B.bounds.minY), uw(B, B.bounds.minX, B.bounds.minY + B.bounds.h), uw(B, B.bounds.minX + B.bounds.w, B.bounds.minY + B.bounds.h)];
      goal = fit(r, pts, { yaw: 0, tilt: 89.9, fov: 30, tx: 0, ty: FLOUR_Y, tz: 0 }); snap = true;
      paint(want, g.S * cpu());
      placeProps(B, g, want.area);
      flour.visible = true; if (sill) sill.visible = false;
    } else if (kind === 'hero') {
      const g = boardGeo(B, want.area, want.pad);
      const r = rectCss(want.area);
      const hw = slabW / 2, hd = slabD / 2, t = clock;
      const fw = (B.bounds.w / 2 + 0.75) * PITCH, fd = (B.bounds.h / 2 + 0.75) * PITCH;
      const pts = [[-fw, SLAB_H, -fd], [fw, SLAB_H, -fd], [-fw, SLAB_H, fd], [fw, SLAB_H, fd]];
      goal = fit(r, pts, { yaw: -6 + 5 * Math.sin(t * TAU / 34), tilt: 52 + 3 * Math.sin(t * TAU / 21), fov: 30, tx: 0, ty: SLAB_H, tz: 2 });
      paint(want, g.S * cpu());
      bowl.visible = pot.visible = true; bowl.position.set(hw - 9, SLAB_H, hd - 8); pot.position.set(-hw + 8, SLAB_H, -hd + 9); bowl.rotation.y = 0.6;
      flour.visible = true; if (sill) sill.visible = false;
    } else {
      const r = { x: 0, y: 0, w: cssW(), h: cssH() };
      const hw = slabW / 2 + 10, hd = slabD / 2 + 10;
      goal = fit(r, [[-hw, 0, -hd], [hw, 0, -hd], [-hw, 0, hd], [hw, 0, hd]], { yaw: 4 * Math.sin(clock * TAU / 50), tilt: 74, fov: 30, tx: 0, ty: 0, tz: 0 }, 'max');
      flour.visible = false; bowl.visible = pot.visible = false; if (sill) sill.visible = true;
    }
    const a = snapNext || snap ? 1 : 1 - Math.exp(-dt * 4);
    for (const k of Object.keys(goal)) cur[k] += (goal[k] - cur[k]) * a;
    snapNext = false;
    place(camera, cur);

    // flour trickle at the tip while the line grows
    const tp = (kind === 'board' || kind === 'hero') && want.growing ? tipOf(want.tipSeq, want.tipB) : null;
    if (tp) { const w = uw(B, tp[0], tp[1]); tipW.set(w[0], w[1], w[2]); if (!tipInit) { tipS.copy(tipW); tipInit = true; } }
    // the hand follows the line on a critically damped spring (no jerks where arcs join); a jump to a new stroke snaps
    if (tipS.distanceTo(tipW) > 40 || streamA < 0.05) { tipS.copy(tipW); tipV.set(0, 0, 0); }
    else { const kk = 26, n = Math.max(1, Math.ceil(dt / 0.008)), h = dt / n; for (let i = 0; i < n; i++) { tipV.x += ((tipW.x - tipS.x) * kk * kk - 2 * kk * tipV.x) * h; tipV.z += ((tipW.z - tipS.z) * kk * kk - 2 * kk * tipV.z) * h; tipS.x += tipV.x * h; tipS.z += tipV.z * h; } tipS.y = tipW.y; }
    streamA += ((tp ? 1 : 0) - streamA) * (1 - Math.exp(-dt * (tp ? 10 : 5)));
    if (!tp && streamA < 0.02) tipInit = false;
    smat.opacity = streamA * 0.95; stream.visible = streamA > 0.01;
    if (stream.visible) {
      const H = 18;
      for (let i = 0; i < SN; i++) {
        const [ph, j1, j2] = sseed[i], u = (clock * 1.6 + ph) % 1, y = H * (1 - u * u), spread = 0.08 + (1 - y / H) * 0.32 + (u > 0.94 ? (u - 0.94) * 14 : 0);
        spos[i * 3] = tipS.x + (j1 - 0.5) * spread * 2 + Math.sin(clock * 7 + i) * 0.04; spos[i * 3 + 1] = FLOUR_Y + 0.15 + y; spos[i * 3 + 2] = tipS.z + (j2 - 0.5) * spread * 2;
      }
      sgeo.attributes.position.needsUpdate = true;
    }
    dust.visible = kind !== 'board'; if (dust.visible) updateDust(clock);
    // the finish: the morning sun brightens a touch as the last arc closes
    sun.intensity = lookOf(look).sunI * (1 + 0.18 * (want.fin || 0));

    const k = `${cssW()}x${cssH()}`; if (k !== vk) { vk = k; renderer.setSize(cssW(), cssH(), false); }
    if (fadeIn < 1) { fadeIn = Math.min(1, fadeIn + dt / 0.45); v3.fade = fadeIn; }
    renderer.render(scene, camera);
    const ft = dt * 1000; if (ft > 0) frameAvg = frameAvg * 0.95 + ft * 0.05;
    if (frameAvg > 26 && tier < 2) { if (++slowFrames > 90) { tier++; slowFrames = 0; frameAvg = 16; applyTier(); } } else slowFrames = 0;
  }

  // ---------------------------------------------------------------- context loss: the flat art takes over, then back to 3D
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; v3.on = false; canvas.style.visibility = 'hidden'; });
  canvas.addEventListener('webglcontextrestored', () => {
    lost = false; buildEnv(); clearCaches(); look = ''; slabKey = ''; flourKey = ''; flourDims = ''; sillW = 0;
    applyTier(); fadeIn = 0; v3.fade = 0; v3.on = true; canvas.style.visibility = 'visible'; snapNext = true;
  });

  // warm up in small slices: default look, shaders
  setLook('stone'); await tick();
  place(camera, cur); try { renderer.compile(scene, camera); } catch { /* compiled lazily */ }
  await tick();

  return {
    ok: true, renderer, scene, camera, sun,
    attach() { attached = true; v3.on = true; v3.fade = 0; fadeIn = 0; canvas.style.visibility = 'visible'; snapNext = true; },
    post,
    get tier() { return TIERS[tier].name; },
    get tip() { return { x: tipS.x, z: tipS.z, a: streamA }; },
    loseContext() { const ext = renderer.getContext().getExtension('WEBGL_lose_context'); ext?.loseContext(); return ext; },
  };
}

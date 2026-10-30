// Quilt Patterns 3D presenter. READS the game state (game.getState()), never writes it. One WebGL canvas sits behind the kit's transparent
// 2D canvas: a lamp-lit worktable with a cutting mat, the block or mini quilt as real pieced cloth, and sewing props. On the play page the
// camera looks straight down and is fitted so the cloth's top plane covers exactly the layout's board rectangle: the 2D layer's taps,
// letters, hint and selection rings line up with the 3D cloth without any change to the input code. Title and result use a tilted,
// slowly drifting camera. No WebGL, ?flat=1 or a lost context: v3.on = false and every screen draws the flat 2D art; a restored context
// rebuilds the environment and returns to 3D.
import * as THREE from '../vendor3d/three.js';
import { v3 } from '../src/v3.js';
import { meta } from '../src/game.js';
import { playLayout, playOpts, titleLayout, showLayout, frame } from '../src/layout.js';
import { samplePaint } from '../src/view.js';
import { BLOCKS, blockOf } from '../src/blocks.js';
import { LOOK3D, MAT, MAT_H, BOARD, CLOTH_Y, PUFF, woodTable, cuttingMat, propsGroup, blockPieces, quiltPieces, patchGeometry, mergeGeometries, fabricMaterial, clearFabricCache, makeStitches, writeStitches, writeQuilting } from './world.js';

const TAU = Math.PI * 2, D2R = Math.PI / 180;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TIERS = [{ name: 'high', dpr: 2, shadow: 2048 }, { name: 'medium', dpr: 1.5, shadow: 1024 }, { name: 'low', dpr: 1, shadow: 0 }];
const tick = () => new Promise((r) => setTimeout(r, 0));
export const DROP = 0.34;   // seconds: a cut piece is laid on the block: it floats down, touches, and the batting gives a little
// Pose of a dropping piece at age t: height above its place (cm), a small turn and tilt that straighten as it lands, a squash on contact.
export function dropPose(t, seed = 0) {
  if (t >= DROP) return { y: 0, rot: 0, tilt: 0, sq: 1, k: 1 };
  const touch = 0.22;
  if (t < touch) { const u = t / touch; return { y: 3.4 * (1 - u * u), rot: (seed - 0.5) * 0.22 * (1 - u), tilt: 0.08 * (1 - u) * (seed > 0.5 ? 1 : -1), sq: 1, k: 1.035 - 0.035 * u }; }
  const s = (t - touch) / (DROP - touch), damp = (1 - s) * (1 - s);
  return { y: Math.abs(Math.sin(s * Math.PI * 1.6)) * 0.22 * damp, rot: 0, tilt: 0, sq: 1 - 0.25 * Math.max(0, 1 - s * 3), k: 1 };
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
  renderer.shadowMap.type = THREE.PCFShadowMap;
  let tier = qs.has('tier') ? clamp(Number(qs.get('tier')), 0, 2) : (navigator.hardwareConcurrency || 8) <= 4 ? 1 : 0;
  await tick();

  // ---------------------------------------------------------------- scene, lamp, environment
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 5, 1500);
  const lamp = new THREE.SpotLight(0xffd2a0, 3.4, 0, 0.42, 0.75, 0);
  lamp.position.set(-95, 85, -70); lamp.target.position.set(0, 0, 4);
  lamp.shadow.bias = -0.00025; lamp.shadow.normalBias = 0.03; lamp.shadow.radius = 5;
  Object.assign(lamp.shadow.camera, { near: 60, far: 320 });
  const hemi = new THREE.HemisphereLight(0xf0dcc0, 0x24160c, 0.34);
  const rim = new THREE.DirectionalLight(0x9fb8ff, 0.7); rim.position.set(60, 40, 90);
  const fill = new THREE.DirectionalLight(0xffb27a, 0.25); fill.position.set(80, 50, -40);
  scene.add(lamp, lamp.target, hemi, rim, fill);
  const buildEnv = () => { try { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; pm.dispose(); scene.environmentIntensity = 0.22; } catch { /* no IBL */ } };
  buildEnv();
  await tick();

  // ---------------------------------------------------------------- table, mat, props, cloth
  const world = new THREE.Group(); scene.add(world);
  let table = null, mat = null, look = '';
  const props = propsGroup('hearth'); world.add(props.group);
  const cloth = new THREE.Group(); cloth.position.y = CLOTH_Y; world.add(cloth);
  const stitches = makeStitches(7000); cloth.add(stitches);
  const dropLayer = new THREE.Group(); cloth.add(dropLayer);
  // dust motes drifting through the lamp light (title and result only; off with Calm motion)
  const DN = 140, dpos = new Float32Array(DN * 3), dseed = new Float32Array(DN);
  for (let i = 0; i < DN; i++) { dseed[i] = Math.random() * 100; }
  const dgeo = new THREE.BufferGeometry(); dgeo.setAttribute('position', new THREE.BufferAttribute(dpos, 3));
  const dtex = (() => { const c = document.createElement('canvas'); c.width = c.height = 32; const x = c.getContext('2d'), g = x.createRadialGradient(16, 16, 0, 16, 16, 16); g.addColorStop(0, 'rgba(255,236,200,1)'); g.addColorStop(1, 'rgba(255,236,200,0)'); x.fillStyle = g; x.fillRect(0, 0, 32, 32); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const dust = new THREE.Points(dgeo, new THREE.PointsMaterial({ map: dtex, size: 0.55, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffe2b8 }));
  dust.frustumCulled = false; scene.add(dust);
  function updateDust(t) {
    for (let i = 0; i < DN; i++) { const sd = dseed[i], u = ((t * 0.018 + sd * 0.137) % 1); dpos[i * 3] = -40 + ((sd * 37.1) % 70) + Math.sin(t * 0.3 + sd) * 2.5; dpos[i * 3 + 1] = 2 + u * 34; dpos[i * 3 + 2] = -34 + ((sd * 53.7) % 58) + Math.cos(t * 0.23 + sd * 2) * 2.5; }
    dgeo.attributes.position.needsUpdate = true;
  }
  // shown: piece key -> { fid, pts } currently drawn in the merged cloth; drops: pieces in the air
  const shown = new Map(); let drops = [], clothKey = '', quiltedOn = false, squintOn = false, curQuilt = null;
  const groupMeshes = [];
  function setLook(id) {
    if (id === look) return; look = id; const L = LOOK3D[id] ?? LOOK3D.hearth;
    if (table) { world.remove(table); table.material.map.dispose(); table.material.bumpMap.dispose(); table.material.dispose(); }
    if (mat) world.remove(mat);
    table = woodTable(id); world.add(table); mat = cuttingMat(id); world.add(mat);
    scene.background = new THREE.Color(L.bg); scene.fog = new THREE.Fog(L.bg, L.fog[0], L.fog[1]);
    lamp.color.set(L.key); lamp.intensity = L.keyI; hemi.color.set(L.hemi[0]); hemi.groundColor.set(L.hemi[1]); hemi.intensity = L.hemi[2];
    rim.color.set(L.rim[0]); rim.intensity = L.rim[1]; renderer.toneMappingExposure = L.exp;
    clothKey = ''; shown.clear();
  }
  const blockCm = () => (curQuilt ? BOARD / (curQuilt.cols + 0.6) : BOARD);
  function rebuildCloth(pieces) {
    for (const m of groupMeshes) { cloth.remove(m); m.geometry.dispose(); }
    groupMeshes.length = 0;
    const byFid = new Map(), paperHex = (LOOK3D[look] ?? LOOK3D.hearth).paper;
    for (const pc of pieces) {
      const small = !!curQuilt;
      pc.geo = patchGeometry(pc.pts, BOARD, !pc.fid, small ? 5 : 7, small ? 32 : 44);
      const k = pc.fid || ''; if (!byFid.has(k)) byFid.set(k, []); byFid.get(k).push(pc.geo);
    }
    for (const [fid, geos] of byFid) {
      const m = new THREE.Mesh(mergeGeometries(geos), fabricMaterial(fid, squintOn, blockCm(), paperHex));
      m.castShadow = !!fid; m.receiveShadow = true; if (!fid) m.position.y = -0.03; cloth.add(m); groupMeshes.push(m);
    }
    let n = writeStitches(stitches, pieces, BOARD, 0, 0);
    if (quiltedOn) n = writeQuilting(stitches, BOARD, 0, n, curQuilt ? curQuilt.cols * 3 : 6);
  }
  const rebuildFromShown = () => rebuildCloth([...shown.entries()].filter(([, s]) => s.fid !== null).map(([key, s]) => ({ key, ...s })));
  const isDropping = (p) => drops.some((d) => d.key === p.key && d.fid === p.fid);
  // Bring the cloth to `pieces` (key, pts, fid). New or re-dyed pieces drop in (unless calm); removed pieces vanish at once.
  function syncCloth(pieces, key, animate, now) {
    const target = new Map(pieces.map((p) => [p.key, p]));
    let changed = key !== clothKey || shown.size !== target.size;
    if (!changed) for (const p of pieces) { const s = shown.get(p.key); if (!s || (s.fid !== p.fid && !isDropping(p))) { changed = true; break; } }
    if (!changed) return;
    const fresh = key !== clothKey; clothKey = key;
    if (fresh) { shown.clear(); for (const d of drops) if (d.pivot) dropLayer.remove(d.pivot); drops = []; }
    for (const p of pieces) {
      const s = shown.get(p.key);
      if (animate && p.fid && (!s || s.fid !== p.fid) && !isDropping(p)) drops.push({ key: p.key, fid: p.fid, pts: p.pts, cell: p.cell, t0: now, seed: (p.key.length * 7 + drops.length * 13) % 10 / 10 });
    }
    for (const k of [...shown.keys()]) if (!target.has(k)) shown.delete(k);
    for (const p of pieces) {
      const s = shown.get(p.key);
      if (!isDropping(p)) shown.set(p.key, { fid: p.fid, pts: p.pts, cell: p.cell, empty: p.empty });
      else if (!s) shown.set(p.key, { fid: null, pts: p.pts, cell: p.cell });
      else if (s.fid) shown.set(p.key, { ...s, fid: '' });   // re-dyed: the paper template shows under the falling piece
    }
    drops = drops.filter((d) => { const ok = target.has(d.key) && target.get(d.key).fid === d.fid; if (!ok && d.pivot) dropLayer.remove(d.pivot); return ok; });
    rebuildFromShown();
  }
  function updateDrops(now) {
    let landed = false;
    for (const d of drops) {
      const age = now - d.t0;
      if (age >= DROP) { shown.set(d.key, { fid: d.fid, pts: d.pts, cell: d.cell }); d.done = true; landed = true; continue; }
      if (!d.pivot) {
        const g = patchGeometry(d.pts, BOARD, false, 6, 36), m = new THREE.Mesh(g, fabricMaterial(d.fid, squintOn, blockCm(), '#000'));
        m.castShadow = true; m.receiveShadow = true;
        d.pivot = new THREE.Group(); const c = g.userData.c; d.pivot.position.set(c[0], 0, c[1]); m.position.set(-c[0], 0, -c[1]); d.pivot.add(m); dropLayer.add(d.pivot);
      }
      const p = dropPose(age, d.seed); d.pivot.position.y = 0.12 + p.y; d.pivot.rotation.set(p.tilt, p.rot, 0); d.pivot.scale.set(p.k, p.sq, p.k);
    }
    for (const d of drops) if (d.done && d.pivot) dropLayer.remove(d.pivot);
    drops = drops.filter((d) => !d.done);
    if (landed) rebuildFromShown();
  }
  function applyTier() {
    const t = TIERS[tier];
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, t.dpr));
    renderer.shadowMap.enabled = t.shadow > 0; lamp.castShadow = t.shadow > 0;
    if (t.shadow) { lamp.shadow.mapSize.set(t.shadow, t.shadow); if (lamp.shadow.map) { lamp.shadow.map.dispose(); lamp.shadow.map = null; } }
    scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { m.needsUpdate = true; }); });
    vk = '';
  }
  let vk = '';
  applyTier();
  await tick();

  // ---------------------------------------------------------------- camera: fixed yaw/tilt/fov per screen; distance + off-axis shift fitted to a rectangle
  const cur = { yaw: 0, tilt: 89.9, fov: 30, dist: 120, ox: 0, oy: 0, tx: 0, ty: CLOTH_Y, tz: 0 };
  let snapNext = true;
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
    const p = { ...base, ox: 0, oy: 0, dist: 150 }, q = { x: 0, y: 0 }; let bb = null;
    for (let it = 0; it < 8; it++) {
      place(fitCam, p); bb = { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 };
      for (const [x, y, z] of pts) { toCss(fitCam, x, y, z, q); bb.x0 = Math.min(bb.x0, q.x); bb.x1 = Math.max(bb.x1, q.x); bb.y0 = Math.min(bb.y0, q.y); bb.y1 = Math.max(bb.y1, q.y); }
      const sx = rc.w / Math.max(1, bb.x1 - bb.x0), sy = rc.h / Math.max(1, bb.y1 - bb.y0), s = fill === 'max' ? Math.max(sx, sy) : Math.min(sx, sy);
      if (Math.abs(s - 1) < 0.0004) break;
      p.dist /= s;
    }
    p.ox = (bb.x0 + bb.x1) / 2 - (rc.x + rc.w / 2); p.oy = (bb.y0 + bb.y1) / 2 - (rc.y + rc.h / 2);
    return p;
  }
  const cpu = () => meta.cssPerUnit || (Math.min(cssW() / meta.width, cssH() / meta.height));
  const offX = () => (cssW() - meta.width * cpu()) / 2, offY = () => (cssH() - meta.height * cpu()) / 2;
  const rectCss = (r) => ({ x: r.x * cpu() + offX(), y: r.y * cpu() + offY(), w: r.w * cpu(), h: r.h * cpu() });
  const TOPY = CLOTH_Y + PUFF * 0.35;
  const boardPts = (y = TOPY) => [[-BOARD / 2, y, -BOARD / 2], [BOARD / 2, y, -BOARD / 2], [-BOARD / 2, y, BOARD / 2], [BOARD / 2, y, BOARD / 2]];
  const heroPts = () => [[-MAT / 2 - 3, MAT_H, -MAT / 2 - 2], [MAT / 2 + 3, MAT_H, -MAT / 2 - 2], [-MAT / 2 - 3, 0, MAT / 2 + 1], [MAT / 2 + 3, 0, MAT / 2 + 1]];

  // ---------------------------------------------------------------- what to show per screen
  let game = null, lost = false, lastNow = 0, clock = 0, frameAvg = 16, slowFrames = 0, fadeIn = 0, lastScene = '';
  function titleBlock(t, calm) {
    const ids = BLOCKS.map((b) => b.id), step = 0.16, hold = 2.6, durOf = (id) => blockOf(id).patches.length * step + hold;
    let tt = t, k = 0;
    if (!calm) while (tt > durOf(ids[k % 6])) { tt -= durOf(ids[k % 6]); k += 1; }
    const id = calm ? 'ohio-star' : ids[k % 6], paint = samplePaint(id).map((f, i) => (calm || tt - i * step >= 0 ? f : ''));
    return { id, paint, k };
  }
  function framing(s) {
    const sc = s.scene, drift = s.prefs.calm ? 0 : 1, t = s.t;
    if (sc === 'play' && s.ch) {
      const L = playLayout(meta.width, meta.height, playOpts(s));
      return { goal: fit(rectCss(L.board), boardPts(), { yaw: 0, tilt: 89.9, fov: 30, tx: 0, ty: TOPY, tz: 0 }), snap: true };
    }
    if (sc === 'show' && s.show) {
      const O = showLayout(meta.width, meta.height, s.show.buttons.length), r = rectCss(O.pic);
      const lift = s.show.lift ? clamp(s.sceneT / 0.9, 0, 1) : 1;
      return { goal: fit(r, [[-MAT / 2, MAT_H, -MAT / 2], [MAT / 2, MAT_H, -MAT / 2], [-MAT / 2, 0, MAT / 2], [MAT / 2, 0, MAT / 2]], { yaw: -6 * drift * Math.sin(t * TAU / 24), tilt: 74 - 10 * lift, fov: 30, tx: 0, ty: TOPY, tz: 1 }) };
    }
    if (sc === 'title') {
      const T = titleLayout(meta.width, meta.height, !!s.saved), hero = T.hero, H = hero.h, tb = Math.min(150, Math.max(66, H * 0.26)), gs = Math.max(90, Math.min(hero.w * 0.66, H - tb - 24, 520)), y0 = hero.y + Math.max(0, (H - gs - tb) / 2);
      const r = rectCss({ x: hero.x, y: hero.y, w: hero.w, h: y0 + gs - hero.y + tb * 0.15 });
      return { goal: fit(r, heroPts(), { yaw: (-8 + 6 * Math.sin(t * TAU / 30)) * drift, tilt: 54 + 3 * Math.sin(t * TAU / 19) * drift, fov: 30, tx: 0, ty: 0, tz: 3 }) };
    }
    // text and list screens: the worktable seen from above, softly drifting, filling the screen
    const F = frame(meta.width, meta.height), r = rectCss({ x: F.U.x0, y: F.U.y0, w: F.U.w, h: F.U.h });
    return { goal: fit(r, [[-40, 0, -40], [40, 0, -40], [-40, 0, 40], [40, 0, 40]], { yaw: 3 * drift * Math.sin(t * TAU / 40), tilt: 80, fov: 30, tx: 0, ty: 0, tz: 0 }, 'max') };
  }
  function content(s) {
    const sc = s.scene, calm = s.prefs.calm;
    if (sc === 'play' && s.ch) {
      const ch = s.ch, d = s.d;
      if (ch.kind === 'block') { curQuilt = null; return { pieces: blockPieces(ch.block, d.paint), key: `b|${ch.block}`, anim: !calm, quilted: false }; }
      curQuilt = { cols: ch.cols }; return { pieces: quiltPieces(ch, d), key: `q|${ch.cols}|${d.sashW}|${d.bordW}`, anim: !calm, quilted: s.pressT > 0 || !!s.finished };
    }
    if (sc === 'show' && s.show) {
      const v = s.show;
      if (v.kind === 'quilt') { curQuilt = { cols: v.ch.cols }; return { pieces: quiltPieces(v.ch, v.d), key: `sq|${v.ch.cols}|${v.d.sashW}|${v.d.bordW}|${v.title}`, anim: false, quilted: true }; }
      curQuilt = null; return { pieces: blockPieces(v.ch.block, v.d.paint), key: `sb|${v.ch.block}|${v.title}`, anim: false, quilted: false };
    }
    const tb = titleBlock(sc === 'title' ? s.t : 0, calm || sc !== 'title');
    curQuilt = null; return { pieces: blockPieces(tb.id, tb.paint), key: `t|${tb.id}|${tb.k}`, anim: !calm && sc === 'title', quilted: false };
  }

  function pre() {
    if (!game || lost) return;
    const s = game.getState(), now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1);
    if (s.scene !== lastScene) { if (s.scene === 'play' || lastScene === 'play' || !lastScene) snapNext = true; lastScene = s.scene; }
    const { goal, snap } = framing(s);
    const a = snapNext || snap ? 1 : 1 - Math.exp(-dt * 4);
    for (const k of Object.keys(goal)) cur[k] += (goal[k] - cur[k]) * a;
    snapNext = false;
    place(camera, cur);
  }
  function post() {
    if (!game || lost) return;
    const now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1); lastNow = now;
    const s = game.getState(), frozen = s.paused || (s.auto?.on && s.auto.paused);
    if (!frozen) clock += dt;
    setLook(s.prefs.look);
    const bare = !(s.scene === 'play' || s.scene === 'title' || s.scene === 'show');
    // props live in the free table margins; when the side panels cover them (side / three-column play) they stay hidden
    const sidePlay = s.scene === 'play' && s.ch && playLayout(meta.width, meta.height, playOpts(s)).mode !== 'stacked';
    props.group.visible = !bare && !sidePlay; cloth.visible = !bare; if (mat) mat.visible = !bare;
    const c = content(s), sq = !!s.squint && s.scene === 'play', qd = !!c.quilted;
    if (sq !== squintOn || qd !== quiltedOn) { squintOn = sq; quiltedOn = qd; clothKey = ''; }
    dust.visible = !s.prefs.calm && (s.scene === 'title' || s.scene === 'show'); if (dust.visible) updateDust(clock);
    syncCloth(c.pieces, c.key, c.anim, clock);
    updateDrops(clock);
    const k = `${cssW()}x${cssH()}`; if (k !== vk) { vk = k; renderer.setSize(cssW(), cssH(), false); }
    if (fadeIn < 1) { fadeIn = Math.min(1, fadeIn + dt / 0.4); v3.fade = fadeIn; }
    renderer.render(scene, camera);
    const ft = dt * 1000; if (ft > 0) frameAvg = frameAvg * 0.95 + ft * 0.05;
    if (frameAvg > 26 && tier < 2) { if (++slowFrames > 90) { tier++; slowFrames = 0; frameAvg = 16; applyTier(); } } else slowFrames = 0;
  }

  // ---------------------------------------------------------------- context loss: the flat art takes over, then back to 3D
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; v3.on = false; canvas.style.visibility = 'hidden'; });
  canvas.addEventListener('webglcontextrestored', () => {
    lost = false; buildEnv(); clearFabricCache(); look = ''; clothKey = ''; shown.clear(); drops = []; while (dropLayer.children.length) dropLayer.remove(dropLayer.children[0]);
    applyTier(); fadeIn = 0; v3.fade = 0; v3.on = true; canvas.style.visibility = 'visible'; snapNext = true;
  });

  // warm up in small slices: default look, the title block, shaders
  setLook('hearth'); await tick();
  syncCloth(blockPieces('ohio-star', samplePaint('ohio-star')), 'warm', false, 0); await tick();
  place(camera, cur); try { renderer.compile(scene, camera); } catch { /* compiled lazily */ }
  await tick();

  return {
    ok: true, renderer, scene, camera, lamp,
    attach(g) { game = g; v3.on = true; v3.fade = 0; fadeIn = 0; canvas.style.visibility = 'visible'; snapNext = true; clothKey = ''; },
    pre, post,
    get tier() { return TIERS[tier].name; },
    loseContext() { const ext = renderer.getContext().getExtension('WEBGL_lose_context'); ext?.loseContext(); return ext; },
  };
}

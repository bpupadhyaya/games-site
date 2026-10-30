// Lusona 3D presenter. READS the simulation state (game.getState()), never writes it. One WebGL canvas sits behind the kit's
// transparent 2D canvas: the courtyard scene (sand bed, pebbles, hand, elders, huts) and a screen-space HUD scene (carved
// plaques and lacquered buttons) drawn in the same frame, under the 2D text.
// Fallbacks: no WebGL / context lost -> v3.on = false and every screen draws with the flat 2D art; restored -> back to 3D.
import { THREE, board3d as B } from '../vendor3d/index.js';
import { v3 } from '../src/v3.js';
import { heroCfg } from '../src/view.js';
import { trace } from '../src/mirror.js';
import { createSand, CELL } from './sand.js';
import { createWorld } from './world.js';
import { createFinger } from './hand.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TIERS = [
  { name: 'high', dpr: 2, shadow: 2048 },
  { name: 'medium', dpr: 1.5, shadow: 1024 },
  { name: 'low', dpr: 1, shadow: 0 },
];

export async function createPresenter({ kitCanvas, quality = 'high', getLook }) {
  const qs = new URLSearchParams(location.search);
  const noop = { wrap: (g) => g, ok: false };
  let renderer;
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100dvh;display:block;pointer-events:none;z-index:0';
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: qs.has('keep') });
  } catch (e) { console.warn('WebGL unavailable; 2D fallback', e); return noop; }
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.84;
  renderer.autoClear = false; renderer.setClearColor(0x2a1a10, 1);
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.localClippingEnabled = true;

  let tier = Math.max(0, TIERS.findIndex((t) => t.name === quality));
  if (qs.has('tier')) tier = clamp(Number(qs.get('tier')), 0, TIERS.length - 1);

  // ---------------------------------------------------------------- scenes
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 400);
  scene.fog = new THREE.Fog(0xd9b080, 16, 80);
  const world = createWorld({ quality: TIERS[tier].name, camera });
  scene.add(world.group);
  const sand = createSand({ quality: TIERS[tier].name });
  scene.add(sand.group);

  // golden hour: low warm sun from the left-front, cool sky fill, warm rim
  const hemi = new THREE.HemisphereLight(0xcfd8ff, 0x6a3c20, 0.5);
  const sun = new THREE.DirectionalLight(0xffb45e, 2.3); sun.position.set(-4.2, 2.6, 3.6);
  const rim = new THREE.DirectionalLight(0xffd7a0, 1.6); rim.position.set(3.5, 3.0, -5);
  const fill = new THREE.DirectionalLight(0x9fb4ff, 0.5); fill.position.set(4, 2.5, 5);
  sun.castShadow = true;
  Object.assign(sun.shadow.camera, { left: -2.4, right: 2.4, top: 2.4, bottom: -2.4, near: 0.5, far: 20 });
  sun.shadow.bias = -0.0003; sun.shadow.normalBias = 0.012; sun.shadow.radius = 2.2;
  sun.target.position.set(0, 0, 0);
  scene.add(hemi, sun, sun.target, rim, fill);

  // screen-space HUD scenes: `hud` full screen, `hudS` scissored to the scrolling body
  function makeHud() {
    const s = new THREE.Scene();
    const l1 = new THREE.DirectionalLight(0xfff0d6, 1.7); l1.position.set(-500, 800, 1000);
    const l2 = new THREE.DirectionalLight(0xb8c8ff, 0.45); l2.position.set(700, -300, 600);
    s.add(new THREE.HemisphereLight(0xffe8c8, 0x2a1a10, 0.7), l1, l2);
    return { scene: s, panels: [], buttons: [] };
  }
  const hud = makeHud(), hudS = makeHud();
  const hudCam = new THREE.PerspectiveCamera();
  function setHudProjection(Wp, Hp) {
    const n = 1, f = 2200, m = hudCam.projectionMatrix;
    m.set(2 / Wp, 0, 0, -1, 0, 2 / Hp, 0, 1, 0, 0, -2 / (f - n), -(f + n) / (f - n), 0, 0, 0, 1);
    hudCam.projectionMatrixInverse.copy(m).invert();
  }
  function buildEnvMap() {
    const pm = new THREE.PMREMGenerator(renderer);
    const t = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture;
    pm.dispose();
    scene.environment = t; scene.environmentIntensity = 0.4;
    hud.scene.environment = t; hud.scene.environmentIntensity = 0.35;
    hudS.scene.environment = t; hudS.scene.environmentIntensity = 0.35;
  }

  // ---------------------------------------------------------------- HUD plaques / buttons
  const flatQuad = new THREE.PlaneGeometry(1, 1); flatQuad.rotateX(-Math.PI / 2);
  const geoCache = new Map();
  const slabG = (w, d, h, rad, bev) => {
    const k = `${Math.round(w)}|${Math.round(d)}|${h}|${Math.round(rad)}|${bev}`; let g = geoCache.get(k);
    if (!g) { if (geoCache.size > 160) { for (const v of geoCache.values()) v.dispose(); geoCache.clear(); } g = B.slab(w, d, h, rad, bev, { seg: 3, per: 5 }); geoCache.set(k, g); }
    return g;
  };
  const M = {
    woodDark: B.material('darkWood', { color: '#4a2a14', color2: '#7a4a26', repeat: [3, 2], size: 512, seed: 9 }),
    woodLight: B.material('wood', { color: '#c79a5c', color2: '#e7c58a', repeat: [3, 2], size: 512, seed: 4 }),
    brass: new THREE.MeshStandardMaterial({ color: '#d9a640', metalness: 0.9, roughness: 0.3, envMapIntensity: 1.4 }),
    insetDark: new THREE.MeshStandardMaterial({ color: '#1f130a', roughness: 0.92 }),
    insetLight: new THREE.MeshStandardMaterial({ color: '#f1e3c4', roughness: 0.9 }),
    stoneDim: new THREE.MeshStandardMaterial({ color: '#4a4038', roughness: 0.85 }),
  };
  const colCache = new Map();
  const phys = (color, o = {}) => { const k = color + JSON.stringify(o); let m = colCache.get(k); if (!m) { m = new THREE.MeshPhysicalMaterial({ color, roughness: 0.34, clearcoat: 1, clearcoatRoughness: 0.14, ...o }); colCache.set(k, m); } return m; };
  const std = (color, o = {}) => { const k = 's' + color + JSON.stringify(o); let m = colCache.get(k); if (!m) { m = new THREE.MeshStandardMaterial({ color, roughness: 0.9, ...o }); colCache.set(k, m); } return m; };
  const scrim = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0x120a04, transparent: true, opacity: 0, depthWrite: false }));
  hud.scene.add(scrim);
  const ROT = Math.PI / 2;

  function panelAt(h, i) {
    let p = h.panels[i];
    if (!p) { const g = new THREE.Group(), outer = new THREE.Mesh(flatQuad, M.woodDark), trim = new THREE.Mesh(flatQuad, M.brass), inner = new THREE.Mesh(flatQuad, M.insetDark); g.add(outer, trim, inner); h.scene.add(g); p = { g, outer, trim, inner }; h.panels.push(p); }
    return p;
  }
  function placePanel(h, i, e) {
    const p = panelAt(h, i), r = e.r, rad = e.rad; p.g.visible = true;
    const cx = r.x + r.w / 2, cy = -(r.y + r.h / 2), z = -700, tile = e.kind === 'sand' || e.kind === 'stone', dep = tile ? 9 : 14, ins = tile ? 5 : clamp(Math.min(r.w, r.h) * 0.07, 5, 9);
    p.outer.geometry = slabG(r.w, r.h, dep, rad, 5); p.outer.rotation.x = ROT; p.outer.position.set(cx, cy, z);
    p.trim.geometry = slabG(r.w - ins * 1.1, r.h - ins * 1.1, dep + 1.5, Math.max(4, rad - ins * 0.5), 1.6); p.trim.rotation.x = ROT; p.trim.position.set(cx, cy, z);
    p.inner.geometry = slabG(r.w - ins * 2.3, r.h - ins * 2.3, dep + 2.5, Math.max(3, rad - ins), 2.2); p.inner.rotation.x = ROT; p.inner.position.set(cx, cy, z);
    if (e.kind === 'sand') {
      p.outer.material = M.woodDark; p.trim.material = M.brass;
      p.inner.material = std(e.sand ? e.sand[0] : '#ecd3a0', { roughness: 0.95 });
    } else if (e.kind === 'stone') {
      p.outer.material = M.stoneDim; p.trim.material = M.stoneDim; p.inner.material = M.stoneDim;
    } else {
      p.outer.material = e.dark ? M.woodDark : M.woodLight; p.trim.material = M.brass; p.inner.material = e.dark ? M.insetDark : M.insetLight;
    }
  }
  function buttonAt(h, i) {
    let b = h.buttons[i];
    if (!b) { const g = new THREE.Group(), rimM = new THREE.Mesh(flatQuad, M.brass), body = new THREE.Mesh(flatQuad, M.woodDark); g.add(rimM, body); h.scene.add(g); b = { g, body, rim: rimM }; h.buttons.push(b); }
    return b;
  }
  function placeButton(h, i, e, pressed) {
    const b = buttonAt(h, i), r = e.r; b.g.visible = !e.ghost;
    if (e.ghost) return;
    const cx = r.x + r.w / 2, cy = -(r.y + r.h / 2), rad = Math.min(20, r.h / 3), z = -400, dep = pressed ? 8 : 17;
    b.rim.geometry = slabG(r.w, r.h, dep - 3, rad, 4); b.rim.rotation.x = ROT; b.rim.position.set(cx, cy, z);
    b.body.geometry = slabG(r.w - 7, r.h - 7, dep, rad - 2, 6); b.body.rotation.x = ROT; b.body.position.set(cx, cy, z);
    let body;
    if (e.primary) body = phys(e.color, { roughness: 0.28, emissive: e.color, emissiveIntensity: 0.12 });
    else if (e.on) body = phys(e.dark ? '#7a4a22' : '#e6b36a', { roughness: 0.3, emissive: e.color, emissiveIntensity: 0.25 });
    else body = e.dark ? phys('#3a2415', { roughness: 0.5, clearcoat: 0.6 }) : phys('#d6b27a', { roughness: 0.5, clearcoat: 0.6 });
    b.body.material = body;
    b.rim.material = M.brass;
    b.g.position.set(0, pressed ? -3 : 0, 0);
  }

  // ---------------------------------------------------------------- sand spray + camera
  const SPRAY = 56;
  const spray = new THREE.InstancedMesh(new THREE.SphereGeometry(0.0045, 5, 4), new THREE.MeshStandardMaterial({ color: '#e7c98b', roughness: 1 }), SPRAY);
  spray.frustumCulled = false; scene.add(spray);
  const grains = [];
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
  function emit(x, y, z, dx, dz, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, sp = 0.06 + Math.random() * 0.14;
      grains.push({ x, y, z, vx: dx * 0.08 + Math.cos(a) * sp, vy: 0.12 + Math.random() * 0.2, vz: dz * 0.08 + Math.sin(a) * sp, life: 0, max: 0.35 + Math.random() * 0.3 });
    }
    if (grains.length > SPRAY) grains.splice(0, grains.length - SPRAY);
  }
  function stepGrains(dt) {
    for (let i = grains.length - 1; i >= 0; i--) {
      const g = grains[i]; g.life += dt; g.vy -= 1.6 * dt; g.x += g.vx * dt; g.y += g.vy * dt; g.z += g.vz * dt;
      if (g.life >= g.max || g.y < 0.025) grains.splice(i, 1);
    }
    for (let i = 0; i < SPRAY; i++) {
      const g = grains[i];
      if (!g) _m.makeScale(0, 0, 0); else { _p.set(g.x, g.y, g.z); _s.setScalar(1); _m.compose(_p, _q, _s); }
      spray.setMatrixAt(i, _m);
    }
    spray.instanceMatrix.needsUpdate = true;
  }

  let W = 1, H = 1, dprNow = 1, hudW = 0, hudH = 0, L_ = null;
  function resize() {
    const w = Math.max(1, Math.floor(window.innerWidth)), h = Math.max(1, Math.floor(window.innerHeight));
    const dpr = Math.min(window.devicePixelRatio || 1, TIERS[tier].dpr);
    if (w !== W || h !== H || dpr !== dprNow) { W = w; H = h; dprNow = dpr; renderer.setPixelRatio(dpr); renderer.setSize(w, h, false); camera.aspect = w / h; }
  }
  const tmpV = new THREE.Vector3();
  // fit the plate (hw x hh) into a virtual-unit rect with pitch/yaw/fov; the projected box is centred in the rect
  function fitCamera(rect, hw, hh, pitchDeg, fov, yawDeg = 0, lookY = 0.02, shrink = 1) {
    const k = W / L_.w, tw = rect.w * k * shrink, th = rect.h * k * shrink, p = (pitchDeg * Math.PI) / 180, yaw = (yawDeg * Math.PI) / 180;
    camera.fov = fov; camera.clearViewOffset(); camera.aspect = W / H; camera.updateProjectionMatrix();
    let d = 6;
    const corners = [[-hw, 0, -hh], [hw, 0, -hh], [hw, 0, hh], [-hw, 0, hh], [-hw, 0.1, -hh], [hw, 0.1, hh]];
    let bb = null;
    const place = () => {
      camera.position.set(Math.sin(yaw) * Math.cos(p) * d, lookY + Math.sin(p) * d, Math.cos(yaw) * Math.cos(p) * d);
      camera.lookAt(0, lookY, 0); camera.updateMatrixWorld(); camera.updateProjectionMatrix();
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      for (const c of corners) { tmpV.set(c[0], c[1], c[2]).project(camera); const px = ((tmpV.x + 1) / 2) * W, py = ((1 - tmpV.y) / 2) * H; x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py); }
      bb = { x0, x1, y0, y1 };
    };
    for (let it = 0; it < 7; it++) { place(); d *= Math.max((bb.x1 - bb.x0) / tw, (bb.y1 - bb.y0) / th); }
    place();
    const cxp = (rect.x + rect.w / 2) * k, cyp = (rect.y + rect.h / 2) * k;
    camera.setViewOffset(W, H, (bb.x0 + bb.x1) / 2 - cxp, (bb.y0 + bb.y1) / 2 - cyp, W, H);
    camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  }
  const ray = new THREE.Vector3(), orig = new THREE.Vector3(), hit = new THREE.Vector3();
  v3.pick = (vx, vy) => {
    if (!L_) return -1;
    const ndcx = (vx / L_.w) * 2 - 1, ndcy = 1 - (vy / L_.h) * 2;
    orig.copy(camera.position); ray.set(ndcx, ndcy, 0.5).unproject(camera).sub(orig).normalize();
    if (Math.abs(ray.y) < 1e-5) return -1;
    const t = (0.03 - orig.y) / ray.y; if (t < 0) return -1;
    hit.copy(orig).addScaledVector(ray, t);
    return sand.cellAt(hit.x, hit.z);
  };

  // ---------------------------------------------------------------- frame
  let lastT = 0, clock = 0, frames = 0, ema = 16, finger = null, wonFor = null, handReady = false, tipPrev = null;
  createFinger({ scene, renderer, sand }).then((f) => { finger = f; handReady = !!f; }).catch((e) => { console.warn('hand unavailable', e); });

  function applyTier() {
    const t = TIERS[tier];
    renderer.shadowMap.enabled = t.shadow > 0; sun.castShadow = t.shadow > 0;
    if (t.shadow) { sun.shadow.mapSize.set(t.shadow, t.shadow); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
    W = 0;
    scene.traverse((o) => { if (o.material) { const ms = Array.isArray(o.material) ? o.material : [o.material]; ms.forEach((m) => { m.needsUpdate = true; }); } });
  }

  function prepare(state, L, dt) {
    resize(); L_ = L;
    if (hudW !== L.w || hudH !== L.h) { hudW = L.w; hudH = L.h; setHudProjection(L.w, L.h); }
    const look = getLook();
    const sc = state.scene, playing = (sc === 'play' || sc === 'over') && state.P;
    let f;
    if (playing) {
      const P = state.P;
      f = { W: P.L.W, H: P.L.H, cfg: P.cfg, locked: P.L.locked, struts: !!state.prefs.struts, hintCell: state.hint ? state.hint.cell : -1, focus: state.focus, win: !!P.done || sc === 'over', quick: state.auto.on };
    } else {
      const cfg = v3.heroCfg || heroCfg(state.t);
      f = { W: 5, H: 5, cfg, locked: null, struts: false, hintCell: -1, focus: -1, win: trace(5, 5, cfg).count === 1 };
    }
    f.lookObj = look; f.calm = !!state.prefs.calm;
    let out = sand.sync(f, dt, clock);
    if (qs.has('dev') && window.__dbgTip) out = { drawing: true, x: window.__dbgTip.x, z: window.__dbgTip.z };
    const hw = (f.W + 2 * 0.66) * CELL / 2, hh = (f.H + 2 * 0.66) * CELL / 2;
    const drift = state.prefs.calm ? 0 : Math.sin(clock * 0.2);
    if (playing) {
      const r0 = v3.fieldRect || { x: L.w * 0.04, y: L.h * 0.14, w: L.w * 0.92, h: L.w * 0.92 };
      const rh = L.w < L.h ? Math.min(r0.h, r0.w * 1.04) : r0.h, rect = { x: r0.x, y: r0.y + r0.h - rh, w: r0.w, h: rh };
      fitCamera(rect, hw, hh, L.land ? 56 : 72, L.land ? 30 : 34, 0, 0.02, 1.0);
    } else if (sc === 'title' || sc === 'demo-limit') {
      const hr = v3.heroRect || { x: L.w * 0.06, y: L.h * 0.06, w: L.w * 0.88, h: L.h * 0.4 };
      fitCamera(hr, hw, hh, 34, 38, drift * 7, 0.02, 0.9);
    } else {
      fitCamera({ x: L.w * 0.08, y: L.h * 0.1, w: L.w * 0.84, h: L.h * 0.4 }, hw, hh, 44, 34, drift * 5, 0.02, 0.9);
    }
    if (qs.has('dev') && window.__dbgCam) { const c = window.__dbgCam; camera.clearViewOffset(); camera.fov = c.fov || 30; camera.updateProjectionMatrix(); camera.position.set(...c.pos); camera.lookAt(...c.look); camera.updateMatrixWorld(); }
    if (finger && !(qs.has('dev') && window.__dbgNoHand)) {
      const tip = out && out.drawing ? out : null;
      finger.update(tip, dt, clock, camera);
      if (tip) emit(tip.x, 0.034, tip.z, tipPrev ? tip.x - tipPrev.x : 0, tipPrev ? tip.z - tipPrev.z : 0, 2);
      tipPrev = tip ? { x: tip.x, z: tip.z } : null;
    }
    const won = playing && f.win ? state.P : null;
    if (won && wonFor !== won) { wonFor = won; world.cheer(); } else if (!won) wonFor = null;
    v3.scrimTarget = (sc === 'doc' || sc === 'levels' || sc === 'settings') ? 0.55 : sc === 'demo-limit' ? 0.4 : 0;
  }

  function scissorRect(c) {
    const k = W / L_.w;
    return { x: Math.round(c.x * k * dprNow), y: Math.round((H - (c.y + c.h) * k) * dprNow), w: Math.round(c.w * k * dprNow), h: Math.round(c.h * k * dprNow) };
  }
  function present(state, L, dt) {
    world.update(dt, camera, !!state.prefs.calm);
    stepGrains(dt);
    const pr = v3.pressed, hitBtn = (e) => !!pr && pr.x >= e.r.x && pr.x <= e.r.x + e.r.w && pr.y >= e.r.y && pr.y <= e.r.y + e.r.h;
    let n = 0, ns = 0, clipR = null;
    for (const e of v3.panels) { if (e.clip) { clipR = e.clip; placePanel(hudS, ns++, e); } else placePanel(hud, n++, e); }
    for (let i = n; i < hud.panels.length; i++) hud.panels[i].g.visible = false;
    for (let i = ns; i < hudS.panels.length; i++) hudS.panels[i].g.visible = false;
    n = 0; let nb = 0;
    for (const e of v3.buttons) { if (e.clip) { clipR = e.clip; placeButton(hudS, nb++, e, hitBtn(e)); } else placeButton(hud, n++, e, hitBtn(e)); }
    for (let i = n; i < hud.buttons.length; i++) hud.buttons[i].g.visible = false;
    for (let i = nb; i < hudS.buttons.length; i++) hudS.buttons[i].g.visible = false;
    const sTarget = Math.max(v3.scrim, v3.scrimTarget || 0);
    scrim.visible = sTarget > 0; scrim.material.opacity = sTarget; scrim.scale.set(L.w * 2, L.h * 2, 1); scrim.position.set(L.w / 2, -L.h / 2, -520);
    renderer.setViewport(0, 0, W, H);
    renderer.setScissorTest(false);
    renderer.clear(true, true, true);
    renderer.render(scene, camera);
    renderer.clearDepth();
    renderer.render(hud.scene, hudCam);
    if (clipR && (ns > 0 || nb > 0)) {
      const s = scissorRect(clipR);
      renderer.clearDepth();
      renderer.setScissorTest(true); renderer.setScissor(s.x, s.y, s.w, s.h);
      renderer.render(hudS.scene, hudCam);
      renderer.setScissorTest(false);
    }
  }

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); v3.on = false; });
  canvas.addEventListener('webglcontextrestored', () => {
    try { buildEnvMap(); } catch (e) { /* no reflections, still playable */ }
    try { sand.forceRepaint(); } catch (e) { /* repaint on next frame */ }
    W = 0; resize(); v3.on = true;
  });

  try { buildEnvMap(); applyTier(); } catch (e) { console.warn('3D init failed; 2D fallback', e); canvas.remove(); v3.on = false; return noop; }
  v3.on = true;

  return {
    ok: true, renderer, scene, camera, sand, world,
    get handReady() { return handReady; },
    get finger() { return finger; },
    wrap(game) {
      return Object.assign({}, game, {
        update(dt, input) {
          const p = input.pointer; v3.pressed = p && p.down ? { x: p.x, y: p.y } : null;
          return game.update(dt, input);
        },
        render(ctx, view) {
          const state = game.getState();
          if (!v3.on) { game.render(ctx, view); return; }
          const L = { w: view?.width ?? 720, h: view?.height ?? 1560 };
          const now = performance.now(), dt = Math.min(0.1, Math.max(0, (now - lastT) / 1000)); lastT = now; clock += dt;
          ema = ema * 0.95 + dt * 1000 * 0.05; frames++;
          if (frames > 90 && ema > 30 && tier < TIERS.length - 1) { tier++; applyTier(); frames = 0; ema = 16; }
          v3.panels.length = 0; v3.buttons.length = 0; v3.scrim = 0;
          try { prepare(state, L, dt); } catch (e) { console.warn('3D prepare failed', e); v3.on = false; game.render(ctx, view); return; }
          if (qs.has('dev') && window.__dbgNoUI) { ctx.clearRect(0, 0, L.w, L.h); } else game.render(ctx, view);
          try { present(state, L, dt); } catch (e) { console.warn('3D present failed', e); v3.on = false; }
        },
      });
    },
  };
}

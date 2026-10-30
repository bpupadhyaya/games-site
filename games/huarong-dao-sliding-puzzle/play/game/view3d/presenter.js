// Huarong Dao 3D presenter. READS the game state (game.peek()), never writes it. One WebGL canvas sits behind the kit's
// transparent 2D canvas: the pass at night (carved-lacquer blocks on a stone road inside a black-lacquer tray, the gate in the
// near rail with torchlight outside, a red brocade mat on a slate table, cool moonlight from the far left).
// The camera is orthographic and tilted (world.TILT), with its frustum scaled so that the table plane maps 1:1 onto the 2D
// layout; the whole tray is shifted so the TOP faces of the blocks land exactly where the 2D hit-testing expects them
// (z = screen y + height * tan(tilt)). Input code is untouched. Landing-cell glows are 3D; route arrows, dashed outlines,
// particles and every button stay on the 2D layer. No WebGL, ?flat=1 or a lost context: v3.on = false and the flat art draws;
// a restored context rebuilds everything.
import * as THREE from '../vendor3d/three.js';
import { v3 } from '../src/v3.js';
import { meta } from '../src/game.js';
import { LAY } from '../src/layout.js';
import { attractState, HDLM_PIECES } from '../src/view.js';
import { movesFor } from '../src/puzzle.js';
import { DIMS } from '../src/engine.js';
import * as W from './world.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TIERS = [{ name: 'high', dpr: 2, shadow: 2048 }, { name: 'medium', dpr: 1.5, shadow: 1024 }, { name: 'low', dpr: 1, shadow: 0 }];
const tick = () => new Promise((r) => setTimeout(r, 0));
const GOLD = new THREE.Color(0xffd27a), PALE = new THREE.Color(0xfff0c0);

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
  renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  let tier = qs.has('tier') ? clamp(Number(qs.get('tier')), 0, 2) : (navigator.hardwareConcurrency || 8) <= 4 ? 1 : 0;
  await tick();

  // ---------------------------------------------------------------- scene, camera, lights
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x101418);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 12000);
  const D = 5000;
  camera.position.set(0, D * Math.cos(W.TILT), D * Math.sin(W.TILT));
  camera.up.set(0, Math.sin(W.TILT), -Math.cos(W.TILT));
  camera.lookAt(0, 0, 0);
  const moon = new THREE.SpotLight(0xdfe6ff, 3.2, 0, 0.6, 0.8, 0);       // cool key from the far left, casts the shadows
  moon.shadow.bias = -0.0004; moon.shadow.normalBias = 0.8; moon.shadow.radius = 4;
  const warm = new THREE.DirectionalLight(0xffc48a, 0.75);                // warm fill from the near right (a lamp out of frame)
  const hemi = new THREE.HemisphereLight(0xa8b8d8, 0x2a1810, 0.45);
  const torch = new THREE.PointLight(0xff9a40, 0, 0, 2);                  // torchlight outside the gate
  const ember = new THREE.PointLight(0xff8a3a, 0, 0, 2);                  // the incense burner's glow (title)
  scene.add(moon, moon.target, warm, warm.target, hemi, torch, ember);
  const buildEnv = () => { try { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; pm.dispose(); scene.environmentIntensity = 0.3; } catch { /* no IBL */ } };
  buildEnv();
  await tick();
  let glow = W.glowTex(), smoke = W.smokeTex();
  W.materials(); await tick();

  const world = new THREE.Group(); scene.add(world);
  // per-screen parts
  let tableKey = '', tableGrp = null, trayGrp = null, propsGrp = null, burner = null, mode = '';
  let blocks = [], blocksKey = '';
  const trayRoot = new THREE.Group(); world.add(trayRoot);     // shifted in z so block tops map onto the 2D rects
  const glows = []; for (let i = 0; i < 12; i++) { const g = W.cellGlow(); g.visible = false; trayRoot.add(g); glows.push(g); }
  const gateGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: 0xffa050, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.6 }));
  gateGlow.renderOrder = 3; trayRoot.add(gateGlow);
  const SN = 16, smokes = [];
  for (let i = 0; i < SN; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: smoke, transparent: true, depthWrite: false, opacity: 0 })); sp.userData.seed = i / SN; smokes.push(sp); world.add(sp); }
  const dropGroup = (g) => { if (!g) return; g.parent?.remove(g); W.disposeTree(g); };

  // ---------------------------------------------------------------- view mapping (virtual units <-> css)
  const cssW = () => Math.max(1, window.innerWidth), cssH = () => Math.max(1, window.innerHeight);
  const cpu = () => meta.cssPerUnit || Math.min(cssW() / meta.width, cssH() / meta.height);
  function viewRect() {
    const c = cpu(), ox = (cssW() - meta.width * c) / 2, oy = (cssH() - meta.height * c) / 2;
    return { x0: -ox / c, x1: (cssW() - ox) / c, y0: -oy / c, y1: (cssH() - oy) / c };
  }
  let lightKey = '';
  function fitCamera(R) {
    const cs = Math.cos(W.TILT);
    camera.left = R.x0; camera.right = R.x1; camera.top = -R.y0 * cs; camera.bottom = -R.y1 * cs;
    camera.updateProjectionMatrix();
    const k = `${R.x0.toFixed(1)}|${R.x1.toFixed(1)}|${R.y0.toFixed(1)}|${R.y1.toFixed(1)}`;
    if (k === lightKey) return; lightKey = k;
    const cx = (R.x0 + R.x1) / 2, cz = (R.y0 + R.y1) / 2, ext = Math.hypot(R.x1 - R.x0, R.y1 - R.y0) / 2, dist = ext * 2.6;
    moon.position.set(cx - dist * 0.55, dist, cz - dist * 0.5); moon.target.position.set(cx, 0, cz + ext * 0.05);
    moon.angle = Math.atan((ext * 1.2) / (dist * 1.2)); moon.penumbra = 0.85;
    Object.assign(moon.shadow.camera, { near: dist * 0.5, far: dist * 1.7 }); moon.shadow.camera.updateProjectionMatrix();
    warm.position.set(cx + ext, ext * 0.8, cz + ext * 1.4); warm.target.position.set(cx, 0, cz);
  }

  // ---------------------------------------------------------------- tiers
  let vk = '';
  function applyTier() {
    const t = TIERS[tier];
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, t.dpr));
    renderer.shadowMap.enabled = t.shadow > 0; moon.castShadow = t.shadow > 0;
    if (t.shadow) { moon.shadow.mapSize.set(t.shadow, t.shadow); if (moon.shadow.map) { moon.shadow.map.dispose(); moon.shadow.map = null; } }
    scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { m.needsUpdate = true; }); });
    vk = '';
  }
  applyTier();

  // ---------------------------------------------------------------- builders
  // geo: { F: frame rect, B: board rect, c: cell } for the current screen (play: the live layout; title: the hero board)
  function heroGeo() {
    const Tb = LAY.title && LAY.title.board;
    if (!Tb || !(Tb.k > 0)) return null;
    const k = Tb.k, c = 154 * k;
    return { c, B: { x: Tb.x, y: Tb.y, w: 4 * c, h: 5 * c }, F: { x: Tb.x - 30 * k, y: Tb.y - 30 * k, w: 676 * k, h: 858 * k } };
  }
  function buildScene(R, md, geo) {
    const k = `${md}|${LAY.key}|${geo ? `${geo.B.x.toFixed(1)},${geo.B.y.toFixed(1)},${geo.c.toFixed(2)}` : '-'}|${R.x0.toFixed(0)}|${R.y0.toFixed(0)}|${R.x1.toFixed(0)}|${R.y1.toFixed(0)}`;
    if (k === tableKey) return;
    tableKey = k; mode = md;
    dropGroup(tableGrp); dropGroup(trayGrp); dropGroup(propsGrp); tableGrp = trayGrp = propsGrp = burner = null;
    const pad = 600;
    const zoff = geo ? W.T * geo.c * W.TAN : 0;
    trayRoot.position.set(0, 0, zoff);
    const under = geo ? -(W.BASE + 0.035) * geo.c - 1 : 0;
    tableGrp = W.table(R.x0 - pad, R.y0 - pad, R.x1 - R.x0 + 2 * pad, R.y1 - R.y0 + 2 * pad + 400, geo ? geo.F : null);
    tableGrp.position.set(0, under - 2, zoff); world.add(tableGrp);
    if (geo) { trayGrp = W.tray(geo.F, geo.B, geo.c); trayRoot.add(trayGrp); }
    if (false && md !== 'play' && geo) {
      // title props beside the hero board, at the board's scale (a 2.5 cm cell)
      const cm = geo.c / 2.5;
      propsGrp = new THREE.Group();
      burner = W.incense(cm * 0.9);
      const left = geo.F.x - R.x0, right = R.x1 - (geo.F.x + geo.F.w);
      const bx = right > left ? geo.F.x + geo.F.w + Math.max(4.2 * cm, right * 0.42) : geo.F.x - Math.max(4.2 * cm, left * 0.42);
      burner.position.set(bx, 0, geo.F.y + geo.F.h * 0.2); propsGrp.add(burner);
      const sc = W.scroll(cm * 0.9); sc.rotation.y = 0.5;
      const sx = right > left ? geo.F.x - Math.max(3 * cm, left * 0.3) : geo.F.x + geo.F.w + Math.max(3 * cm, right * 0.3);
      sc.position.set(sx, 0, geo.F.y + geo.F.h * 0.82); propsGrp.add(sc);
      propsGrp.position.set(0, under, zoff);
      world.add(propsGrp);
    }
  }
  function syncBlocks(pieces, lang, key) {
    const k = `${key}|${lang}|${pieces.map((p) => W.blockKey(p, lang)).join(',')}`;
    if (k === blocksKey) return;
    blocksKey = k;
    for (const b of blocks) { trayRoot.remove(b.pivot); b.top.dispose(); b.side.dispose(); }
    blocks = pieces.map((p) => { const b = W.makeBlock(p, lang); trayRoot.add(b.pivot); return b; });
  }
  const hideBlocks = () => { for (const b of blocks) b.pivot.visible = false; };

  // place a block: top-left cell (cx, cy), lift in cells, scale bump, x shake in px, fade
  function placeBlock(b, geo, cx, cy, lift, sc, shake, fade) {
    const c = geo.c, [w, h] = DIMS[b.t];
    const y = lift * c;
    b.pivot.position.set(geo.B.x + (cx + w / 2) * c + shake, y, geo.B.y + (cy + h / 2) * c + y * W.TAN);
    b.mesh.position.set(-w / 2, 0, -h / 2);
    b.pivot.scale.set(c * sc, c, c * sc);
    b.pivot.visible = fade > 0.01;
    b.setFade(fade);
  }

  // ---------------------------------------------------------------- per-frame pose
  let game = null, lost = false, lastNow = 0, clock = 0, frameAvg = 16, slowFrames = 0, fadeIn = 0;
  function pre() {
    if (!game || lost) return;
    const S = game.peek(), R = viewRect();
    fitCamera(R);
    const play = (S.scene === 'play' || S.scene === 'auto') && S.puz;
    const geo = play ? { c: LAY.cell, B: { ...LAY.board }, F: { ...LAY.frame } } : heroGeo();
    buildScene(R, play ? 'play' : 'title', geo);
    const t = S.t, pulse = 0.5 + 0.5 * Math.sin(t * 5);
    for (const g of glows) g.visible = false;
    torch.intensity = 0; ember.intensity = 0;
    if (!geo) { hideBlocks(); gateGlow.visible = false; }
    if (geo) {
      const c = geo.c, zoff = W.T * c * W.TAN;
      // torchlight outside the gate (soft flicker)
      const fl = 0.85 + 0.08 * Math.sin(t * 9.3) + 0.05 * Math.sin(t * 15.1 + 1) + 0.03 * Math.sin(t * 23.7);
      const gx = geo.B.x + 2 * c, gz = geo.F.y + geo.F.h + c * 0.35;
      torch.position.set(gx, c * 0.45, gz + zoff); torch.intensity = 26000 * fl * (c / 154) ** 2;
      gateGlow.visible = true; gateGlow.position.set(gx, c * 0.05, geo.F.y + geo.F.h + c * 0.1); gateGlow.scale.set(c * 2.6, c * 1.2, 1); gateGlow.material.opacity = 0.42 * fl;
    }
    if (play && geo) {
      const puz = S.puz, auto = S.scene === 'auto' ? S.auto : null, c = geo.c;
      syncBlocks(puz.pieces, S.lang, puz.level.id);
      const cao = puz.pieces.find((q) => q.t === 'C');
      const goalGlow = puz.done ? 0.5 + 0.4 * Math.sin(t * 6) : 0.06 + 0.05 * Math.sin(t * 2.2);
      W.materials().road.emissive.setRGB(goalGlow, goalGlow * 0.72, goalGlow * 0.3);
      puz.pieces.forEach((p, i) => {
        const b = blocks[i];
        let sc = 1 + 0.03 * p.lift; if (p.pop > 0) sc *= 1 + 0.04 * Math.sin(p.pop * Math.PI);
        const shake = p.shake > 0 ? Math.sin(p.shake * 60) * 7 * p.shake : 0;
        let cy = p.dy, fade = 1;
        if (p === cao && puz.exit > 0) { const e = puz.exit * puz.exit * (3 - 2 * puz.exit); cy += e * 1.5; fade = 1 - e * 0.95; }
        placeBlock(b, geo, p.dx, cy, p.lift * 0.2, sc, shake, fade);
        // glows: selection, Think, Watch & Learn scan / reveal, the solved Commander
        const hintPiece = puz.hint && puz.hint.id === i;
        const scanning = auto && auto.phase === 'think' && auto.scan === i;
        const chosen = auto && auto.phase === 'reveal' && auto.move && auto.move.id === i;
        let e = 0, col = GOLD;
        if (puz.selected === i && !auto) e = 0.16 + 0.08 * Math.sin(t * 6);
        if (hintPiece || chosen) { e = 0.14 + 0.16 * pulse; col = PALE; }
        if (scanning) e = 0.08 + 0.08 * pulse;
        if (puz.done && p === cao) e = 0.2 + 0.15 * Math.sin(t * 6);
        b.top.emissive.copy(col).multiplyScalar(e); b.side.emissive.copy(col).multiplyScalar(e * 0.5);
      });
      // landing-cell glows on the road
      let gi = 0;
      const glowAt = (p, x, y, a, colr) => {
        if (gi >= glows.length) return;
        const g = glows[gi++], [w, h] = DIMS[p.t], q = 0.06;
        g.visible = true; g.position.set(geo.B.x + (x + q) * c, 0.6, geo.B.y + (y + q) * c); g.scale.set((w - 2 * q) * c, 1, (h - 2 * q) * c);
        g.material.opacity = a; g.material.color.set(colr);
      };
      const sel = puz.pieces[puz.selected];
      if (sel && !puz.done && !auto) for (const mv of movesFor(puz, sel.id)) glowAt(sel, mv.x, mv.y, 0.32 + 0.12 * pulse, 0xffd98a);
      if (puz.drag && puz.drag.moved && !puz.done) glowAt(puz.pieces[puz.drag.id], puz.drag.cur.x, puz.drag.cur.y, 0.7, 0xfff0b0);
      if (puz.hint) glowAt(puz.pieces[puz.hint.id], puz.hint.x, puz.hint.y, 0.35 + 0.4 * pulse, 0xfff3c8);
    } else if (geo) {
      // title: the famous opening plays by itself; documents: the board rests in its start position
      W.materials().road.emissive.setRGB(0.06, 0.045, 0.02);
      const docs = S.scene !== 'title';
      const A = attractState(docs ? 0 : t);
      syncBlocks(HDLM_PIECES(), S.lang, 'title');
      A.pieces.forEach((p, i) => placeBlock(blocks[i], geo, p.dx, p.dy, A.lift.has(p.id) ? 0.16 : 0, 1, 0, 1));
      for (const b of blocks) { b.top.emissive.setRGB(0, 0, 0); b.side.emissive.setRGB(0, 0, 0); }
    }
    // incense: ember glow and rising smoke
    if (burner) {
      const top = burner.userData.top, bp = burner.position, base = propsGrp.position;
      ember.position.set(bp.x, base.y + top * 0.9, bp.z + base.z + top * 0.9 * W.TAN); ember.intensity = 4000 * (geo.c / 154) ** 2 * (0.9 + 0.1 * Math.sin(t * 3));
      for (const sp of smokes) {
        const u = (clock * 0.09 + sp.userData.seed) % 1, h = top + u * geo.c * 3.2;
        const sway = Math.sin(clock * 0.7 + sp.userData.seed * 9) * geo.c * 0.18 * u + Math.sin(u * 7 + clock * 0.4) * geo.c * 0.06;
        sp.visible = true;
        sp.position.set(bp.x + sway, base.y + h, bp.z + base.z + h * W.TAN);
        const s = geo.c * (0.25 + u * 0.9); sp.scale.set(s, s, 1);
        sp.material.opacity = 0.5 * Math.sin(Math.PI * u) * (1 - u * 0.4);
        sp.material.rotation = sp.userData.seed * 6 + u * 1.5;
      }
    } else for (const sp of smokes) sp.visible = false;
  }
  function post() {
    if (!game || lost) return;
    const now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1); lastNow = now;
    clock += dt;
    const k = `${cssW()}x${cssH()}`; if (k !== vk) { vk = k; renderer.setSize(cssW(), cssH(), false); }
    if (fadeIn < 1) { fadeIn = Math.min(1, fadeIn + dt / 0.4); v3.fade = fadeIn; }
    renderer.render(scene, camera);
    const ft = dt * 1000; if (ft > 0) frameAvg = frameAvg * 0.95 + ft * 0.05;
    if (frameAvg > 26 && tier < 2) { if (++slowFrames > 90) { tier++; slowFrames = 0; frameAvg = 16; applyTier(); } } else slowFrames = 0;
  }

  // ---------------------------------------------------------------- context loss: the flat art takes over, then back to 3D
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; v3.on = false; canvas.style.visibility = 'hidden'; });
  canvas.addEventListener('webglcontextrestored', () => {
    lost = false; buildEnv();
    dropGroup(tableGrp); dropGroup(trayGrp); dropGroup(propsGrp); tableGrp = trayGrp = propsGrp = burner = null; tableKey = '';
    for (const b of blocks) trayRoot.remove(b.pivot); blocks = []; blocksKey = '';
    W.disposeAll(); glow.dispose(); smoke.dispose(); glow = W.glowTex(); smoke = W.smokeTex();
    gateGlow.material.map = glow; for (const sp of smokes) sp.material.map = smoke;
    for (const g of glows) { g.material.dispose(); g.material = W.materials().cellGlow.clone(); }
    applyTier(); fadeIn = 0; v3.fade = 0; v3.on = true; canvas.style.visibility = 'visible'; lightKey = '';
  });

  return {
    ok: true, renderer, scene, camera,
    attach(g) { game = g; v3.on = true; v3.fade = 0; fadeIn = 0; canvas.style.visibility = 'visible'; },
    pre, post,
    get tier() { return TIERS[tier].name; },
    get mode() { return mode; },
    loseContext() { const ext = renderer.getContext().getExtension('WEBGL_lose_context'); ext?.loseContext(); return ext; },
    restoreContext() { const ext = renderer.getContext().getExtension('WEBGL_lose_context'); ext?.restoreContext(); return ext; },
  };
}

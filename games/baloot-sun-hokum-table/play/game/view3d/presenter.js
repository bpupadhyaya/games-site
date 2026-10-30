// Baloot 3D presenter. READS the game state (getState) and the 2D view's hand-off (src/v3.js); never writes the sim.
// One WebGL canvas behind the kit's transparent 2D canvas: a night diwaniya, the low indigo-clothed table, every card that lies on it.
// The 2D layout stays the authority for where things are: each card the 2D view would have drawn on the table (v3.cards) is cast through the
// tilted camera onto the cloth, so the trick cross, the turned-up card, the opponents' hands and the sweep to the winner sit exactly where
// the layout put them, now in perspective with shadows. Your own hand, the buttons and the HUD plaques stay 2D (they are what you tap).
// No WebGL, ?flat=1 or a lost context: v3.on = false and every screen draws the flat 2D art; a restored context returns to 3D.
import * as THREE from '../vendor3d/three.js';
import { v3 } from '../src/v3.js';
import { layoutFor, CW } from '../src/layout.js';
import { meta } from '../src/game.js';
import { cardSprite, backSprite } from '../src/art.js';
import {
  CARD_W, CARD_H, CLOTH_Y, RIM_TOP, hash, radialTex, makeMats, makeTable, makeTray, makeIncense, makeCushion, makeBolster,
  makeLantern, buildRoom, buildLights, makeCardMesh,
} from './world.js';

const TAU = Math.PI * 2, D2R = Math.PI / 180;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TIERS = [{ name: 'high', dpr: 2, shadow: 2048 }, { name: 'medium', dpr: 1.5, shadow: 1024 }, { name: 'low', dpr: 1, shadow: 0 }];
const tick = () => new Promise((r) => setTimeout(r, 0));
const POOL = 36, GLOWS = 8;
export const HERO_CARDS = [7, 12, 10, 22, 27];   // the title fan (suit * 8 + rank, as in the flat title): ace of spades, jack of hearts, ...
const FOG = 0x140e18;

export async function createPresenter({ kitCanvas, getState }) {
  const qs = new URLSearchParams(location.search);
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;height:100dvh;display:block;pointer-events:none;z-index:0;visibility:hidden';
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' }); } catch (e) { console.warn('WebGL unavailable; flat 2D art', e); return { ok: false }; }
  if (!renderer.getContext()) return { ok: false };
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  let tier = qs.has('tier') ? clamp(Number(qs.get('tier')), 0, 2) : (navigator.hardwareConcurrency || 8) <= 4 ? 1 : 0;

  await tick();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(FOG); scene.fog = new THREE.Fog(FOG, 420, 1500);
  const camera = new THREE.PerspectiveCamera(28, 1, 4, 4000);
  const lights = buildLights(scene);
  const buildEnv = () => { try { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new THREE.RoomEnvironment(), 0.04).texture; pm.dispose(); scene.environmentIntensity = 0.28; } catch { /* no IBL */ } };
  buildEnv();
  await tick();
  const M = makeMats();
  scene.add(buildRoom(M));
  await tick();

  // ---- the two table variants (a long table seen from its end in portrait, a wide one in landscape)
  const glowTex = radialTex('255,190,100', 0.9, 128), smokeTex = radialTex('230,230,240', 0.7, 64);
  const variants = {};
  function buildVariant(o) {
    const tw = o === 'p' ? 70 : 108, tl = o === 'p' ? 108 : 72, g = new THREE.Group(); g.visible = false;
    const table = makeTable(tw, tl, M); g.add(table); const W = table.userData.W, L = table.userData.L;
    const pal = [['#121c44', '#182560', '#c9a24a'], ['#3a1424', '#4c1c2e', '#c9a24a'], ['#0d302f', '#134240', '#c9a24a']];
    const seat = (x, z, bx, bz, rotY, w, d, i) => {
      const [a, b, c] = pal[i % 3], cu = makeCushion(w, d, 11, a, b, c, 30 + i); cu.position.set(x, 0, z); g.add(cu);
      const p2 = pal[(i + 1) % 3], bo = makeBolster(rotY ? d * 0.92 : w * 0.92, 6.5, p2[0], p2[1], p2[2], 50 + i); bo.position.set(bx, 7, bz); bo.rotation.y = rotY; g.add(bo);
    };
    seat(0, -(L / 2 + 46), 0, -(L / 2 + 70), 0, 58, 34, 0);
    seat(-(W / 2 + 30), 0, -(W / 2 + 54), 0, Math.PI / 2, 34, 58, 1);
    seat(W / 2 + 30, 0, W / 2 + 54, 0, Math.PI / 2, 34, 58, 2);
    // brass tray with the dallah and finjan cups on the far-left corner of the cloth, the incense burner on the far-right one
    const tray = makeTray(M, 0.62, true); tray.position.set(-(tw / 2 - 9.5), CLOTH_Y, -(tl / 2 - 9.5)); tray.rotation.y = 0.3; g.add(tray);
    const inc = makeIncense(M, 0.85); inc.position.set(tw / 2 - 6.5, CLOTH_Y, -(tl / 2 - 6.5)); g.add(inc);
    const floorTray = makeTray(M, 0.95, true); floorTray.position.set(-(W / 2 + 32), 0, o === 'l' ? 40 : 74); g.add(floorTray);
    const lanterns = [-1, 1].map((sx) => { const l = makeLantern(M, glowTex, 1); l.position.set(sx * (W / 2 + 18), 64, -(L / 2 + 12)); g.add(l); return l; });
    scene.add(g);
    return { g, tw, tl, W, L, tray, inc, lanterns, key: o };
  }
  const ensureVariant = (o) => variants[o] || (variants[o] = buildVariant(o));
  const initO = (meta.width >= meta.height) ? 'l' : 'p';
  ensureVariant(initO); await tick();

  // ---- card meshes + textures
  const texCache = new Map();
  const texFor = (card, big, four) => {
    const key = card < 0 ? -1 : card + (big ? 100 : 0) + (four ? 200 : 0); let t = texCache.get(key);
    if (!t) { const spr = card < 0 ? backSprite() : cardSprite(card, big, four); if (!spr) return null; t = new THREE.Texture(spr); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; t.needsUpdate = true; texCache.set(key, t); }
    return t;
  };
  const backTex = texFor(-1, false, false) || new THREE.Texture();
  const cards = [];
  for (let i = 0; i < POOL; i++) { const m = makeCardMesh(backTex, backTex); m.visible = false; scene.add(m); cards.push(m); }
  const glows = Array.from({ length: GLOWS }, () => { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: radialTex('255,224,138', 1, 64), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })); m.rotation.x = -Math.PI / 2; m.visible = false; m.renderOrder = 3; scene.add(m); return m; });
  // the title's fan of five, leaning above the cloth
  const fan = new THREE.Group(); fan.visible = false; scene.add(fan);
  fan.userData.noShadow = true;
  const fanBlob = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: radialTex('0,0,12', 0.8, 128), transparent: true, depthWrite: false, fog: false })); fanBlob.rotation.x = -Math.PI / 2; fanBlob.visible = false; fanBlob.renderOrder = 2; scene.add(fanBlob);
  const fanCards = HERO_CARDS.map((id, i) => { const piv = new THREE.Group(), cm = makeCardMesh(backTex, backTex); cm.position.z = -CARD_H / 2; piv.add(cm); fan.add(piv); return { piv, cm, id, i }; });

  // ---- particles: dust in the lantern light, steam from the dallah, smoke from the incense
  const MOTES = 80, moteGeo = new THREE.BufferGeometry(), moteP = new Float32Array(MOTES * 3); moteGeo.setAttribute('position', new THREE.BufferAttribute(moteP, 3));
  const motes = new THREE.Points(moteGeo, new THREE.PointsMaterial({ map: radialTex('255,214,150', 1, 32), size: 1.3, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.5, fog: false })); motes.frustumCulled = false; scene.add(motes);
  const puffs = Array.from({ length: 14 }, () => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, transparent: true, depthWrite: false, opacity: 0, fog: false })); s.visible = false; scene.add(s); return s; });

  function applyTier() {
    const t = TIERS[tier];
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, t.dpr));
    renderer.shadowMap.enabled = t.shadow > 0; lights.key.castShadow = t.shadow > 0;
    if (t.shadow) { lights.key.shadow.mapSize.set(t.shadow, t.shadow); if (lights.key.shadow.map) { lights.key.shadow.map.dispose(); lights.key.shadow.map = null; } }
    scene.traverse((o) => { if (o.material) [].concat(o.material).forEach((m) => { m.needsUpdate = true; }); });
  }

  // ---------------------------------------------------------------- camera: tilt / yaw / fov per screen, distance + off-axis shift fitted to a rectangle
  const cur = { yaw: 0, tilt: 60, fov: 28, dist: 200, ox: 0, oy: 0, tx: 0, ty: CLOTH_Y, tz: 0 };
  let snap = true, viewKey = '', varKey = initO;
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
    const p = { ...base, ox: 0, oy: 0, dist: 200 }, q = { x: 0, y: 0 }; let bb = null;
    for (let it = 0; it < 12; it++) {
      place(fitCam, p); bb = { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 };
      for (const [x, y, z] of pts) { toCss(fitCam, x, y, z, q); bb.x0 = Math.min(bb.x0, q.x); bb.x1 = Math.max(bb.x1, q.x); bb.y0 = Math.min(bb.y0, q.y); bb.y1 = Math.max(bb.y1, q.y); }
      const s = Math.min(rc.w / Math.max(1, bb.x1 - bb.x0), rc.h / Math.max(1, bb.y1 - bb.y0));
      if (Math.abs(s - 1) < 0.002) break; p.dist /= s;
    }
    p.ox = (bb.x0 + bb.x1) / 2 - (rc.x + rc.w / 2); p.oy = (bb.y0 + bb.y1) / 2 - (rc.y + rc.h / 2);
    return p;
  }
  const cpu = () => Math.min(cssW(), cssH()) / 720;
  const offX = () => (cssW() - meta.width * cpu()) / 2, offY = () => (cssH() - meta.height * cpu()) / 2;
  const rectCss = (r) => ({ x: r.x * cpu() + offX(), y: r.y * cpu() + offY(), w: r.w * cpu(), h: r.h * cpu() });

  const tableScene = (S) => S.scene === 'play' || S.scene === 'lesson' || S.scene === 'daily' || S.scene === 'auto';
  const cornerPts = (V) => { const x = V.W / 2, z = V.L / 2; return [[-x, RIM_TOP, -z], [x, RIM_TOP, -z], [-x, RIM_TOP, z], [x, RIM_TOP, z], [-x, 3, z], [x, 3, z]]; };
  function framing(S, L, V, t) {
    if (tableScene(S)) {
      const T = (S.scene === 'lesson' || S.scene === 'daily' || S.scene === 'auto') ? L.study : L.play;
      let r;
      if (L.wide) { const x0 = Math.max(L.U.x0 - 6, T.seat[3].x - 56), x1 = Math.min(L.U.x1 + 6, T.seat[1].x + 56), y0 = Math.max(L.U.y0 - 20, T.partner.backs.y - 52), y1 = T.handY - 2; r = { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }; }
      else { const y0 = T.partner.backs.y - 66, y1 = T.handY - 6; r = { x: L.U.x0 - 34, y: y0, w: L.U.w + 68, h: y1 - y0 }; }
      return fit(rectCss(r), cornerPts(V), { yaw: 0, tilt: L.wide ? 54 : 61, fov: 26, tx: 0, ty: CLOTH_Y, tz: 0 });
    }
    // the title / menu / pages: low camera over the near half of the cloth, the room (wall arches, lanterns, cushions) behind
    const G = L.title(false), hr = L.wide ? { x: 0, y: 0, w: G.rows.play.x - 10, h: L.h } : { x: 0, y: 0, w: L.w, h: Math.max(250, G.rows.play.y - 44) };
    const low = L.wide ? { x: hr.x + hr.w * 0.04, y: hr.y + hr.h * 0.5, w: hr.w * 0.92, h: hr.h * 0.5 } : { x: hr.x, y: hr.y + hr.h * 0.5, w: hr.w, h: hr.h * 0.5 };
    const hw = L.wide ? 46 : (L.h / L.w < 1.6 ? 46 : 30), pts = [[-hw, CLOTH_Y, 40], [hw, CLOTH_Y, 40], [-hw, CLOTH_Y, -2], [hw, CLOTH_Y, -2]];
    return fit(rectCss(low), pts, { yaw: v3.calm ? 0 : 4 * Math.sin(t * TAU / 40), tilt: 27 + (v3.calm ? 0 : 1.5 * Math.sin(t * TAU / 29)), fov: 38, tx: 0, ty: CLOTH_Y + 4, tz: 0 });
  }

  // ---------------------------------------------------------------- cards on the cloth
  let clock = 0;
  const rcast = new THREE.Raycaster(), ndc = new THREE.Vector2(), hit = new THREE.Vector3(), pl = new THREE.Plane(new THREE.Vector3(0, 1, 0), -CLOTH_Y), _p = { x: 0, y: 0 }, _q = { x: 0, y: 0 };
  function castTo(vx, vy) {
    const px = vx * cpu() + offX(), py = vy * cpu() + offY(); ndc.set(px / cssW() * 2 - 1, -(py / cssH()) * 2 + 1); rcast.setFromCamera(ndc, camera);
    return rcast.ray.intersectPlane(pl, hit) ? hit : null;
  }
  function layCards(S, recs) {
    let n = 0, gI = 0; const big = !!S.set.big, four = !!S.set.four;
    for (let i = 0; i < recs.length && n < POOL; i++) {
      const r = recs[i], cx = r.x + CW * r.sc / 2, cy = r.y + 208 * r.sc / 2, h = castTo(cx, cy); if (!h) continue;
      const tex = texFor(r.card, big, four); if (!tex) continue;
      const wx = h.x, wz = h.z;
      toCss(camera, wx, CLOTH_Y, wz, _p); toCss(camera, wx + 1, CLOTH_Y, wz, _q);
      const pxPerCm = Math.max(0.5, Math.hypot(_q.x - _p.x, _q.y - _p.y)), f = clamp(CW * r.sc * cpu() / (pxPerCm * CARD_W), 0.2, 4);
      const m = cards[n++], jitter = r.card < 0 ? 0 : (hash(r.card, 7) - 0.5) * 0.16, tilt = 0.1;
      m.visible = true; m.userData.top.material.map = tex;
      m.scale.setScalar(f); m.rotation.set(tilt, -(r.rot || 0) + jitter, 0, 'YXZ');
      m.position.set(wx, CLOTH_Y + 0.05 + CARD_H * f * 0.5 * Math.sin(tilt) + i * 0.22 * f, wz);
      if (r.glow && gI < GLOWS) { const g = glows[gI++]; g.visible = true; g.position.set(wx, CLOTH_Y + 0.12, wz); g.scale.set(CARD_W * f * 1.9, CARD_H * f * 1.5, 1); g.material.opacity = 0.7 + 0.25 * Math.sin(clock * 6); }
    }
    for (let i = n; i < POOL; i++) cards[i].visible = false;
    for (let i = gI; i < GLOWS; i++) glows[i].visible = false;
  }
  function layHero(S, t) {
    const big = !!S.set.big, four = !!S.set.four;
    fan.scale.setScalar(1.5); fan.position.set(0, CLOTH_Y + 9 + (v3.calm ? 0 : Math.sin(t * 1.1) * 0.35), 26); fan.rotation.x = Math.PI / 2 - 0.3;
    for (const c of fanCards) {
      const tex = texFor(c.id, big, four); if (tex) c.cm.userData.top.material.map = tex;
      c.piv.rotation.y = (c.i - 2) * 0.27 + (v3.calm ? 0 : Math.sin(t * 0.8 + c.i) * 0.012); c.piv.position.set((c.i - 2) * 3.3, c.i * 0.32, 0);
    }
    fan.traverse((o) => { if (o.isMesh) o.castShadow = false; }); fan.visible = true; fanBlob.visible = true; fanBlob.position.set(1.5, CLOTH_Y + 0.1, 30); fanBlob.scale.set(46, 36, 1);
  }

  // ---------------------------------------------------------------- ambient motion
  function ambient(V, t) {
    V.lanterns.forEach((l, k) => { l.rotation.z = v3.calm ? 0 : Math.sin(t * 0.7 + k * 2) * 0.035; l.userData.glow.material.opacity = 0.5 + 0.08 * Math.sin(t * 7 + k) * Math.sin(t * 3.1 + k); l.userData.glow.lookAt(camera.position); });
    lights.key.intensity = 6200 * (0.96 + 0.04 * Math.sin(t * 6.3) * Math.sin(t * 2.3));
    for (let i = 0; i < MOTES; i++) { const a = hash(i, 4) * TAU, r = 20 + hash(i, 3) * 110, sp = 0.02 + hash(i, 7) * 0.03; moteP[i * 3] = Math.cos(a + t * sp) * r + Math.sin(t * 0.5 + i) * 3; moteP[i * 3 + 1] = 6 + ((hash(i, 2) * 90 + t * (1.5 + hash(i, 8) * 2.5)) % 90); moteP[i * 3 + 2] = Math.sin(a + t * sp) * r * 0.8 - 10; }
    moteGeo.attributes.position.needsUpdate = true;
    const sp = V.tray.position, inc = V.inc.position;
    puffs.forEach((s, i) => {
      if (v3.calm) { s.visible = false; return; }
      const steam = i < 7, ph = (t * (steam ? 0.35 : 0.22) + (i % 7) / 7) % 1; s.visible = true;
      if (steam) { s.position.set(sp.x + 6.2 + Math.sin(ph * 5 + i) * 0.9, CLOTH_Y + 14 + ph * 15, sp.z + 2 + Math.cos(ph * 4 + i) * 0.7); s.scale.setScalar(2 + ph * 4); s.material.opacity = 0.26 * Math.sin(Math.PI * ph); }
      else { s.position.set(inc.x + Math.sin(ph * 7 + i) * (1 + ph * 3), CLOTH_Y + 11 + ph * 30, inc.z + Math.cos(ph * 5 + i) * (0.6 + ph * 2)); s.scale.setScalar(2.4 + ph * 7); s.material.opacity = 0.32 * Math.sin(Math.PI * ph); }
    });
  }

  // ---------------------------------------------------------------- per frame
  let lost = false, lastNow = 0, frameAvg = 16, slowFrames = 0, fadeIn = 0, attached = false;
  function pre() {
    if (!attached || lost) return;
    const S = getState(); if (!S) return;
    const L = layoutFor(meta.width, meta.height);
    const o = L.wide ? 'l' : 'p', V = ensureVariant(o); if (varKey !== o) { variants[varKey].g.visible = false; varKey = o; snap = true; }
    V.g.visible = true;
    const vk = `${cssW()}x${cssH()}|${L.key}|${tableScene(S)}`; if (vk !== viewKey) { viewKey = vk; snap = true; }
    const now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1);
    const goal = framing(S, L, V, clock + dt);
    const k = snap ? 1 : 1 - Math.exp(-dt * 4.2);
    for (const key of Object.keys(goal)) cur[key] += (goal[key] - cur[key]) * k;
    snap = false;
    place(camera, cur);
    v3.cards.length = 0; v3.calm = !!S.set.calm || !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }
  function post() {
    if (!attached || lost) return;
    const S = getState(); if (!S) return;
    const now = performance.now(), dt = clamp((now - (lastNow || now)) / 1000, 0, 0.1); lastNow = now; if (!(S.scene === 'auto' && S.auto && S.auto.paused)) clock += dt;
    canvas.style.visibility = 'visible';
    const V = variants[varKey], table = tableScene(S);
    if (table) { layCards(S, v3.cards); fan.visible = false; fanBlob.visible = false; } else { layCards(S, []); layHero(S, clock); }
    ambient(V, clock);
    if (fadeIn < 1) { fadeIn = Math.min(1, fadeIn + dt / 0.5); v3.fade = fadeIn; canvas.style.opacity = String(fadeIn); } else canvas.style.opacity = '1';
    renderer.setSize(cssW(), cssH(), false);
    renderer.render(scene, camera);
    const ft = dt * 1000; if (ft > 0) frameAvg = frameAvg * 0.95 + ft * 0.05;
    if (frameAvg > 26 && tier < 2) { if (++slowFrames > 90) { tier++; slowFrames = 0; frameAvg = 16; applyTier(); } } else slowFrames = 0;
  }

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; v3.on = false; canvas.style.visibility = 'hidden'; });
  canvas.addEventListener('webglcontextrestored', () => {
    lost = false; buildEnv();
    scene.traverse((o) => { if (o.material) for (const m of [].concat(o.material)) for (const kk of ['map', 'bumpMap']) if (m[kk]) m[kk].needsUpdate = true; });
    for (const t of texCache.values()) t.needsUpdate = true;
    applyTier(); fadeIn = 0; v3.fade = 0; v3.on = true; canvas.style.visibility = 'visible'; snap = true;
  });

  applyTier();
  place(camera, cur); try { renderer.compile(scene, camera); } catch { /* compiled lazily */ }
  await tick();
  setTimeout(() => { try { ensureVariant(initO === 'l' ? 'p' : 'l'); } catch { /* built lazily */ } }, 1500);   // the other orientation, built while the player is on the menu

  return {
    ok: true, renderer, scene, camera, cur, lights, variants,
    attach() { attached = true; v3.on = true; v3.fade = 0; fadeIn = 0; snap = true; },
    pre, post, place,
    get tier() { return TIERS[tier].name; },
    setTier(n) { tier = clamp(n, 0, 2); applyTier(); },
    loseContext() { const ext = renderer.getContext().getExtension('WEBGL_lose_context'); ext?.loseContext(); return ext; },
    restoreContext(ext) { ext?.restoreContext(); },
  };
}

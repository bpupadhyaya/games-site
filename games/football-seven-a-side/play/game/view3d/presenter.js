// 3D presenter: READS the simulation (game.getState().sim) and draws the pitch, the ball and fourteen mannequins. It never writes back.
// Contact discipline: the sim owns where and when the ball is touched; the pose layer (anim.js / skills.js) makes the exact body part meet the
// (visually enlarged) ball at the sim's contact tick, and the ball only ever follows the sim's own positions.
import { initialCam, fovFor } from '../src/camera.js';
import { STEP, BR } from '../src/consts.js';
import { buildScenery, buildGround, paintGround, paintAtlas } from './pitch.js';
import { createDriver } from './anim.js';

const LIB = '../vendor3d/index.js';
export const BALL_SCALE = (() => { try { const m = /[?&]bs=([0-9.]+)/.exec(globalThis.location.search); if (m) return +m[1]; } catch { /* ignore */ } return 1.3; })();   // visual ball radius = 0.11 * scale: a real ball is about 3 px on screen, unreadable
export const BALL_R = BR * BALL_SCALE;
export const PLAYER_SCALE = (() => { try { const m = /[?&]ps=([0-9.]+)/.exec(globalThis.location.search); if (m) return +m[1]; } catch { /* ignore */ } return 1.2; })();   // stylised players drawn a little larger so they read on a phone
const SKINS = ['peach', 'clay', 'wood', 'ivory', 'tan', 'brown', 'deep'];
const HAIRS = ['black', 'brown', 'blond', 'ginger', 'grey', 'black', 'brown'];
const KITS = [
  { top: '#2b6fd6', bottoms: '#f4f4f4', socks: '#f4f4f4', shoes: '#f4f4f4', trim: '#cfe0ff' },
  { top: '#d94536', bottoms: '#2a2a2e', socks: '#2a2a2e', shoes: '#e8e8e8', trim: '#ffd6cf' },
];
const GK_KITS = [
  { top: '#c8e034', bottoms: '#2a2a2e', socks: '#2a2a2e', shoes: '#2a2a2e', trim: '#ffffff' },
  { top: '#8a4fd6', bottoms: '#2a2a2e', socks: '#8a4fd6', shoes: '#2a2a2e', trim: '#ead9ff' },
];
const hash = (n) => { let x = (n + 1) * 2654435761 >>> 0; x ^= x >>> 15; x = Math.imul(x, 2246822519) >>> 0; x ^= x >>> 13; return (x >>> 0) / 4294967296; };

function pickQuality() {
  try { const m = /[?&]q=(low|medium|high)/.exec(globalThis.location.search); if (m) return m[1]; } catch { /* ignore */ }
  const nav = globalThis.navigator || {};
  const weak = (nav.hardwareConcurrency && nav.hardwareConcurrency <= 6) || (nav.deviceMemory && nav.deviceMemory <= 4);
  return weak ? 'medium' : 'high';
}
const lerp = (a, b, t) => a + (b - a) * t;
const lerpAng = (a, b, t) => { let d = b - a; d = Math.atan2(Math.sin(d), Math.cos(d)); return a + d * t; };

export async function createPresenter({ kitCanvas, quality = pickQuality(), manual = false } = {}) {
  const none = { stage: null, wrap: (g) => g, ready: Promise.resolve(false) };
  let V3;
  try { V3 = await import(LIB); } catch (e) { console.warn('view3d failed to load; using the 2D fallback', e); return none; }
  const { createStage, loadHuman, THREE } = V3;
  const doc = globalThis.document;
  const canvas = doc.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100dvh;display:block;pointer-events:none;z-index:0;visibility:hidden';
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  // on screens taller than 9:16 the 3D picture also fills the bars above and below the 720x1280 game area; two translucent dark bands carry the HUD's top and bottom fades over them
  const mkBar = (top) => { const d = doc.createElement('div'); d.style.cssText = `position:fixed;left:0;right:0;${top ? 'top' : 'bottom'}:0;height:0;pointer-events:none;z-index:0;background:linear-gradient(${top ? '180deg' : '0deg'},rgba(6,14,26,0.86),rgba(6,14,26,0.62))`; kitCanvas.parentElement.insertBefore(d, kitCanvas); return d; };
  const barTop = mkBar(true), barBot = mkBar(false);
  const stage = createStage({ canvas, quality, dprCap: 2, lighting: 'day', mode: 'continuous', shadowSize: 3.2, preserveDrawingBuffer: manual });
  if (!stage.supported) { canvas.remove(); return none; }
  const P = { stage, THREE, V3, quality, humans: [], ready: false, lost: false, stats: { frames: 0 }, manual };
  stage.onContextLost(() => { P.lost = true; });
  stage.onContextRestored(() => { P.lost = false; stage.invalidate(); });

  // ---- the scene: lights, sky, ground, scenery, ball, blob shadows ---------------------------------------------------------------------------
  stage.setLighting('day', { sky: 0x8fb8e0, fog: 0xbcd4e8, hemi: 1.0, keyI: 2.6, rimI: 0.9, exposure: 0.95 });
  stage.setSky(0x8fb8e0, 0xbcd4e8, { near: 240, far: 560 });
  stage._shadowOffset.set(-6, 12, -5);                // sun from the near-left: shadows fall away from the camera, light on the players' faces
  stage.lights.key.position.set(-6, 12, -5);
  const cam = stage.camera; cam.near = 3; cam.far = 420;

  const groundTex = new THREE.CanvasTexture(paintGround(doc, quality === 'low' ? 28 : 40));
  groundTex.colorSpace = THREE.SRGBColorSpace; groundTex.anisotropy = Math.min(8, stage.renderer.capabilities.getMaxAnisotropy()); groundTex.generateMipmaps = true; groundTex.minFilter = THREE.LinearMipmapLinearFilter;
  const ground = new THREE.Mesh(buildGround(THREE), new THREE.MeshStandardMaterial({ map: groundTex, roughness: 1, metalness: 0 }));
  ground.receiveShadow = true; ground.name = 'ground';
  stage.add(ground);
  const atlasTex = new THREE.CanvasTexture(paintAtlas(doc));
  atlasTex.colorSpace = THREE.SRGBColorSpace; atlasTex.generateMipmaps = true; atlasTex.minFilter = THREE.LinearMipmapLinearFilter; atlasTex.magFilter = THREE.LinearFilter; atlasTex.anisotropy = 4;
  const scenery = new THREE.Mesh(buildScenery(THREE), new THREE.MeshBasicMaterial({ map: atlasTex, vertexColors: true, alphaTest: 0.28, side: THREE.DoubleSide, fog: true }));
  scenery.frustumCulled = false; scenery.name = 'scenery';
  stage.add(scenery);

  // the ball: a high-contrast classic pattern, drawn larger than real (BALL_SCALE) so it reads on a phone
  const ballTex = (() => {
    const c = doc.createElement('canvas'); c.width = 512; c.height = 256; const g = c.getContext('2d');
    g.fillStyle = '#fbfbf8'; g.fillRect(0, 0, 512, 256);
    g.fillStyle = '#1d2330';
    const pts = [[0.08, 0.5], [0.25, 0.2], [0.25, 0.8], [0.42, 0.5], [0.58, 0.2], [0.58, 0.8], [0.75, 0.5], [0.92, 0.2], [0.92, 0.8], [0.0, 0.1], [0.5, 0.06], [0.5, 0.94]];
    for (const [u, v] of pts) { g.beginPath(); for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2 - Math.PI / 2; const x = u * 512 + Math.cos(a) * 30, y = v * 256 + Math.sin(a) * 30; if (i) g.lineTo(x, y); else g.moveTo(x, y); } g.closePath(); g.fill(); }
    g.strokeStyle = 'rgba(30,35,48,0.5)'; g.lineWidth = 3; for (const [u, v] of pts) { g.beginPath(); g.arc(u * 512, v * 256, 52, 0, Math.PI * 2); g.stroke(); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const ball = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 28, 18), new THREE.MeshStandardMaterial({ map: ballTex, roughness: 0.55, metalness: 0, emissive: 0x222222, emissiveIntensity: 0.35 }));
  ball.castShadow = false; ball.name = 'ball'; stage.add(ball);
  const blobs = stage.enableBlobShadows(16, { radius: 0.5, opacity: 0.85 });
  blobs.mesh.visible = true;
  P.ball = ball; P.ballR = BALL_R; P.blobs = blobs; P.ground = ground; P.scenery = scenery;

  // ---- fourteen players ---------------------------------------------------------------------------------------------------------------------
  const lod = 1;
  async function loadPlayers() {
    const specs = [];
    for (let i = 0; i < 14; i++) {
      const team = i < 7 ? 0 : 1, role = i % 7;
      const female = role !== 0 && hash(i * 13 + 1) < 0.34;
      specs.push({ i, team, role, female, kit: role === 0 ? GK_KITS[team] : KITS[team], skin: SKINS[Math.floor(hash(i * 5 + 2) * SKINS.length)], hair: HAIRS[Math.floor(hash(i * 7 + 3) * HAIRS.length)] });
    }
    const hs = await Promise.all(specs.map((sp) => loadHuman({ character: sp.female ? 'mannequin_f' : 'mannequin_m', kit: sp.kit, skin: sp.skin, hair: sp.hair, legs: 'shorts', quality, lod, scale: PLAYER_SCALE, silhouette: 0.55, stripes: true, decal: ['G', 'D', 'D', 'M', 'W', 'W', 'S'][sp.role] })));
    hs.forEach((h) => { h.groundClamp = 'auto'; h.footPlanting = true; h.root.visible = false; h.setPosition(0, 0, 0); stage.add(h); h.root.traverse((o) => { if (o.isMesh || o.isSkinnedMesh) o.castShadow = false; }); });
    P.humans = hs;
    P.drv = createDriver({ THREE, V3, humans: hs, specs, ball, BALL_R, hash, quality });
  }
  P.ready_p = loadPlayers().then(() => { P.ready = true; stage.invalidate(); }).catch((e) => { console.warn('3D players failed to load; keeping the 2D pitch', e); P.failed = true; });

  // ---- adaptive quality: long frames first drop the human's shadow map, then the pixel ratio ----------------------------------------------------------
  let perfN = 0, perfSum = 0, perfLast = 0, perfLevel = 0;
  function perfTick() {
    const now = performance.now();
    if (perfLast) { const d = now - perfLast; if (d < 250) { perfSum += d; perfN++; } }
    perfLast = now;
    if (perfN >= 90) {
      const avg = perfSum / perfN; perfN = 0; perfSum = 0;
      if (avg > 22 && perfLevel < 2) {
        perfLevel++;
        if (perfLevel === 1) stage.renderer.shadowMap.enabled = false; else stage.renderer.setPixelRatio(Math.min(1.25, stage.renderer.getPixelRatio()));
        stage.invalidate();
      }
    }
  }

  // ---- the frame ----------------------------------------------------------------------------------------------------------------------------------
  const camBase = initialCam();
  let curSim = null, prev = null, cur = null, seenAt = 0, lastT = null, pillar = -1;
  const snapOf = (s) => ({ tick: s.tick, t: s.t, ball: { x: s.ball.x, y: s.ball.y, z: s.ball.z, rx: s.ball.rx, rz: s.ball.rz }, pl: s.players.map((p) => ({ x: p.x, z: p.z, vx: p.vx, vz: p.vz, face: p.face, jy: p.jy })) });

  function layoutCamera() {
    const winW = kitCanvas.clientWidth || 720, winH = kitCanvas.clientHeight || 1280;
    const wantW = winW / winH > 0.5625 ? Math.round(winH * 0.5625) : 0;
    if (wantW !== pillar) {
      pillar = wantW;
      const vis = canvas.style.visibility || 'hidden';
      canvas.style.cssText = wantW ? `position:fixed;top:0;left:50%;transform:translateX(-50%);width:${wantW}px;height:100dvh;display:block;pointer-events:none;z-index:0;visibility:${vis}` : `position:fixed;inset:0;width:100vw;height:100dvh;display:block;pointer-events:none;z-index:0;visibility:${vis}`;
      stage.resize();
    }
    const W = canvas.clientWidth || 720, H = canvas.clientHeight || 1280;
    { const sc = Math.min(W / 720, H / 1280), bar = Math.max(0, Math.round((H - 1280 * sc) / 2)); const hh = `${bar}px`; if (barTop.style.height !== hh) { barTop.style.height = hh; barBot.style.height = hh; } const l = wantW ? `calc(50% - ${wantW / 2}px)` : '0'; const r2 = l; barTop.style.left = barBot.style.left = l; barTop.style.right = barBot.style.right = r2; }
    const fov = fovFor(W / H);
    if (Math.abs(cam.fov - fov) > 1e-3) { cam.fov = fov; cam.updateProjectionMatrix(); }
    const c = P.camOverride || camBase;
    cam.position.set(c.x, c.y, c.z); cam.lookAt(c.lx, c.ly, c.lz);
    if (P.camOverride && P.camOverride.fov && cam.fov !== P.camOverride.fov) { cam.fov = P.camOverride.fov; cam.updateProjectionMatrix(); }
  }

  // draw the state of G.sim. alphaOverride (0..1) is for headless verification (no wall clock): the picture is exactly the state of the tick.
  function frame(G, alphaOverride) {
    if (!P.ready || P.lost) return false;
    const s = G && G.sim;
    if (!s) { stage.setVisible(false); barTop.style.display = barBot.style.display = 'none'; return false; }
    if (s !== curSim) { curSim = s; prev = cur = null; lastT = null; P.drv.reset(); }
    if (!cur || s.tick !== cur.tick) { prev = cur || snapOf(s); cur = snapOf(s); seenAt = performance.now(); if (prev.tick > cur.tick) prev = cur; }
    let alpha = alphaOverride ?? Math.min(1, Math.max(0, (performance.now() - seenAt) / (STEP * 1000)));
    if (prev.tick === cur.tick) alpha = 1;
    const T = lerp(prev.t, cur.t, alpha);
    let dt = lastT === null ? 0 : T - lastT;
    if (dt < 0 || dt > 0.5) dt = 0;
    lastT = T;
    dt = Math.min(dt, 0.1);
    stage.setVisible(true); barTop.style.display = barBot.style.display = '';
    layoutCamera();
    const ballI = { x: lerp(prev.ball.x, cur.ball.x, alpha), y: lerp(prev.ball.y, cur.ball.y, alpha), z: lerp(prev.ball.z, cur.ball.z, alpha), rx: lerp(prev.ball.rx, cur.ball.rx, alpha), rz: lerp(prev.ball.rz, cur.ball.rz, alpha) };
    const pl = cur.pl.map((c, i) => { const p0 = prev.pl[i]; return { x: lerp(p0.x, c.x, alpha), z: lerp(p0.z, c.z, alpha), vx: lerp(p0.vx, c.vx, alpha), vz: lerp(p0.vz, c.vz, alpha), face: lerpAng(p0.face, c.face, alpha), jy: lerp(p0.jy, c.jy, alpha) }; });
    if (quality === 'high') for (let i = 0; i < 14; i++) { const want = i === s.human ? 0 : 1; if (P.humans[i].lod !== want) P.humans[i].setLOD(want); }
    const t0 = performance.now();
    P.drv.step({ s, T, dt, ballI, pl, prev, cur, alpha });
    P.stats.driveMs = performance.now() - t0;
    // blob shadows (everybody), plus the human's real shadow map on the tiers that have one
    for (let i = 0; i < 14; i++) { const p = pl[i]; const sc = 1 - Math.min(0.35, (p.jy || 0) * 0.6); blobs.set(i, p.x, p.z, 0.5 * sc, 0.012); }
    blobs.set(14, ball.position.x, ball.position.z, Math.max(0.14, BALL_R * (1.15 + Math.min(0.5, (ball.position.y - BALL_R) * 0.18))), 0.012);
    blobs.mesh.count = 15;
    if (s.human >= 0 && quality !== 'low' && stage.renderer.shadowMap.enabled) {
      stage.setShadowTarget(pl[s.human].x, 0, pl[s.human].z);
      for (let i = 0; i < 14; i++) { const on = i === s.human; if (P.humans[i]._cast !== on) { P.humans[i]._cast = on; P.humans[i].root.traverse((o) => { if (o.isSkinnedMesh) o.castShadow = on; }); } }
    }
    const t1 = performance.now();
    stage.render();
    P.stats.frames++; P.stats.renderMs = performance.now() - t1;
    if (!manual) perfTick();
    return true;
  }
  P.frame = frame;
  P.hash = hash;

  P.wrap = (game) => {
    const r = game.render.bind(game);
    game.render = (ctx, view) => {
      view.cssW = kitCanvas.clientWidth || 720; view.cssH = kitCanvas.clientHeight || 1280;
      // until the players are loaded (or if WebGL is lost) the game draws its flat 2D pitch so the player never sees an empty screen
      view.noGL = !P.ready || P.lost || !!P.failed;
      r(ctx, view);
      if (!view.noGL) frame(game.getState()); else { stage.setVisible(false); barTop.style.display = barBot.style.display = 'none'; }
    };
    return game;
  };
  return P;
}

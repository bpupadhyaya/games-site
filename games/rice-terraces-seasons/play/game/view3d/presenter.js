// 3D presenter: READS the game state (game.getState()) and shows the terraced hillside, the people and the weather. It never writes back.
// The simulation owns every number; the picture follows it. The camera is the same fitted view the game uses to place its taps (src/camera.js).
import { buildWorld } from './world.js';
import { createFarmers } from './farmers.js';
import { camFor } from '../src/hud.js';
import { fitCamera } from '../src/camera.js';
import { SW, H, host } from '../src/layout.js';
import { levelById } from '../src/levels.js';

const LIB = '../vendor3d/index.js';
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;

function pickQuality() {
  try { const m = /[?&]q=(low|medium|high)/.exec(globalThis.location.search); if (m) return m[1]; } catch { /* ignore */ }
  const nav = globalThis.navigator || {};
  const touch = !!(globalThis.matchMedia && globalThis.matchMedia('(pointer: coarse)').matches) || (nav.maxTouchPoints || 0) > 1;
  if (touch) return 'medium';   // phones and tablets: the safe default (fewer shadow draws, 1.5x pixels); ?q=high overrides
  const weak = (nav.hardwareConcurrency && nav.hardwareConcurrency <= 6) || (nav.deviceMemory && nav.deviceMemory <= 4);
  return weak ? 'medium' : 'high';
}

export async function createPresenter({ kitCanvas, quality = pickQuality() }) {
  let V3;
  try { V3 = await import(LIB); } catch (e) { console.warn('view3d failed to load; using the 2D fallback', e); return { stage: null, wrap: (g) => g, ready: Promise.resolve(false) }; }
  const { createStage, THREE } = V3;
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;height:100dvh;display:block;pointer-events:none;z-index:0';
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  const stage = createStage({ canvas, quality, dprCap: 2, lighting: 'day', mode: 'continuous', shadows: quality !== 'low', shadowSize: 34 });
  if (!stage.supported) { canvas.remove(); return { stage: null, wrap: (g) => g, ready: Promise.resolve(false) }; }
  stage.camera.near = 0.6; stage.camera.far = 2600; stage.camera.updateProjectionMatrix();
  stage.scene.fog = new THREE.Fog(0xd6e8ee, 60, 600);
  const P = { stage, THREE, ready: false, lost: false, lab: null };
  let sizeKey = '';
  stage.onContextLost(() => { P.lost = true; });
  stage.onContextRestored(() => { P.lost = false; sizeKey = ''; stage.resize(); stage.invalidate(); });
  const world = buildWorld(V3, stage);
  P.world = world;

  // ---- budget: the canvas fills the whole screen; on big screens the pixel ratio is lowered so the buffer stays about phone-sized
  const PIXELS = 2.3e6;
  let budgetR = 1, perfN = 0, perfSum = 0, perfLast = 0, perfLevel = 0;
  function sizeBudget(w, h) {
    const k = `${w}x${h}|${perfLevel}`;
    if (k !== sizeKey) {
      sizeKey = k; stage.resize();
      const dpr = Math.min(globalThis.devicePixelRatio || 1, quality === "high" ? 2 : 1.5, perfLevel ? 1.25 : 2);
      budgetR = Math.max(1, Math.min(dpr, Math.sqrt(PIXELS / Math.max(1, w * h))));
    }
    if (Math.abs(stage.renderer.getPixelRatio() - budgetR) > 0.01) { stage.renderer.setPixelRatio(budgetR); stage.invalidate(); }
  }
  function perfTick() {
    const now = performance.now();
    if (perfLast) { const d = now - perfLast; if (d < 250) { perfSum += d; perfN++; } }
    perfLast = now;
    if (perfN >= 90) { const avg = perfSum / perfN; perfN = 0; perfSum = 0; if (avg > 26 && perfLevel < 1) { perfLevel++; sizeKey = ''; stage.invalidate(); } }
  }

  // ---- camera ------------------------------------------------------------------------------------------------------------------
  const cam = { pos: new THREE.Vector3(0, 40, 60), look: new THREE.Vector3(), fov: 36, init: false };
  function titleCam(lv, aspect, tReal) {
    const land = aspect > 1.1;
    const rect = land ? { x: SW * 0.01, y: H * 0.2, w: SW * 0.58, h: H * 0.7 } : { x: SW * 0.0, y: H * 0.2, w: SW * 1.0, h: H * 0.34 };
    const az = Math.sin(tReal * 0.06) * 0.16 + (land ? 0.12 : 0.04);
    return fitCamera(lv, SW, H, rect, az, (land ? 26 : 24) * Math.PI / 180);
  }

  let tReal = 0, lastNow = 0, curLv = '', farmers = null, storyBlend = 0;
  // the picture behind the menus: a lovely mixed hillside (mirrors, young rice, ripening rice) instead of an empty slope
  const showCache = {};
  function showFarm(lv) {
    if (showCache[lv.id]) return showCache[lv.id];
    const plots = [];
    for (let i = 0; i < lv.R * lv.C; i++) {
      const m = (i * 5 + (i / lv.C | 0)) % 4;
      plots.push({ w: m === 0 ? 3.1 : 2.3, soil: 1, crop: m === 0 ? 0 : m === 1 ? 2 : m === 2 ? 1 : 2, prog: m === 1 ? 0.9 : m === 2 ? 0.2 : 0.6, gold: 0, h: 1, weed: 0, pest: 0, wall: 1, job: null, owner: 0, harvested: 0 });
    }
    const f = { plots, feed: [], down: [], side: [], flows: { d: {}, s: {}, f: {} }, springNow: lv.spring, season: 2, weather: { kind: 'clear' } };
    for (let c = 0; c < lv.C; c++) f.feed.push(1);
    showCache[lv.id] = f; return f;
  }
  function frame(G, view) {
    if (P.lost) return;
    const nowMs = performance.now(); let dt = lastNow ? Math.min(0.05, (nowMs - lastNow) / 1000) : 0; lastNow = nowMs;
    const frozen = !!(G.pauseMenu || (G.watch && G.watch.paused && G.mode === 'watch'));
    if (frozen) dt = 0;
    tReal += dt;
    stage.setVisible(true);
    const w = canvas.clientWidth || 720, h = canvas.clientHeight || 1280, aspect = w / h;
    sizeBudget(w, h);
    const lv = (G.scene === 'play' || G.scene === 'result') && G.lv ? G.lv : levelById(G.setup && G.setup.lv ? G.setup.lv : 'c1');
    if (lv.id !== curLv) {
      curLv = lv.id; world.setLevel(lv); P.first = true;
      if (farmers) farmers.dispose();
      farmers = null; P.farmers = null;
      createFarmers(V3, stage, world.T, lv, { quality }).then((fm) => { farmers = fm; P.farmers = fm; }).catch((e) => console.warn('farmers failed', e));
    }
    const f = G.farm && G.farm.f;
    const playing = G.scene === 'play' && f;
    const vf = playing || (G.scene === 'result' && f) ? f : showFarm(lv);
    const season = playing ? Math.min(3, f.season) : G.scene === 'result' && f ? 3 : lv.chapter ? 2 : 1;
    const wx = playing ? f.weather.kind : 'clear';
    const fogC = world.applyLook(season, wx, dt, P.first);
    void fogC;
    const c = playing ? camFor(lv.id, G.settings.textIdx) : titleCam(lv, aspect, tReal);
    cam.pos.set(c.pos.x, c.pos.y, c.pos.z); cam.look.set(c.target.x, c.target.y, c.target.z); cam.fov = c.fov;
    // the storyteller's close-up while a story card is up
    const story = !!(playing && G.card && farmers && farmers.speakers[G.card.look]);
    storyBlend = story ? Math.min(1, storyBlend + dt / 0.9) : Math.max(0, storyBlend - dt / 0.5);
    if (P.first) storyBlend = story ? 1 : 0;
    if (storyBlend > 0 && farmers) {
      const sp = farmers.speakerSpot(), e = storyBlend * storyBlend * (3 - 2 * storyBlend);
      const land = aspect > 1.1;
      const sPos = new THREE.Vector3(sp.cam.x + (land ? 0 : 0.5), sp.cam.y, sp.cam.z), sLook = new THREE.Vector3(sp.x, sp.y + (land ? 1.2 : 1.0), sp.z + (land ? 1.0 : 0.3));
      cam.pos.lerp(sPos, e); cam.look.lerp(sLook, e); cam.fov = lerp(cam.fov, land ? 36 : 36, e);
    }
    const cm = stage.camera;
    if (Math.abs(cm.fov - cam.fov) > 1e-3 || Math.abs(cm.aspect - aspect) > 1e-4) { cm.fov = cam.fov; cm.aspect = aspect; cm.updateProjectionMatrix(); }
    if (P.lab && P.lab.pos) { cam.pos.set(...P.lab.pos); cam.look.set(...P.lab.look); cam.fov = P.lab.fov || 36; if (Math.abs(cm.fov - cam.fov) > 1e-3) { cm.fov = cam.fov; cm.updateProjectionMatrix(); } }
    cm.position.copy(cam.pos); cm.lookAt(cam.look);
    if (stage.scene.fog) { stage.scene.fog.near = c.dist * 0.9; stage.scene.fog.far = 520 + c.dist * 2; }
    world.update(G, dt, tReal, cm, vf);
    if (farmers) farmers.update(G, f, dt, tReal);
    stage.setShadowTarget(c.target.x, c.target.y, c.target.z);
    stage.update(dt, { renderNow: false });
    stage.render(); perfTick();
    P.first = false;
  }
  P.frame = frame; P.cam = cam;
  P.setLab = (o) => { P.lab = o ? { ...o } : null; };
  P.wrap = (game) => {
    const r = game.render.bind(game);
    game.render = (ctx, view) => {
      view.cssW = kitCanvas.clientWidth || 720; view.cssH = kitCanvas.clientHeight || 1280;
      r(ctx, view);
      frame(game.getState(), view);
    };
    return game;
  };
  void lerp; void clamp; void host;
  return P;
}

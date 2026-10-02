// Golden Hour Cricket: the 3D presenter. It only READS the sim (game.getState()) and draws the batter's-eye delivery view with
// real 3D people behind the kit's transparent 2D canvas (HUD, menus, Rules, About stay 2D). Nothing here writes back to the sim.
// If WebGL2 or the 3D assets are unavailable, `info.active` stays false and the game keeps its 2D figures (src/scene.js, src/art.js).
import { viewOf, HOLD_T } from './sim.js';
import { CAM } from '../src/scene.js';
import { fitProjection } from './world.js';

const LIB = '../vendor3d/index.js';

function pickQuality(q) {
  if (q) return q;
  try { const m = /[?&]q=(low|medium|high)/.exec(globalThis.location.search); if (m) return m[1]; } catch { /* ignore */ }
  const nav = globalThis.navigator || {};
  const weak = (nav.hardwareConcurrency && nav.hardwareConcurrency <= 6) || (nav.deviceMemory && nav.deviceMemory <= 4);
  return weak ? 'medium' : 'high';
}

export function createPresenter({ kitCanvas, quality, canvasParent = null, headless = false } = {}) {
  quality = pickQuality(quality);
  const info = { active: false, ready: false, failed: false, hand: 1, bowler: null, theme: null, dev: null };
  const P = { info, kitCanvas, quality,  canvas: null, stage: null, V: null, proj: {}, visible: false, size: { w: 0, h: 0 }, headless };

  async function init() {
    const V = await import(LIB);
    P.V = V;
    const doc = globalThis.document;
    const canvas = doc.createElement('canvas');
    canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100dvh;display:block;pointer-events:none;z-index:0;visibility:hidden';
    const parent = canvasParent || kitCanvas.parentElement;
    parent.insertBefore(canvas, kitCanvas);
    kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
    const stage = V.createStage({ canvas, quality, dprCap: 2, lighting: 'evening', mode: 'continuous' });
    if (!stage.supported) { canvas.remove(); info.failed = true; return; }
    P.canvas = canvas; P.stage = stage;
    stage.onContextLost(() => { info.active = false; });
    stage.onContextRestored(() => { stage.invalidate(); });
    P.cam = stage.camera;
    P.cam.position.set(0, CAM.y, -CAM.z); P.cam.lookAt(0, CAM.y, -200); P.cam.updateMatrixWorld(true);
    P.cam.updateProjectionMatrix = () => { if (P.cssW) P.fit = fitProjection(P.cam, P.cssW, P.cssH, undefined, P.proj); };
    const mod = await import('./director.js');
    P.dir = mod.createDirector(P);
    await P.dir.preload('stadium');
    info.ready = true;
  }
  P.ready = init().catch((e) => { info.failed = true; info.active = false; info.error = String(e && e.stack || e); console.warn('view3d: staying with the 2D figures', info.error); });

  const sizeCheck = () => {
    const w = kitCanvas.clientWidth || globalThis.innerWidth, h = kitCanvas.clientHeight || globalThis.innerHeight;
    if (w !== P.size.w || h !== P.size.h) { P.size = { w, h }; P.cssW = w; P.cssH = h; P.stage.setSize(w, h); P.cam.updateProjectionMatrix(); P.dir.resized(); }
  };

  // called before the 2D render: tells the 2D side whether to leave the delivery picture to the 3D layer
  // virtual-canvas rectangle of the action cam (over the overhead field)
  const PIP = { x: 436, y: 392, w: 270, h: 300 };
  P.pre = (state) => {
    info.pip = null; info.hold = false; P.mode = null;
    if (!info.ready || info.failed || P.stage.contextLost) { info.active = false; return; }
    const m = state.m, th = m ? m.theme : null;
    if (th && !P.dir.has(th)) P.dir.preload(th);
    if (state.scene === 'setup' && state.setup && state.setup.theme) P.dir.preload(state.setup.theme);
    if (!th || !P.dir.has(th)) { info.active = false; return; }
    const view = P.force ? 'delivery' : viewOf(state);
    const hold = view === 'overhead' && m.phase === 'live' && m.live && m.live.t < HOLD_T && !m.live.dead && !!m.sw;
    if (P.forcePip && view === 'overhead') P.mode = 'pip';
    else if (view === 'delivery' || hold) P.mode = 'delivery';
    else if (view === 'overhead') P.mode = 'pip';
    info.active = P.mode === 'delivery'; info.hold = hold;
    if (P.mode === 'pip') { info.pip = PIP; P.pipRect = P.pipFull ? { x: 0, y: 0, w: 720, h: 1280 } : PIP; }
  };

  P.frame = (state) => {
    if (!info.ready || info.failed) return;
    if (!P.mode) { if (P.visible) { P.canvas.style.visibility = 'hidden'; P.visible = false; } return; }
    sizeCheck();
    if (!P.visible) { P.canvas.style.visibility = 'visible'; P.visible = true; }
    P.dir.frame(state, P.mode);
  };

  P.wrap = (game) => {
    const r = game.render.bind(game);
    game.render = (ctx, view) => {
      const st = game.getState();
      P.pre(st);
      P.lastState = st;
      ctx.clearRect(0, 0, view.width ?? 720, view.height ?? 1280);
      r(ctx, view);
      P.frame(st);
    };
    return game;
  };
  return P;
}

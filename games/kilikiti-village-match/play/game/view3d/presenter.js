// 3D presenter: READS the simulation (game.getState().sim) and draws the ground, the wickets and the players behind the kit's transparent 2D canvas.
// It never writes back. If WebGL2 or the 3D assets are unavailable, `info.active` stays false and the game keeps its flat 2D picture.
import { VIEW } from '../src/camera.js';
const LIB = '../vendor3d/index.js';
const PIXEL_BUDGET = 2.4e6;   // css width x height x pixel ratio^2: big tablets render at a lower ratio (never below 1) so they stay smooth

function pickQuality(q) {
  if (q) return q;
  try { const m = /[?&]q=(low|medium|high)/.exec(globalThis.location.search); if (m) return m[1]; } catch { /* ignore */ }
  const nav = globalThis.navigator || {};
  const weak = (nav.hardwareConcurrency && nav.hardwareConcurrency <= 6) || (nav.deviceMemory && nav.deviceMemory <= 4);
  return weak ? 'medium' : 'high';
}

export function createPresenter({ kitCanvas, quality, canvasParent = null } = {}) {
  quality = pickQuality(quality);
  const info = { active: false, ready: false, failed: false, view: 'bat', quality };
  const P = { info, kitCanvas, quality, canvas: null, stage: null, V: null, cam: null, visible: false, size: { w: 0, h: 0 }, fit: null, dir: null };

  async function init() {
    const V = await import(LIB);
    P.V = V;
    const doc = globalThis.document;
    const canvas = doc.createElement('canvas');
    canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100dvh;display:block;pointer-events:none;z-index:0;visibility:hidden';
    const parent = canvasParent || kitCanvas.parentElement;
    parent.insertBefore(canvas, kitCanvas);
    kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
    // a dimming gradient over the whole screen (letterbox bars included) used behind the title menu
    const shade = doc.createElement('div');
    shade.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:1;opacity:0;background:linear-gradient(to bottom,rgba(2,24,32,0.1),rgba(2,24,32,0.55) 45%,rgba(2,24,32,0.92));transition:opacity .2s';
    parent.insertBefore(shade, kitCanvas); P.shade = shade;
    const stage = V.createStage({ canvas, quality, dprCap: 2, lighting: 'day', mode: 'continuous', shadows: false });
    if (!stage.supported) { canvas.remove(); info.failed = true; return; }
    P.canvas = canvas; P.stage = stage; P.cam = stage.camera;
    stage.onContextLost(() => { info.active = false; });
    // after a context restore the size / pixel ratio / backdrop pass runs again (the GL state is gone)
    stage.onContextRestored(() => { P.size = { w: 0, h: 0 }; P.dir && (P.dir.epoch = 0); P.epoch = (P.epoch || 0) + 1; stage.invalidate(); });
    stage.setLighting('day', { exposure: 1.08, hemi: 1.05 });
    const mod = await import('./director.js');
    P.dir = await mod.createDirector(P);
    info.ready = true;
  }
  P.ready = init().catch((e) => { info.failed = true; info.active = false; info.error = String((e && e.stack) || e); console.warn('view3d: staying with the flat 2D picture', info.error); });

  // Fluid layout: the 3D canvas always fills the whole screen (CSS 100vw x 100dvh). Whenever the css size or the live virtual size changes
  // (rotation, resize, split screen) the renderer is resized, the pixel ratio re-budgeted and the camera is re-fitted from VIEW in renderView.
  const sizeCheck = () => {
    const w = kitCanvas.clientWidth || globalThis.innerWidth, h = kitCanvas.clientHeight || globalThis.innerHeight;
    const vk = `${VIEW.w}x${VIEW.h}`;
    if (w !== P.size.w || h !== P.size.h || vk !== P.vk) {
      P.size = { w, h }; P.cssW = w; P.cssH = h; P.vk = vk;
      P.stage.setSize(w, h);
      const r = P.stage.renderer, cur = r.getPixelRatio();
      const dpr = Math.max(1, Math.min(cur, Math.sqrt(PIXEL_BUDGET / Math.max(1, w * h))));
      if (Math.abs(dpr - cur) > 0.01) { r.setPixelRatio(dpr); r.setSize(w, h, false); }
      P.dpr = dpr; perfLevel = 0; perfN = 0; perfSum = 0;
      P.stage.invalidate();
    }
  };

  // adaptive quality: if frames run long, drop the pixel ratio
  let perfN = 0, perfSum = 0, perfLast = 0, perfLevel = 0;
  function perfTick() {
    const now = globalThis.performance.now();
    if (perfLast) { const d = now - perfLast; if (d < 250) { perfSum += d; perfN++; } }
    perfLast = now;
    if (perfN >= 90) {
      const avg = perfSum / perfN; perfN = 0; perfSum = 0;
      if (avg > 22 && perfLevel < 2) { perfLevel++; P.stage.renderer.setPixelRatio(perfLevel === 1 ? Math.min(1.5, P.stage.renderer.getPixelRatio()) : 1); P.stage.invalidate(); }
    }
  }

  P.frame = (G) => {
    if (!info.ready || info.failed) { info.active = false; return; }
    if (P.stage.contextLost) { info.active = false; return; }
    const s = G.sim;
    const want = !!(s && G.show3d);
    if (!want) { if (P.shade && P.shade.style.opacity !== '0') P.shade.style.opacity = '0'; info.active = false; if (P.visible) { P.canvas.style.visibility = 'hidden'; P.visible = false; P.dir.setVisibleWorld(false); } return; }
    sizeCheck();
    if (P.shade) {
      const o = G.shade ? '1' : '0'; if (P.shade.style.opacity !== o) P.shade.style.opacity = o;
      const wide = !!G.land; if (P.shadeWide !== wide) { P.shadeWide = wide; P.shade.style.background = wide ? 'linear-gradient(to right,rgba(2,24,32,0.78),rgba(2,24,32,0.45) 50%,rgba(2,24,32,0.78))' : 'linear-gradient(to bottom,rgba(2,24,32,0.1),rgba(2,24,32,0.55) 45%,rgba(2,24,32,0.92))'; }
    }
    if (!P.visible) { P.canvas.style.visibility = 'visible'; P.visible = true; }
    P.dir.world.group.visible = true;
    info.active = true;
    P.dir.frame(G, G.viewOverride);
    perfTick();
  };

  P.wrap = (game) => {
    const r = game.render.bind(game);
    game.render = (ctx, view) => {
      const G = game.getState();
      view.cssW = kitCanvas.clientWidth || 720; view.cssH = kitCanvas.clientHeight || 1280;
      G.gl = info;   // the 2D side reads this to know whether a flat fallback picture is needed
      r(ctx, view);
      P.frame(G);
    };
    return game;
  };
  return P;
}

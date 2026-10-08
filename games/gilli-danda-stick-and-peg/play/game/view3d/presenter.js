// Gilli-Danda: the 3D presenter. It only READS the sim (game.getState()) and draws the village, the people, the gilli and the camera in a
// WebGL canvas behind the kit's transparent 2D canvas (HUD, menus, Rules, About stay 2D). Nothing here writes back to the sim.
// If WebGL2 or the 3D assets are unavailable, `info.active` stays false and the game keeps its 2D ground (src/scene2d.js).
import { wants3d } from '../src/view.js';
import { LY, syncLayout } from '../src/layout.js';

const LIB = '../vendor3d/index.js';

function pickQuality(q) {
  if (q) return q;
  try { const m = /[?&]q=(low|medium|high)/.exec(globalThis.location.search); if (m) return m[1]; } catch { /* ignore */ }
  const nav = globalThis.navigator || {};
  // Draw calls stay near 60 on every tier, so the cost is pixels and shadows: phones (touch, small screen) start on medium, very weak ones on low; tablets and desktops on high.
  const touch = !!(globalThis.matchMedia && globalThis.matchMedia('(pointer: coarse)').matches) || (nav.maxTouchPoints || 0) > 0;
  const short = Math.min(globalThis.screen?.width || 1000, globalThis.screen?.height || 1000);
  const veryWeak = (nav.deviceMemory && nav.deviceMemory <= 2) || (nav.hardwareConcurrency && nav.hardwareConcurrency <= 4);
  if (veryWeak) return 'low';
  const weak = (nav.hardwareConcurrency && nav.hardwareConcurrency <= 6) || (nav.deviceMemory && nav.deviceMemory <= 4);
  return weak || (touch && short < 700) ? 'medium' : 'high';
}

export function createPresenter({ kitCanvas, quality, canvasParent = null } = {}) {
  quality = pickQuality(quality);
  const info = { active: false, ready: false, failed: false, cam: null };
  const P = { info, kitCanvas, quality, canvas: null, stage: null, V: null, visible: false, size: { w: 0, h: 0 }, cssW: 1, cssH: 1 };

  async function init() {
    const V = await import(LIB);
    P.V = V;
    const doc = globalThis.document;
    const canvas = doc.createElement('canvas');
    canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100dvh;display:block;pointer-events:none;z-index:0;visibility:hidden';
    const parent = canvasParent || kitCanvas.parentElement;
    parent.insertBefore(canvas, kitCanvas);
    kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
    const stage = V.createStage({ canvas, quality, dprCap: 2, lighting: 'evening', mode: 'continuous', shadowSize: 3 });
    if (!stage.supported) { canvas.remove(); info.failed = true; return; }
    P.canvas = canvas; P.stage = stage; P.cam = stage.camera;
    stage.onContextLost(() => { info.active = false; P.lost = true; });
    stage.onContextRestored(() => { P.lost = false; P.size = { w: 0, h: 0 }; stage.invalidate(); });
    const mod = await import('./director.js');
    P.dir = mod.createDirector(P);
    await P.dir.init();
    info.ready = true;
  }
  P.ready = init().catch((e) => { info.failed = true; info.active = false; info.error = String(e && e.stack || e); console.warn('view3d: staying with the 2D ground', info.error); });

  const PIXEL_BUDGET = 3.0e6;
  const sizeCheck = () => {
    const w = kitCanvas.clientWidth || globalThis.innerWidth, h = kitCanvas.clientHeight || globalThis.innerHeight;
    if (w !== P.size.w || h !== P.size.h) {
      P.size = { w, h }; P.cssW = w; P.cssH = h;
      P.stage.setSize(w, h);
      const r = P.stage.renderer, cur = r.getPixelRatio();
      const dpr = Math.max(1, Math.min(cur, Math.sqrt(PIXEL_BUDGET / Math.max(1, w * h))));
      if (Math.abs(dpr - cur) > 0.01) { r.setPixelRatio(dpr); r.setSize(w, h, false); }
      P.dpr = dpr;
    }
  };

  P.pre = (state) => {
    if (!info.ready || info.failed || P.stage.contextLost) { info.active = false; return; }
    P.mode = wants3d(state.scene) ? state.scene : null;
    info.active = !!P.mode;
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
      syncLayout(view?.width ?? LY.w, view?.height ?? LY.h);
      const st = game.getState();
      P.pre(st);
      ctx.clearRect(0, 0, LY.w, LY.h);
      r(ctx, view);
      P.frame(st);
    };
    return game;
  };
  return P;
}

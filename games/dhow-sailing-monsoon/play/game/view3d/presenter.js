// Dhow Sailing: the 3D presenter. It only READS the sim (game.getState()) and draws the sea, sky, dhow and coasts in a WebGL canvas behind
// the kit's transparent 2D canvas (HUD, menus, Rules, About stay 2D). If WebGL2 or the 3D assets are missing, `info.active` stays false
// and the game keeps its 2D sea (src/scene2d.js).
import { wants3d } from '../src/view.js';
import { LY, syncLayout } from '../src/layout.js';

const LIB = '../vendor3d/index.js';

function pickQuality(q) {
  if (q) return q;
  try { const m = /[?&]q=(low|medium|high)/.exec(globalThis.location.search); if (m) return m[1]; } catch { /* ignore */ }
  const nav = globalThis.navigator || {};
  const touch = (nav.maxTouchPoints || 0) > 0 || (globalThis.matchMedia && globalThis.matchMedia('(pointer: coarse)').matches);
  const weak = (nav.hardwareConcurrency && nav.hardwareConcurrency <= 4) || (nav.deviceMemory && nav.deviceMemory <= 3);
  // Touch devices start on 'medium' (shadows, pixel ratio 1.5); the governor below steps down further if frames run slow (target 30+ fps).
  return weak ? 'low' : touch ? 'medium' : 'high';
}

export function createPresenter({ kitCanvas, quality, canvasParent = null } = {}) {
  quality = pickQuality(quality);
  const info = { active: false, ready: false, failed: false, cam: null, credits: null, quality };
  const P = { info, kitCanvas, quality, canvas: null, stage: null, V: null, visible: false, size: { w: 0, h: 0 }, last: 0 };

  async function init() {
    const V = await import(LIB);
    P.V = V;
    const doc = globalThis.document;
    const canvas = doc.createElement('canvas');
    canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100dvh;display:block;pointer-events:none;z-index:0;visibility:hidden';
    const parent = canvasParent || kitCanvas.parentElement;
    parent.insertBefore(canvas, kitCanvas);
    kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
    const stage = V.createStage({ canvas, quality, dprCap: 2, lighting: 'day', mode: 'continuous', shadowSize: 14, fov: 52 });
    if (!stage.supported) { canvas.remove(); info.failed = true; return; }
    P.canvas = canvas; P.stage = stage;
    stage.onContextLost(() => { info.active = false; P.lost = true; });
    stage.onContextRestored(() => { P.lost = false; P.size = { w: 0, h: 0 }; stage.invalidate(); });
    const mod = await import('./director.js');
    P.dir = mod.createDirector(P);
    await P.dir.init();
    info.ready = true;
  }
  P.ready = init().catch((e) => { info.failed = true; info.active = false; info.error = String((e && e.stack) || e); console.warn('view3d: staying with the 2D sea', info.error); });

  const PIXEL_BUDGET = 2.6e6;
  const sizeCheck = () => {
    const w = kitCanvas.clientWidth || globalThis.innerWidth, h = kitCanvas.clientHeight || globalThis.innerHeight;
    if (w !== P.size.w || h !== P.size.h) {
      P.size = { w, h };
      P.stage.setSize(w, h);
      const r = P.stage.renderer, cur = r.getPixelRatio();
      const dpr = Math.max(1, Math.min(cur, Math.sqrt(PIXEL_BUDGET / Math.max(1, w * h))));
      if (Math.abs(dpr - cur) > 0.01) { r.setPixelRatio(dpr); r.setSize(w, h, false); }
      P.dpr = dpr;
    }
  };

  P.pre = (state) => {
    if (!info.ready || info.failed || P.stage.contextLost) { info.active = false; return; }
    P.mode = wants3d(state) ? state.scene : null;
    info.active = !!P.mode;
  };
  P.frame = (state) => {
    if (!info.ready || info.failed) return;
    if (!P.mode) { if (P.visible) { P.canvas.style.visibility = 'hidden'; P.visible = false; } return; }
    sizeCheck();
    if (!P.visible) { P.canvas.style.visibility = 'visible'; P.visible = true; }
    const now = globalThis.performance.now(), raw = P.last ? (now - P.last) / 1000 : 0.016, dt = Math.min(0.05, raw); P.last = now;
    // frame-time governor: ~2.5 s of slow frames in a row (average over 36 ms) drops one quality tier
    if (raw < 0.5) { P.gAcc = (P.gAcc ?? 0) + raw; P.gN = (P.gN ?? 0) + 1; if (P.gAcc >= 2.5) { const avg = P.gAcc / P.gN; P.gAcc = 0; P.gN = 0; const order = ['low', 'medium', 'high'], i = order.indexOf(P.quality); if (avg > 0.036 && i > 0 && P.stage.setQuality) { P.quality = order[i - 1]; info.quality = P.quality; P.stage.setQuality(P.quality); P.size = { w: 0, h: 0 }; } } } else { P.gAcc = 0; P.gN = 0; }
    P.dir.frame(state, P.mode, dt);
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

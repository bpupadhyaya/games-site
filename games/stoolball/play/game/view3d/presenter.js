// 3D presenter: draws the green's people and boards in a WebGL canvas behind the kit's transparent 2D canvas. It only READS the game
// (game.getState() and the stage request the 2D side leaves in src/glbridge.js) and never writes back to the simulation.
// Layer order, back to front: the WebGL canvas with the whole village green (ground, pavilion, crowd, people, paddle, boards, ball),
// then the kit canvas (rings, hints, HUD, menus, all input).
// The camera is an oblique projection that matches layout.js `proj` exactly, so every 2D overlay lines up with the 3D bodies.
// If WebGL2 or the assets are missing, or the context is lost, GL.on turns false and the flat 2D game draws everything itself.
import { GL } from '../src/glbridge.js';
import { meta } from '../src/layout.js';
const LIB = '../vendor3d/index.js';
const PIXEL_BUDGET = 2.6e6;     // css width x height x ratio^2: big tablets render at a lower ratio (never below 1)

function pickQuality(q) {
  if (q) return q;
  try { const m = /[?&]q=(low|medium|high)/.exec(globalThis.location.search); if (m) return m[1]; } catch { /* ignore */ }
  const nav = globalThis.navigator || {};
  const weak = (nav.hardwareConcurrency && nav.hardwareConcurrency <= 6) || (nav.deviceMemory && nav.deviceMemory <= 4);
  return weak ? 'medium' : 'high';
}

export function createPresenter({ kitCanvas, quality } = {}) {
  quality = pickQuality(quality);
  const info = { active: false, ready: false, failed: false, quality, frames: 0, error: null, lost: false };
  const P = { info, V: null, stage: null, dir: null, bg: null, gl: null, bgCtx: null, size: { w: 0, h: 0 }, last: null, lastT: null, visible: false, clipKey: '' };
  const doc = globalThis.document;

  async function init() {
    if (/[?&]nogl=1/.test(globalThis.location.search)) { info.failed = true; return; }   // dev: look at the flat fallback
    const V = await import(LIB);
    P.V = V;
    const parent = kitCanvas.parentElement;
    const mk = (z) => { const c = doc.createElement('canvas'); c.style.cssText = `position:fixed;inset:0;width:100vw;height:100dvh;display:block;pointer-events:none;z-index:${z};visibility:hidden`; return c; };
    const gl = mk(1), bg = null;
    parent.insertBefore(gl, kitCanvas);
    kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '2';
    const stage = V.createStage({ canvas: gl, quality, dprCap: 2, lighting: 'day', transparent: /[?&]alpha=1/.test(globalThis.location.search), shadows: quality !== 'low', shadowSize: 14, mode: 'continuous' });
    if (!stage.supported) { gl.remove(); info.failed = true; return; }
    stage.setLighting('day', { exposure: 0.92, hemi: 0.62, hemiSky: 0xdcecff, hemiGround: 0x4a7a38, keyI: 2.3, key: 0xfff1d6, rimI: 0.7 });
    stage.setSky(0xb7d4e6, 0xc3dbe8, { near: 70, far: 190 });   // haze with distance along the pitch (the camera looks along +y)
    P.stage = stage; P.bg = null; P.gl = gl; P.bgCtx = null;
    stage.onContextLost(() => { info.lost = true; GL.on = false; GL.req = null; GL.hand = null; });
    stage.onContextRestored(() => { info.lost = false; P.size = { w: 0, h: 0 }; stage.invalidate(); GL.on = info.ready; });
    const mod = await import('./director.js');
    P.dir = await mod.createDirector(P);
    info.ready = true;
    GL.on = true;
  }
  P.ready = init().catch((e) => { info.failed = true; info.active = false; GL.on = false; info.error = String((e && e.stack) || e); console.warn('view3d: staying with the flat 2D picture', info.error); });

  // The canvases always fill the screen (fluid layout): re-fit renderer + 2D backdrop whenever the css size changes.
  function sizeCheck() {
    const w = kitCanvas.clientWidth || globalThis.innerWidth, h = kitCanvas.clientHeight || globalThis.innerHeight;
    if (w === P.size.w && h === P.size.h) return;
    P.size = { w, h };
    P.stage.setSize(w, h);
    const r = P.stage.renderer, cur = r.getPixelRatio();
    const dpr = Math.max(1, Math.min(cur, Math.sqrt(PIXEL_BUDGET / Math.max(1, w * h))));
    if (Math.abs(dpr - cur) > 0.01) { r.setPixelRatio(dpr); r.setSize(w, h, false); }
    P.stage.invalidate();
  }

  let perfN = 0, perfSum = 0, perfLast = 0, perfLevel = 0;
  function perfTick() {      // if frames run long, lower the pixel ratio once or twice
    const now = globalThis.performance.now();
    if (perfLast) { const d = now - perfLast; if (d < 250) { perfSum += d; perfN++; } }
    perfLast = now;
    if (perfN >= 90) {
      const avg = perfSum / perfN; perfN = 0; perfSum = 0;
      if (avg > 24 && perfLevel < 3) {
        perfLevel++;
        const r = P.stage.renderer;
        if (perfLevel <= 2) { r.setPixelRatio(perfLevel === 1 ? Math.min(1.5, r.getPixelRatio()) : 1); P.stage.invalidate(); }
        else if (P.dir && P.dir.green) {     // still slow at pixel ratio 1: drop shadow maps and the crowd's detail (soft blobs stand in)
          try { P.stage.setQuality('low'); if (P.stage.blobs) P.stage.blobs.mesh.visible = false; const g = P.dir.green; g.shadowsOn = false; g.setLand(g.land); g.crowd && g.crowd.setQuality('low'); info.quality = 'low'; } catch { /* keep going */ }
        }
      }
    }
  }

  P.frame = (state) => {
    const req = GL.req; GL.req = null;
    if (!info.ready || info.failed || P.stage.contextLost) { info.active = false; return; }
    if (!req) { if (P.visible) { P.gl.style.visibility = 'hidden'; P.visible = false; } info.active = false; return; }
    sizeCheck();
    if (!P.visible) { P.gl.style.visibility = 'visible'; P.visible = true; }
    // animation time = the game clock's difference: it pauses with the game
    let dt = P.lastT === null ? 0 : state.t - P.lastT; P.lastT = state.t;
    dt = Math.min(Math.max(dt, 0), 0.1);
    const k = P.size.w / Math.max(1, meta.width);           // css px per virtual unit
    // clip the 3D to the stage rectangle
    const r = req.rect, key = `${Math.round(r.x * k)},${Math.round(r.y * k)},${Math.round((r.x + r.w) * k)},${Math.round((r.y + r.h) * k)},${P.size.w}x${P.size.h}`;
    if (key !== P.clipKey) {
      P.clipKey = key;
      const top = Math.max(0, r.y * k), left = Math.max(0, r.x * k), right = Math.max(0, P.size.w - (r.x + r.w) * k), bottom = Math.max(0, P.size.h - (r.y + r.h) * k);
      P.gl.style.clipPath = `inset(${top}px ${right}px ${bottom}px ${left}px)`;
    }
    P.dir.frame(state, req, dt, null, k);
    info.active = true; info.frames++;
    perfTick();
  };

  P.wrap = (game) => {
    const r = game.render.bind(game);
    game.render = (ctx, view) => { r(ctx, view); const s = game.getState(); if (s) P.frame(s); };
    return game;
  };
  try { if (/[?&]dev=1/.test(globalThis.location.search)) globalThis.__p3 = P; } catch { /* ignore */ }
  return P;
}

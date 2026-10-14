// 3D presenter for Ulu Maika (game-owned). It only READS what game.js hands over each frame (src/glhook.js): the scope rectangle,
// the course, who is rolling, the disc and the resting discs. WebGL draws the village, the players, the discs and the crowd on a
// canvas BEHIND the kit canvas; the kit canvas stays on top for chrome, text and all input. No WebGL2 / ?nogl / context lost / still
// loading: the 2D scope draws instead (gl.active is false) and the 3D scene takes over when ready.
import { gl } from '../src/glhook.js';
import { ABOUT } from '../src/content.js';
import { createScene } from './scene.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

function pickQuality() {
  try { const m = /[?&]q=(low|medium|high)/.exec(globalThis.location.search); if (m) return m[1]; } catch { /* ignore */ }
  const nav = globalThis.navigator || {};
  const weak = (nav.hardwareConcurrency && nav.hardwareConcurrency <= 4) || (nav.deviceMemory && nav.deviceMemory <= 3);
  const touch = (nav.maxTouchPoints | 0) > 0 || (globalThis.matchMedia && globalThis.matchMedia('(pointer: coarse)').matches);
  return weak ? 'low' : touch ? 'medium' : 'high';
}

// The About page lists the 3D layer's licences once they are loaded (long tokens broken so they wrap at 300 percent text).
function addCredits(text) {
  if (!text || ABOUT.some((b) => b.title === '3D players and scenery')) return;
  const brk = (s) => s.replace(/\S{13,}/g, (m) => m.replace(/([/._-])/g, '$1 ').split(' ').map((w) => w.replace(/(.{12})(?=.)/g, '$1 ')).join(' '));
  const paras = String(text).split(/\n\s*\n/).map((x) => x.replace(/^#+\s*/gm, '').replace(/\s*\n\s*/g, ' ').trim()).filter((x) => x && !/^Credits and licences for the Arcforge/.test(x) && !/^Games that ship the 3D layer/.test(x));
  if (!paras.length) return;
  ABOUT.push({ title: '3D players and scenery', p: paras.map(brk) });
}

export async function createPresenter({ kitCanvas, quality = pickQuality() }) {
  const none = { scene: null, wrap: (g) => g, ready_p: Promise.resolve(false) };
  const canvas = globalThis.document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'position:fixed;left:0;top:0;width:100vw;height:100vh;height:100dvh;display:block;pointer-events:none;z-index:0';
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  let S = null;
  try {
    S = await createScene({ canvas, quality, transparent: true, preserve: /[?&](shot|pdb)=/.test(globalThis.location.search) });
  } catch (e) { console.warn('3D scene unavailable; using the 2D scope', e); S = null; }
  if (!S) { canvas.remove(); return none; }
  const { stage } = S;
  canvas.style.visibility = 'hidden';
  const P = { scene: S, stage, ready: true, lost: false, wrap: null, ready_p: Promise.resolve(true) };
  stage.onContextLost(() => { P.lost = true; gl.active = false; });
  stage.onContextRestored(() => { P.lost = false; stage.resize(); stage.invalidate(); gl.active = P.ready; });
  try { fetch('./vendor3d/LICENSES.md').then((r) => (r.ok ? r.text() : '')).then((t) => { gl.licenses = t || ''; addCredits(t); }).catch(() => {}); } catch { /* ignore */ }
  gl.active = true;

  // adaptive quality: when frames run long, drop the pixel ratio, then the shadows
  let perfN = 0, perfSum = 0, perfLast = 0, perfLevel = 0;
  const perfTick = (now) => {
    if (perfLast) { const d = now - perfLast; if (d < 250) { perfSum += d; perfN++; } }
    perfLast = now;
    if (perfN >= 90) {
      const avg = perfSum / perfN; perfN = 0; perfSum = 0;
      if (avg > 24 && perfLevel < 3) {
        perfLevel++;
        const r = stage.renderer;
        if (perfLevel === 1) r.setPixelRatio(Math.min(1.25, r.getPixelRatio()));
        else if (perfLevel === 2) { r.setPixelRatio(1); }
        else { r.shadowMap.enabled = false; S.world.lights.key.castShadow = false; S.scene.traverse((o) => { if (o.material) for (const m of [].concat(o.material)) m.needsUpdate = true; }); }
        stage.invalidate();
      }
    }
  };

  let lastNow = 0;
  function frame(game) {
    if (P.lost || !gl.active) return;
    const F = gl.frame;
    if (!F) { canvas.style.visibility = 'hidden'; return; }
    const now = globalThis.performance.now();
    let dt = lastNow ? (now - lastNow) / 1000 : 0; lastNow = now;
    if (F.paused) dt = 0;
    dt = clamp(dt, 0, 0.1);
    void game;
    const rc = kitCanvas.getBoundingClientRect();
    const sc = rc.width / Math.max(1, F.W);                      // css px per virtual unit
    const W = Math.round(rc.width), H = Math.round(rc.height);
    const cs = canvas.style;
    if (W > 0 && H > 0 && (cs.width !== W + 'px' || cs.height !== H + 'px' || cs.left !== Math.round(rc.left) + 'px' || cs.top !== Math.round(rc.top) + 'px')) {
      cs.left = Math.round(rc.left) + 'px'; cs.top = Math.round(rc.top) + 'px'; cs.width = W + 'px'; cs.height = H + 'px'; stage.resize();
    }
    canvas.style.visibility = 'visible';
    const r = F.rect;
    const vp = { x: r.x * sc, y: r.y * sc, w: r.w * sc, h: r.h * sc, cw: W, ch: H };
    S.frame({ ...F, rect: { x: 0, y: 0, w: vp.w, h: vp.h } }, dt);
    S.render(vp);
    perfTick(now);
  }
  P.wrap = (game) => {
    const r = game.render.bind(game);
    let warned = false;
    game.render = (ctx, view) => { r(ctx, view); try { frame(game); } catch (e) { if (!warned) { warned = true; console.error('3D frame failed', e && e.stack); } } };
    return game;
  };
  return P;
}

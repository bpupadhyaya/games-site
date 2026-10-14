// Starter 3D presenter (game-owned: edit freely). Contract: it only READS the sim (game.getState()), never writes back.
// The sim stays in web/src (pure); this file and web/main.js may use the DOM, rAF, performance.now.
//
// web/main.js:
//   import { boot } from './kit/index.js';
//   import { createGame, meta } from './src/game.js';
//   import { createPresenter } from './view3d/presenter.js';
//   const canvas = document.getElementById('game');
//   const presenter = await createPresenter({ kitCanvas: canvas });
//   boot({ createGame: async (env) => presenter.wrap(await createGame(env)), meta, canvas, background: 'rgba(0,0,0,0)' });
// web/src/game.js render(ctx, view): first line  ctx.clearRect(0, 0, meta.width, meta.height);  (then HUD only)
//
// Expose from getState(): a sim clock `t` (seconds) and an `events` array of { id, type, t, ... } so the presenter can
// react without polling positions. Time-warp animations to sim times with human.playTimed(clip, 'contact', etaSeconds).
const LIB = '../vendor3d/index.js';

export async function createPresenter({ kitCanvas, quality = 'high' }) {
  let V3;
  try { V3 = await import(LIB); } catch (e) { console.warn('view3d failed to load; using the 2D fallback', e); return { stage: null, wrap: (g) => g }; }
  const { createStage, loadHuman, CameraRig } = V3;

  // WebGL canvas BEHIND the kit canvas; the (transparent) kit canvas stays on top and keeps all input.
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100dvh;display:block;pointer-events:none;z-index:0';
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative';
  kitCanvas.style.zIndex = '1';
  const stage = createStage({ canvas, quality, dprCap: 2, lighting: 'day' });
  if (!stage.supported) { canvas.remove(); return { stage: null, wrap: (g) => g }; }   // no WebGL2: keep your 2D art
  stage.onContextLost(() => {});                                                      // optional: show a 2D hint
  stage.addGround({ kind: 'grass' });

  const player = await loadHuman({ character: 'athlete_m', kit: { top: '#1f4aa8', bottoms: '#f2f2f2', socks: '#f2f2f2' } });
  stage.add(player);
  stage.track(player);            // stage.update(dt) advances tracked humans
  player.play('idle');

  const rig = new CameraRig(stage.camera);
  rig.follow(player, { distance: 5, height: 1.6, side: -2.4 });
  stage.camera.fov = 50; stage.camera.updateProjectionMatrix();

  let lastT = null, seen = -1;
  function frame(game) {
    const s = game.getState();
    // animation time = difference of the sim clock: pauses with the game, reproducible in headless runs
    let dt = lastT === null ? 0 : (s.t ?? 0) - lastT; lastT = s.t ?? 0;
    dt = Math.min(Math.max(dt, 0), 0.1);
    for (const e of s.events ?? []) {
      if (e.id <= seen) continue;
      seen = e.id;
      // react to sim events here, e.g.  if (e.type === 'swing') player.playTimed('swing2h', 'contact', e.contactT - s.t);
    }
    stage.setShadowTarget(player.position.x, 0, player.position.z);
    rig.update(dt);
    stage.update(dt);
  }

  return { stage, player, wrap(game) { const r = game.render.bind(game); game.render = (ctx, view) => { r(ctx, view); frame(game); }; return game; } };
}

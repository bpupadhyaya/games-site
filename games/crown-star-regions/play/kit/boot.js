// Browser/WebView entry point shared by every game. web/main.js calls boot() and nothing else.
// URL flags:  ?demo=1            public web demo (nothing purchasable)
//             ?seed=N            fixed RNG seed
//             ?shot=1&ticks=N    play N ticks with the seeded monkey, draw one frame, then set
//                                document.title = "shot-ready" (used by `tools/arc shots`)
import { createRng } from './rng.js';
import { createLoop, STEP } from './loop.js';
import { createInput } from './input.js';
import { createView } from './view.js';
import { createBridge } from './bridge.js';
import { createStorage } from './storage.js';
import { createMonetization } from './monetization.js';
import { createAudio } from './audio.js';
import { createMonkey } from './harness.js';

export async function boot({ createGame, meta, canvas, background }) {
  const params = new URLSearchParams(globalThis.location.search);
  const manifest = await (await fetch('./game.json')).json();
  const bridge = createBridge();
  // Bundles published to the public site carry demoOnly, so the demo cut cannot be bypassed via the URL.
  const demo = params.has('demo') || manifest.demoOnly === true;
  const seed = params.has('seed') ? Number(params.get('seed')) >>> 0 : Date.now() >>> 0;

  const env = {
    rng: createRng(seed),
    storage: createStorage({ bridge, namespace: manifest.slug }),
    monetization: createMonetization({ bridge, manifest, mode: bridge.native ? 'native' : demo ? 'demo' : 'mock' }),
    audio: createAudio(),
    config: { seed, demo },
    manifest,
  };
  await env.monetization.init().catch(() => {});

  const game = await createGame(env);
  const view = createView(canvas, { width: meta.width, height: meta.height, background });
  const input = createInput();
  const draw = () => view.frame((ctx) => game.render(ctx, view));

  if (params.has('shot')) {
    const monkey = createMonkey(seed, meta);
    const ticks = Number(params.get('ticks') ?? 600);
    for (let i = 0; i < ticks; i++) {
      monkey(input);
      game.update(STEP, input.snapshot());
      if (i % 60 === 0) await null;
    }
    // Keep presenting the frozen frame: a single draw may never reach the compositor before capture.
    const present = () => {
      draw();
      globalThis.requestAnimationFrame(present);
    };
    present();
    globalThis.document.title = 'shot-ready';
    return { game, env };
  }

  input.attach(canvas, view);
  canvas.addEventListener('pointerdown', () => env.audio.unlock(), { once: true });
  const loop = createLoop({ update: (dt) => game.update(dt, input.snapshot()), render: draw });
  globalThis.document.addEventListener('visibilitychange', () => (globalThis.document.hidden ? loop.stop() : loop.start()));
  bridge.on('app.pause', () => loop.stop());
  bridge.on('app.resume', () => loop.start());
  loop.start();
  return { game, env, loop };
}

// Headless harness: runs a game with no browser. Used by each game's tests and by
// `tools/arc check` (crash test + determinism test with random "monkey" input).
import { createRng } from './rng.js';
import { createInput } from './input.js';
import { createStorage } from './storage.js';
import { createMonetization } from './monetization.js';
import { createAudio } from './audio.js';
import { STEP } from './loop.js';

// A fake CanvasRenderingContext2D that accepts any call, so render() can be crash-tested.
export function createNullContext() {
  const gradient = { addColorStop() {} };
  const special = {
    measureText: (text) => ({ width: String(text).length * 10 }),
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
    createPattern: () => null,
    getImageData: (x, y, w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    isPointInPath: () => false,
  };
  const store = {};
  return new Proxy(store, {
    get: (target, prop) => (prop in special ? special[prop] : prop in target ? target[prop] : () => {}),
    set: (target, prop, value) => {
      target[prop] = value;
      return true;
    },
  });
}

export function createHeadlessEnv({ seed = 1, manifest, demo = false, day = 20000 }) {
  return {
    share: async () => ({ shared: false }),
    openGame() {},
    rng: createRng(seed),
    storage: createStorage({ bridge: null, namespace: manifest.slug }),
    monetization: createMonetization({ bridge: null, manifest, mode: demo ? 'demo' : 'mock' }),
    audio: createAudio(),
    config: { seed, demo, day },
    manifest,
  };
}

export function hashState(state) {
  const text = JSON.stringify(state);
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

const MONKEY_KEYS = ['Space', 'Enter', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];

// Seeded random player: call the returned function once per tick to inject taps/drags/keys.
export function createMonkey(seed, meta) {
  const chaos = createRng((seed ^ 0x9e3779b9) >>> 0);
  let heldKey = null;
  return (input) => {
    const roll = chaos.next();
    const x = chaos.range(0, meta.width);
    const y = chaos.range(0, meta.height);
    if (roll < 0.08) input.inject({ type: 'down', x, y });
    else if (roll < 0.2) input.inject({ type: 'move', x, y });
    else if (roll < 0.3) input.inject({ type: 'up', x, y });
    else if (roll < 0.34) {
      if (heldKey) input.inject({ type: 'key', code: heldKey, down: false });
      heldKey = chaos.pick(MONKEY_KEYS);
      input.inject({ type: 'key', code: heldKey, down: true });
    }
  };
}

// Drives the game for `ticks` fixed steps. script(tick, input, game) may inject scripted
// input; with monkey=true a seeded random player is layered on top.
export async function runHeadless({ createGame, meta, manifest, seed = 1, ticks = 1800, monkey = true, script = null, demo = false, day }) {
  const env = createHeadlessEnv({ seed, manifest, demo, day });
  const game = await createGame(env);
  const input = createInput();
  const ctx = createNullContext();
  const view = { width: meta.width, height: meta.height };
  const monkeyStep = monkey ? createMonkey(seed, meta) : null;

  for (let tick = 0; tick < ticks; tick++) {
    if (script) script(tick, input, game);
    if (monkeyStep) monkeyStep(input);
    game.update(STEP, input.snapshot());
    if (tick % 30 === 0) game.render(ctx, view);
    await null;
  }
  game.render(ctx, view);
  const state = game.getState();
  return { game, env, state, hash: hashState(state), ticks };
}

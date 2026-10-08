// Fixed-timestep loop: update() always receives STEP seconds, so game logic is
// identical on a 60Hz phone, a 120Hz phone and in headless tests.
export const STEP = 1 / 60;

export function createLoop({ update, render, raf, caf, now }) {
  const requestFrame = raf ?? ((fn) => globalThis.requestAnimationFrame(fn));
  const cancelFrame = caf ?? ((id) => globalThis.cancelAnimationFrame(id));
  const clock = now ?? (() => globalThis.performance.now());
  let handle = null;
  let last = 0;
  let acc = 0;

  const frame = () => {
    const t = clock();
    acc += Math.min(0.25, (t - last) / 1000);
    last = t;
    while (acc >= STEP) {
      update(STEP);
      acc -= STEP;
    }
    render(acc / STEP);
    handle = requestFrame(frame);
  };

  return {
    start() {
      if (handle !== null) return;
      last = clock();
      acc = 0;
      handle = requestFrame(frame);
    },
    stop() {
      if (handle === null) return;
      cancelFrame(handle);
      handle = null;
    },
    get running() {
      return handle !== null;
    },
  };
}

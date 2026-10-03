import { boot } from './kit/index.js';
import { createGame, meta } from './src/game.js';
import { createPresenter } from './view3d/presenter.js';

// The 3D scene is drawn in a WebGL canvas behind the kit canvas; the kit canvas (transparent) keeps HUD, menus and input.
// Without WebGL the game keeps playing with its flat 2D yard.
const canvas = document.getElementById('game');
let presenter = null;
try { if (!new URLSearchParams(location.search).has('nogl')) presenter = await createPresenter({ kitCanvas: canvas }); } catch (e) { console.warn('3D presenter unavailable', e); }

// Sound shell: a handclap (filtered noise burst), a drum (kick + hat) and a tick, synthesized with Web Audio. Display and sound code only.
function makeFx() {
  const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AC) return null;
  let ac = null, muted = false, noise = null;
  const ensure = () => { if (!ac) { ac = new AC(); const n = ac.sampleRate * 0.25; noise = ac.createBuffer(1, n, ac.sampleRate); const d = noise.getChannelData(0); let x = 12345; for (let i = 0; i < n; i++) { x = (Math.imul(x, 1664525) + 1013904223) >>> 0; d[i] = x / 2147483648 - 1; } } if (ac.state === 'suspended') ac.resume(); return ac; };
  const burst = (t, dur, freq, q, vol, type = 'bandpass') => { const s = ac.createBufferSource(); s.buffer = noise; const f = ac.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; const g = ac.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.connect(f).connect(g).connect(ac.destination); s.start(t); s.stop(t + dur + 0.02); };
  return {
    setMuted(v) { muted = v; },
    clap(v = 1) { if (muted) return; const a = ensure(); if (!a) return; const t = a.currentTime; burst(t, 0.05, 1500, 1.2, 0.5 * v); burst(t + 0.012, 0.06, 2100, 1.4, 0.4 * v); burst(t + 0.028, 0.11, 1700, 0.9, 0.3 * v); },
    kick(v = 1) { if (muted) return; const a = ensure(); if (!a) return; const t = a.currentTime; const o = a.createOscillator(), g = a.createGain(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(48, t + 0.14); g.gain.setValueAtTime(0.55 * v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.2); o.connect(g).connect(a.destination); o.start(t); o.stop(t + 0.22); },
    hat(v = 1) { if (muted) return; const a = ensure(); if (!a) return; burst(a.currentTime, 0.03, 7000, 0.7, 0.12 * v, 'highpass'); },
  };
}
const fx = makeFx();
const clock = () => globalThis.performance.now();
const params = new URLSearchParams(location.search);
const wrap = (game) => {
  gameRef = game;
  if (params.has('dev')) { window.__game = game; window.__presenter = presenter; }
  document.addEventListener('visibilitychange', () => { if (document.hidden) game.autoPause?.(); });
  if (presenter && presenter.stage) return presenter.wrap(game);
  const r = game.render.bind(game);
  game.render = (ctx, view) => { view.cssW = canvas.clientWidth || 720; view.cssH = canvas.clientHeight || 1280; view.noGL = true; r(ctx, view); };
  return game;
};
const shot = params.has('shot');
let gameRef = null;
canvas.addEventListener('wheel', (e) => { if (!gameRef) return; e.preventDefault(); const k = e.deltaMode === 1 ? 24 : e.deltaMode === 2 ? 600 : 1; const r = canvas.getBoundingClientRect(); gameRef.wheel?.(e.deltaY * k * (720 / Math.max(1, Math.min(r.width, r.height * 0.5625)))); }, { passive: false });
if (fx) canvas.addEventListener('pointerdown', () => { fx.hat(0); }, { once: true });
boot({ createGame: async (env) => wrap(await createGame({ ...env, fx, clock, config: shot ? { ...env.config, shot: true } : env.config })), meta, canvas, background: 'rgba(0,0,0,0)' });

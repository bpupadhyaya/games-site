// Deterministic store-screenshot scenes: a scripted player drives the real game through the same pointer API a person uses
// (menu taps, the SWING button held and released while the needle is in the green). Used only by `?shot=1&scene=<name>`.
// No clock and no randomness: the same seed always produces the same picture.
import { STEP } from '../kit/loop.js';

export const SCENES = ['title', 'mingo', 'aim', 'midend', 'scored', 'watch', 'rules'];

export function runScene(name, game, env, meta) {
  const input = env.input, S = game.getState();
  const step = (n = 1) => { for (let i = 0; i < n; i++) game.update(STEP, input.snapshot()); };
  const until = (fn, max = 6000) => { for (let i = 0; i < max && !fn(); i++) step(1); return fn(); };
  const tap = (x, y) => { input.inject({ type: 'down', x, y }); step(3); input.inject({ type: 'up' }); step(3); };
  const centre = (r) => [r.x + r.w / 2, r.y + r.h / 2];
  const flow = (id) => { step(2); const f = game.debug().flow.find((q) => q.id === id); if (f) tap(...centre(f)); };
  const play = () => game.debug().layout.play;
  // aim the ring by writing the guide, pick a style with a real tap, then hold SWING and release in the green
  const throwAt = (tx, ty, styleIdx) => {
    until(() => S.humanTurn && (S.m.phase === 'aim' || S.m.phase === 'mingo'));
    if (S.m.phase === 'aim') tap(...centre(play().styles[styleIdx]));
    S.guide = { style: S.m.phase === 'mingo' ? 'roll' : ['roll', 'lob', 'shot'][styleIdx], tx, ty };
    step(3);
    input.inject({ type: 'down', ...{ x: centre(play().swing)[0], y: centre(play().swing)[1] } }); step(2);
    until(() => !S.swing || !S.swing.live || Math.abs(S.swing.needle - S.swing.centre) < S.swing.half * 0.35, 900);
    input.inject({ type: 'up' }); step(2);
  };
  const settle = () => { until(() => S.m.phase !== 'fly' && S.m.phase !== 'mingo-fly', 4000); };
  const startVsComputer = () => {
    meta.width = 720; meta.height = Math.round(720 * Math.max(globalThis.innerWidth, globalThis.innerHeight) / Math.min(globalThis.innerWidth, globalThis.innerHeight));
    if (globalThis.innerWidth > globalThis.innerHeight) { const w = meta.height; meta.height = 720; meta.width = w; }
    step(30);
    flow('play'); flow('len6'); step(2);
    tap(...centre(game.debug().layout.pins.start)); step(10);
  };
  const toMingoSet = () => { throwAt(10.5, 0.1, 0); settle(); };

  S.record.thrown = Math.max(S.record.thrown | 0, 6);   // the first-throw coaching toast is not part of a store picture
  if (name === 'title') { step(120); return; }
  startVsComputer();
  if (name === 'mingo') { step(30); return; }
  toMingoSet();
  if (name === 'aim') { until(() => S.humanTurn && S.m.phase === 'aim'); step(40); const k = S.w.balls.find((b) => b.k); S.guide = { style: 'lob', tx: k.x - 0.25, ty: k.y }; S.sel = 1; step(30); return; }
  const rounds = name === 'scored' ? 12 : 3;
  for (let i = 0; i < rounds; i++) {
    if (S.m.phase === 'score' || S.scene !== 'play') break;
    until(() => (S.humanTurn && S.m.phase === 'aim') || S.m.phase === 'score', 8000);
    if (S.m.phase === 'score') break;
    const k = S.w.balls.find((b) => b.k);
    if (!k) break;
    throwAt(k.x - 0.35 + (i % 3) * 0.2, k.y + ((i % 4) - 1.5) * 0.25, i % 2 ? 1 : 0);
    settle();
  }
  if (name === 'midend') { until(() => S.humanTurn && S.m.phase === 'aim'); step(30); const k = S.w.balls.find((b) => b.k); if (k) S.guide = { style: 'roll', tx: k.x - 0.3, ty: k.y }; step(20); return; }
  if (name === 'scored') { until(() => S.m.phase === 'score', 12000); step(40); return; }
  if (name === 'watch') { S.scene = 'title'; S.paused = false; step(5); flow('watch'); step(60 * 9); return; }
  if (name === 'rules') { S.scene = 'title'; step(5); flow('rules'); step(10); return; }
}

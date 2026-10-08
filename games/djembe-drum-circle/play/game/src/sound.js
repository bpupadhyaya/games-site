// Sound routing. The browser build provides env.audio.stroke (web/audio/drumkit.js: filtered noise, layered sines, room).
// Anywhere it is missing, the same strokes are rebuilt from the kit's plain tone() so the game never goes silent.
const STACK = {
  B: [{ freq: 168, to: 74, dur: 0.5, type: 'sine', vol: 0.34 }, { freq: 112, to: 66, dur: 0.36, type: 'sine', vol: 0.16 }],
  T: [{ freq: 318, to: 280, dur: 0.26, type: 'sine', vol: 0.22 }, { freq: 744, to: 690, dur: 0.1, type: 'sine', vol: 0.08 }, { freq: 1900, to: 1500, dur: 0.02, type: 'square', vol: 0.03 }],
  S: [{ freq: 3100, to: 900, dur: 0.07, type: 'sawtooth', vol: 0.07 }, { freq: 2300, to: 700, dur: 0.06, type: 'square', vol: 0.05 }, { freq: 520, to: 430, dur: 0.12, type: 'sine', vol: 0.14 }],
  kenkeni: [{ freq: 230, to: 150, dur: 0.3, type: 'sine', vol: 0.22 }],
  sangban: [{ freq: 170, to: 105, dur: 0.4, type: 'sine', vol: 0.26 }],
  dundunba: [{ freq: 120, to: 66, dur: 0.6, type: 'sine', vol: 0.34 }],
  bell: [{ freq: 1210, to: 1200, dur: 0.18, type: 'square', vol: 0.05 }, { freq: 1735, to: 1700, dur: 0.14, type: 'square', vol: 0.035 }],
  shaker: [{ freq: 7000, to: 6500, dur: 0.05, type: 'square', vol: 0.02 }],
  click: [{ freq: 1300, to: 1300, dur: 0.03, type: 'sine', vol: 0.12 }],
};
const DJEMBE = new Set(['djA', 'djB', 'lead']);

// Play one stroke. `delay` (seconds, small) schedules it inside the audio clock so a sound lands on its exact moment.
export function strike(env, voice, stroke, vel = 0.9, delay = 0) {
  const a = env.audio;
  if (!a) return;
  if (typeof a.stroke === 'function') { a.stroke(voice, stroke, vel, delay); return; }
  const name = DJEMBE.has(voice) ? stroke : voice;
  for (const t of STACK[name] ?? []) a.tone({ ...t, vol: t.vol * vel });
}

// Short interface sounds (menu taps, joins, results) on the same kit.
export function chime(env, kind) {
  const a = env.audio;
  if (!a) return;
  if (kind === 'tap') a.tone({ freq: 520, to: 380, dur: 0.05, type: 'sine', vol: 0.07 });
  else if (kind === 'join') { a.tone({ freq: 392, to: 392, dur: 0.22, type: 'triangle', vol: 0.06 }); a.tone({ freq: 587, to: 587, dur: 0.3, type: 'triangle', vol: 0.05 }); }
  else if (kind === 'win') { a.tone({ freq: 523, to: 784, dur: 0.4, type: 'triangle', vol: 0.07 }); a.tone({ freq: 784, to: 1046, dur: 0.5, type: 'sine', vol: 0.05 }); }
  else if (kind === 'miss') a.tone({ freq: 160, to: 110, dur: 0.12, type: 'triangle', vol: 0.05 });
}

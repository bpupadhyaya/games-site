// Procedural hand-drum voices on Web Audio: djembe bass / tone / slap, three dundun, bell, shaker, click.
// Browser only. web/main.js hands it to the game as env.audio.stroke(voice, stroke, vel, delaySeconds). Where it is missing
// (tests, headless), src/sound.js falls back to env.audio.tone stacks. No audio files: every sound is built from oscillators
// and filtered noise, with a small room reverb and a compressor so a full circle never clips.
export function createDrumKit() {
  const AC = globalThis.AudioContext ?? globalThis.webkitAudioContext;
  let ctx = null, master = null, room = null, noise = null, muted = false;

  const init = () => {
    if (ctx || !AC) return ctx;
    ctx = new AC({ latencyHint: 'interactive' });
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 12; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.16;
    master = ctx.createGain(); master.gain.value = 1.7;
    master.connect(comp).connect(ctx.destination);
    // A tiny room: two filtered feedback delays.
    room = ctx.createGain(); room.gain.value = 0.2;
    const mix = ctx.createGain(); mix.gain.value = 1;
    for (const [d, f] of [[0.031, 0.32], [0.047, 0.28]]) {
      const dl = ctx.createDelay(0.2); dl.delayTime.value = d;
      const fb = ctx.createGain(); fb.gain.value = f;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600;
      room.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl); lp.connect(mix);
    }
    mix.connect(comp);
    // One second of noise, from a fixed pseudo-random sequence.
    const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), d = buf.getChannelData(0);
    let s = 22695477;
    for (let i = 0; i < d.length; i++) { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; d[i] = (s / 4294967296) * 2 - 1; }
    noise = buf;
    return ctx;
  };
  const ready = () => { if (!init()) return null; if (ctx.state === 'suspended') ctx.resume(); return ctx; };

  const env = (g, t, peak, a, dec) => {
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
  };
  const out = (g, pan, wet) => {
    let node = g;
    if (ctx.createStereoPanner && pan) { const p = ctx.createStereoPanner(); p.pan.value = pan; g.connect(p); node = p; }
    node.connect(master);
    if (wet) { const w = ctx.createGain(); w.gain.value = wet; node.connect(w); w.connect(room); }
  };
  const osc = (type, f0, f1, t, dur, peak, a, pan, wet) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + Math.min(dur * 0.5, 0.12));
    env(g, t, peak, a, dur); o.connect(g); out(g, pan, wet);
    o.start(t); o.stop(t + a + dur + 0.05);
  };
  const burst = (t, dur, peak, type, freq, q, pan, wet, a = 0.001) => {
    const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noise; src.loop = true;
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    env(g, t, peak, a, dur); src.connect(f); f.connect(g); out(g, pan, wet);
    src.start(t, (t * 7.31) % 0.8); src.stop(t + a + dur + 0.05);
  };

  const voices = {
    // Djembe: goatskin head over a goblet of wood. Bass = low sine sag + woody body; tone = ringing mid; slap = bright crack.
    B(t, v, pan) {
      osc('sine', 168, 74, t, 0.62, 0.78 * v, 0.002, pan, 0.18);
      osc('sine', 112, 66, t, 0.42, 0.38 * v, 0.002, pan, 0.1);
      osc('triangle', 240, 120, t, 0.09, 0.2 * v, 0.001, pan, 0.05);
      burst(t, 0.05, 0.24 * v, 'lowpass', 520, 0.7, pan, 0.05);
    },
    T(t, v, pan) {
      osc('sine', 318, 280, t, 0.3, 0.5 * v, 0.001, pan, 0.2);
      osc('sine', 744, 690, t, 0.13, 0.18 * v, 0.001, pan, 0.15);
      osc('sine', 1190, 1120, t, 0.07, 0.07 * v, 0.001, pan, 0.1);
      burst(t, 0.035, 0.22 * v, 'bandpass', 1900, 1.2, pan, 0.08);
    },
    S(t, v, pan) {
      burst(t, 0.12, 0.95 * v, 'bandpass', 3100, 0.9, pan, 0.2);
      burst(t, 0.06, 0.6 * v, 'highpass', 4800, 0.7, pan, 0.1);
      osc('sine', 520, 430, t, 0.14, 0.3 * v, 0.001, pan, 0.18);
      osc('sine', 1280, 1150, t, 0.06, 0.1 * v, 0.001, pan, 0.1);
    },
    // Dundun: rope-tuned bass drums played with a stick; each also has a little bell-like bite.
    kenkeni(t, v, pan) { osc('sine', 230, 150, t, 0.36, 0.55 * v, 0.002, pan, 0.18); osc('triangle', 460, 300, t, 0.07, 0.16 * v, 0.001, pan, 0.06); burst(t, 0.03, 0.16 * v, 'bandpass', 2600, 1.4, pan, 0.06); },
    sangban(t, v, pan) { osc('sine', 170, 105, t, 0.46, 0.62 * v, 0.002, pan, 0.2); osc('triangle', 340, 210, t, 0.08, 0.16 * v, 0.001, pan, 0.06); burst(t, 0.03, 0.15 * v, 'bandpass', 2300, 1.4, pan, 0.06); },
    dundunba(t, v, pan) { osc('sine', 120, 66, t, 0.7, 0.8 * v, 0.003, pan, 0.22); osc('triangle', 240, 130, t, 0.09, 0.17 * v, 0.001, pan, 0.06); burst(t, 0.035, 0.14 * v, 'bandpass', 1800, 1.2, pan, 0.06); },
    bell(t, v, pan) { for (const [f, p, d] of [[1210, 0.2, 0.26], [1735, 0.16, 0.2], [2490, 0.08, 0.14], [3320, 0.05, 0.08]]) osc('square', f, f * 0.995, t, d, p * v * 0.85, 0.001, pan, 0.14); burst(t, 0.02, 0.1 * v, 'highpass', 5000, 0.8, pan, 0.05); },
    shaker(t, v, pan) { burst(t, 0.07, 0.55 * v, 'highpass', 6500, 0.8, pan, 0.05, 0.012); },
    click(t, v) { osc('sine', v > 0.9 ? 1500 : 1100, 0, t, 0.04, 0.5 * v, 0.001, 0, 0); },
  };
  // Where each voice sits in the circle (stereo position).
  const PAN = { djA: 0, lead: 0, djB: 0.35, bell: -0.45, kenkeni: -0.3, dundunba: -0.15, sangban: 0.15, shaker: 0.5, click: 0 };

  return {
    unlock: () => void ready(),
    setMuted(v) { muted = v; },
    get muted() { return muted; },
    get baseLatency() { return ctx ? (ctx.baseLatency || 0) + (ctx.outputLatency || 0) : 0; },
    // voice: 'djA' | 'djB' | 'lead' | 'bell' | ...; stroke: 'B' | 'T' | 'S' for djembe voices.
    stroke(voice, stroke, vel = 0.9, delay = 0) {
      if (muted) return;
      const ac = ready(); if (!ac) return;
      const t = ac.currentTime + Math.max(0.001, delay);
      const name = voice === 'djA' || voice === 'djB' || voice === 'lead' ? stroke : voice;
      const fn = voices[name]; if (!fn) return;
      fn(t, Math.min(1, Math.max(0.1, vel)), PAN[voice] ?? 0);
    },
  };
}

// Impact sounds for Golden Sling: strike (stone hits a bird), whoosh (stone in flight) and ground thud (stone lands). Procedural WebAudio on the game's
// OWN AudioContext (the kit's audio.tone has no noise source). Rules, from the owner:
//  - every effect is ONE short shot with a gain envelope that reaches zero, its sources are stopped on a schedule and disconnected afterwards;
//  - no loops, no timers, nothing plays unless an event happened; at most MAX_VOICES at once (the oldest is stolen); stopAll() ramps everything to zero within 60 ms;
//  - mute follows the game's sound button (isMuted()), Calm mode does not change sounds.
// The context comes from `makeCtx()` so tests can supply a fake one; with no AudioContext (headless) everything is a silent no-op that still keeps its bookkeeping.
const MAX_VOICES = 6;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function createSfx({ makeCtx, isMuted }) {
  let ac = null, master = null, noise = null;
  const voices = [];   // { gain, nodes, end }
  const ensure = () => {
    if (ac) return ac;
    ac = makeCtx ? makeCtx() : null;
    if (!ac) return null;
    master = ac.createGain(); master.gain.value = 0.8;
    const comp = ac.createDynamicsCompressor?.();
    if (comp) { master.connect(comp); comp.connect(ac.destination); } else master.connect(ac.destination);
    noise = ac.createBuffer(1, Math.floor(ac.sampleRate * 0.6), ac.sampleRate);
    const d = noise.getChannelData(0); let a = 12345;
    for (let i = 0; i < d.length; i++) { a = (a * 1664525 + 1013904223) >>> 0; d[i] = a / 2147483648 - 1; }   // deterministic white noise
    return ac;
  };
  const release = (v) => { for (const n of v.nodes) { try { n.disconnect(); } catch { /* already gone */ } } };
  const prune = () => {
    if (!ac) return;
    for (let i = voices.length - 1; i >= 0; i--) if (ac.currentTime >= voices[i].end) { release(voices[i]); voices.splice(i, 1); }
  };
  const kill = (v, fade = 0.03) => {
    const t = ac.currentTime;
    try { v.gain.gain.cancelScheduledValues(t); v.gain.gain.setValueAtTime(v.gain.gain.value, t); v.gain.gain.linearRampToValueAtTime(0, t + fade); for (const n of v.nodes) n.stop?.(t + fade + 0.005); } catch { /* ignore */ }
    v.end = t + fade + 0.01; v.killed = true;
  };
  // Starts one voice: `parts` = [{ type:'osc', wave, f0, f1, dur } | { type:'noise', filter, freq, q, dur }], shared gain envelope { peak, attack, dur }.
  const play = (parts, env, delay = 0) => {
    if (isMuted?.() || !ensure()) return null;
    if (ac.state === 'suspended') ac.resume?.();
    prune();
    for (let live = voices.filter((v) => !v.killed); live.length >= MAX_VOICES; live = voices.filter((v) => !v.killed)) kill(live[0], 0.02);   // steal the oldest
    const t = ac.currentTime + delay, g = ac.createGain(), nodes = [g];
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(env.peak, t + (env.attack ?? 0.004)); g.gain.exponentialRampToValueAtTime(0.0005, t + env.dur); g.gain.linearRampToValueAtTime(0, t + env.dur + 0.02);
    g.connect(master);
    for (const p of parts) {
      let src;
      if (p.type === 'osc') {
        src = ac.createOscillator(); src.type = p.wave; src.frequency.setValueAtTime(p.f0, t);
        if (p.f1) src.frequency.exponentialRampToValueAtTime(p.f1, t + p.dur);
        src.connect(g);
      } else {
        src = ac.createBufferSource(); src.buffer = noise;
        const f = ac.createBiquadFilter(); f.type = p.filter; f.frequency.value = p.freq; f.Q.value = p.q ?? 0.8;
        src.connect(f); f.connect(g); nodes.push(f);
      }
      nodes.push(src); src.start(t); src.stop(t + env.dur + 0.04);
    }
    const v = { gain: g, nodes, end: t + env.dur + 0.06 };
    voices.push(v);
    return v;
  };

  return {
    // The stone meets a bird: a dull wooden/leathery thwack, a tiny feather rustle and a startled chirp. size = bird radius, heavy = the big crow / hawk.
    strike(size = 28, heavy = false) {
      const k = clamp(30 / size, 0.8, 1.35);
      if (heavy) { play([{ type: 'osc', wave: 'sine', f0: 120, f1: 45, dur: 0.24 }, { type: 'noise', filter: 'lowpass', freq: 900, dur: 0.12 }], { peak: 0.62, dur: 0.26 }); }
      else play([{ type: 'osc', wave: 'sine', f0: 190 * k, f1: 70 * k, dur: 0.1 }, { type: 'noise', filter: 'lowpass', freq: 1800, dur: 0.07 }], { peak: 0.5, dur: 0.14 });
      play([{ type: 'noise', filter: 'bandpass', freq: 4200, q: 1.2, dur: 0.14 }], { peak: 0.07, dur: 0.14 }, 0.02);   // feather rustle
      play([{ type: 'osc', wave: 'triangle', f0: 1700 * k, f1: 2500 * k, dur: 0.09 }], { peak: 0.05, dur: 0.1 }, 0.05);   // startled chirp
    },
    // The predator is hit: ONE short startled shriek (0.3 s) with a few feathers.
    flinch() {
      play([{ type: 'osc', wave: 'triangle', f0: 3000, f1: 1500, dur: 0.22 }, { type: 'noise', filter: 'bandpass', freq: 3500, q: 1, dur: 0.12 }], { peak: 0.22, dur: 0.26 });
      play([{ type: 'osc', wave: 'sawtooth', f0: 1900, f1: 900, dur: 0.18 }], { peak: 0.08, dur: 0.2 }, 0.1);
    },
    // A stone in flight: a soft whoosh. Returns a handle; cancel(handle) ends it quickly (stone landed, hit or left the screen).
    whoosh(power = 1) {
      return play([{ type: 'noise', filter: 'bandpass', freq: 1100 + 500 * power, q: 0.7, dur: 0.55 }], { peak: 0.07 * clamp(power, 0.4, 1.3), attack: 0.06, dur: 0.55 });
    },
    cancel(v) { if (v && ac && voices.includes(v)) kill(v, 0.05); },
    // The stone touches the ground: ONE low thud on soil with a faint dust puff, scaled by impact speed (lower for the Wide stone).
    ground(speed = 600, heavy = false) {
      const vol = clamp(speed / 900, 0.25, 1), f = heavy ? 70 : 95;
      play([{ type: 'osc', wave: 'sine', f0: f, f1: f * 0.55, dur: 0.16 }, { type: 'noise', filter: 'lowpass', freq: heavy ? 380 : 520, dur: 0.1 }], { peak: 0.34 * vol, dur: 0.2 });
    },
    // Safety: the screen changed (level end, Rules, Auto Play, pause): every active effect ramps to zero within 60 ms and stops.
    stopAll() { if (!ac) return; for (const v of voices) if (!v.killed) kill(v, 0.05); },
    // Housekeeping (called every update): disconnects finished voices.
    tick() { prune(); },
    active() { prune(); return voices.length; },
    unlock() { if (isMuted?.()) return; ensure(); ac?.resume?.(); },
  };
}

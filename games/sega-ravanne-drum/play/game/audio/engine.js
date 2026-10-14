// Sega Ravanne Drum: the sound engine (Web Audio). It lives OUTSIDE web/src because it touches the browser (the game core stays pure).
// The kit's env.audio can only play a tone "now"; a rhythm game needs sounds scheduled on the audio clock, so this module owns its own
// AudioContext and is handed to the game as env.rhythm. Everything is synthesised (no recordings):
//   boom/slap  goat-skin frame drum (pitch follows skin tension)   ting  triangle   shake  seed rattle   warm/crackle  fire
//   band       shk shuffle, bass, knock, clap, bell
// Scheduled sounds go through an "epoch" gain so a pause can silence everything not yet heard.
// Song time -> audio time uses an offset that is smoothed over the last second, so frame jitter never reaches the ear.

export function createEngine() {
  const AC = globalThis.AudioContext ?? globalThis.webkitAudioContext;
  let ctx = null, comp = null, dry = null, verb = null, noise = null, live = null, epoch = null;
  let muted = false, offset = 0, haveOffset = false;

  function ensure() {
    if (!AC) return null;
    if (!ctx) {
      try { ctx = new AC({ latencyHint: 'interactive' }); } catch { ctx = new AC(); }
      comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -15; comp.knee.value = 12; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.2;
      dry = ctx.createGain(); dry.gain.value = 0.9; dry.connect(comp); comp.connect(ctx.destination);
      const conv = ctx.createConvolver();
      const len = Math.floor(ctx.sampleRate * 1.7), buf = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); let lp = 0; for (let i = 0; i < len; i++) { const k = i / len; lp += ((Math.random() * 2 - 1) - lp) * (0.5 + 0.4 * (1 - k)); d[i] = lp * Math.pow(1 - k, 2.8) * (i < 300 ? i / 300 : 1); } }
      conv.buffer = buf;
      const pre = ctx.createDelay(0.1); pre.delayTime.value = 0.018;
      const vlp = ctx.createBiquadFilter(); vlp.type = 'lowpass'; vlp.frequency.value = 4800;
      verb = pre; pre.connect(vlp); vlp.connect(conv);
      const wet = ctx.createGain(); wet.gain.value = 0.42; conv.connect(wet); wet.connect(comp);
      noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const nd = noise.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
      live = ctx.createGain(); live.connect(dry); live.connect(verb); newEpoch();
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }
  function newEpoch() {
    const old = epoch;
    epoch = ctx.createGain(); epoch.gain.value = 1; epoch.connect(dry); epoch.connect(verb);
    if (old) { const t = ctx.currentTime; old.gain.cancelScheduledValues(t); old.gain.setValueAtTime(old.gain.value, t); old.gain.linearRampToValueAtTime(0, t + 0.015); setTimeout(() => { try { old.disconnect(); } catch {} }, 1500); }
  }

  const env = (g, t, peak, attack, dec) => { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + attack + dec); };
  function tone(out, t, type, f0, f1, peak, dec, attack = 0.003) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dec * 0.7);
    env(g, t, peak, attack, dec); o.connect(g); g.connect(out); o.start(t); o.stop(t + dec + attack + 0.05);
  }
  function hiss(out, t, freq, q, peak, dec, sweepTo = 0, type = 'bandpass') {
    const s = ctx.createBufferSource(); s.buffer = noise; s.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dec);
    const g = ctx.createGain(); env(g, t, peak, Math.min(0.02, dec * 0.4), dec);
    s.connect(f); f.connect(g); g.connect(out); s.start(t, Math.random() * 0.5); s.stop(t + dec + 0.06);
  }

  const VOICE = {
    // the player's instruments (pitch = skin tension: slack 0.85 .. warm 1.15)
    boom: (o, t, v, p) => { tone(o, t, 'sine', 170 * p, 66 * p, 0.95 * v, 0.34); tone(o, t, 'triangle', 340 * p, 150 * p, 0.28 * v, 0.1); hiss(o, t, 700, 0.8, 0.3 * v, 0.07, 220, 'lowpass'); },
    slap: (o, t, v, p) => { tone(o, t, 'triangle', 900 * p, 520 * p, 0.5 * v, 0.1); tone(o, t, 'sine', 1900 * p, 1300 * p, 0.14 * v, 0.05); hiss(o, t, 3400, 1.1, 0.55 * v, 0.07); },
    ting: (o, t, v) => { [1, 2.76, 5.4, 8.9].forEach((m, i) => tone(o, t, 'sine', 1180 * m, 1180 * m * 0.999, (0.34 / (i + 1)) * v, 1.1 / (1 + i * 0.6), 0.001)); hiss(o, t, 7000, 1.5, 0.12 * v, 0.02); },
    shake: (o, t, v) => { for (let i = 0; i < 4; i++) hiss(o, t + i * 0.026, 5200 + i * 300, 1.6, (0.5 - i * 0.07) * v, 0.05); hiss(o, t, 2600, 1.2, 0.22 * v, 0.14); },
    warm: (o, t, v) => { hiss(o, t, 1100, 0.9, 0.42 * v, 0.28, 2600); tone(o, t, 'sine', 180, 330, 0.16 * v, 0.34, 0.06); for (let i = 0; i < 4; i++) hiss(o, t + 0.05 + i * 0.07, 4800, 2, 0.14 * v, 0.02); },
    crackle: (o, t, v) => { hiss(o, t, 4200 + Math.random() * 2000, 2.2, 0.16 * v, 0.02); },
    // the band
    shk: (o, t, v) => { hiss(o, t, 6000, 1.3, 0.3 * v, 0.045); },
    bass: (o, t, v) => { tone(o, t, 'sine', 98, 62, 0.8 * v, 0.3); tone(o, t, 'triangle', 196, 124, 0.12 * v, 0.1); },
    knock: (o, t, v) => { tone(o, t, 'triangle', 640, 470, 0.4 * v, 0.06); tone(o, t, 'sine', 1280, 940, 0.16 * v, 0.04); hiss(o, t, 2400, 2, 0.15 * v, 0.03); },
    clap: (o, t, v) => { for (let i = 0; i < 3; i++) hiss(o, t + i * 0.011, 1500, 0.9, 0.4 * v, 0.05); hiss(o, t, 2600, 0.7, 0.18 * v, 0.1); },
    bell: (o, t, v) => { [1, 2.4, 3.9].forEach((m, i) => tone(o, t, 'sine', 1560 * m, 1560 * m * 0.998, (0.18 / (i + 1)) * v, 0.5 / (1 + i * 0.7), 0.002)); },
    miss: (o, t, v) => { tone(o, t, 'sine', 90, 60, 0.26 * v, 0.14); },
  };
  function click(out, accent, at) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'square'; o.frequency.value = accent ? 1900 : 1250; env(g, at, accent ? 0.15 : 0.1, 0.001, 0.035);
    o.connect(g); g.connect(out); o.start(at); o.stop(at + 0.06);
  }

  const api = {
    get available() { return !!AC; },
    haptic(ms) { try { globalThis.navigator?.vibrate?.(ms); } catch {} },
    unlock() { ensure(); },
    setMuted(m) { muted = !!m; if (dry) dry.gain.value = muted ? 0 : 0.9; },
    now() { return ctx ? ctx.currentTime : 0; },
    sync(songT, hard = false) {
      if (!ctx) return;
      const target = ctx.currentTime - songT;
      if (!haveOffset || hard) { offset = target + 0.03; haveOffset = true; } else offset += (target - offset) * 0.02;
    },
    toSong(audioTime) { return haveOffset && ctx ? audioTime - offset : NaN; },
    // voice: name above. songT === null plays right now (the player's own move); otherwise at that song time.
    play(voice, vel = 0.8, songT = null, pitch = 1) {
      if (muted) return;
      if (!ensure() || ctx.state !== 'running') return;
      const at = songT === null ? ctx.currentTime + 0.002 : Math.max(ctx.currentTime + 0.002, songT + offset);
      const out = songT === null ? live : epoch;
      if (voice === 'accent' || voice === 'beat') { click(epoch, voice === 'accent', at); return; }
      const fn = VOICE[voice]; if (fn) fn(out, at, Math.max(0.05, Math.min(1, vel)), pitch);
    },
    flush() { if (ctx) newEpoch(); haveOffset = false; },
    eventAudioTime(domEvent) {
      if (!ctx) return 0;
      let age = 0;
      try { if (domEvent && typeof domEvent.timeStamp === 'number') age = (globalThis.performance.now() - domEvent.timeStamp) / 1000; } catch {}
      if (!(age >= 0 && age < 0.1)) age = 0;
      return ctx.currentTime - age;
    },
  };
  return api;
}

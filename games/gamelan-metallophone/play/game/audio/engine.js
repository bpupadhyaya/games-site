// Gamelan: the instrument engine (Web Audio). It lives OUTSIDE web/src because it touches the browser (the game core stays pure).
// The kit's env.audio can only play a tone "now"; a rhythm game needs sounds scheduled on the audio clock, so this module owns its own
// AudioContext and is handed to the game as env.rhythm. Everything is synthesised (no recordings):
//   bar     a bronze bar: an inharmonic partial stack (1, 2.76, 5.4, 8.9), every partial a pair of oscillators a few Hz apart so the
//           sustain shimmers (beats), a short mallet click and a quiet resonator hum under the bar
//   gong    a big hanging gong: a swelling inharmonic stack with a very slow beat and a deep sub
//   kenong  a pot gong: clear, pitched, medium sustain     kempul  a hanging gong: warmer, rounder     kethuk  a dry pot tick
// Scheduled sounds (the ensemble, the click) go through an "epoch" gain, so a pause can silence everything not yet heard.
// Song time -> audio time uses an offset that is smoothed over the last second, so frame jitter never reaches the ear.

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function createInstrumentEngine() {
  const AC = globalThis.AudioContext ?? globalThis.webkitAudioContext;
  let ctx = null, comp = null, dry = null, verb = null, noise = null, live = null, epoch = null, epochDry = null;
  let muted = false, volume = 1, offset = 0, haveOffset = false;

  function ensure() {
    if (!AC) return null;
    if (!ctx) {
      try { ctx = new AC({ latencyHint: 'interactive' }); } catch { ctx = new AC(); }
      comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -16; comp.knee.value = 14; comp.ratio.value = 3.5; comp.attack.value = 0.004; comp.release.value = 0.22;
      dry = ctx.createGain(); dry.gain.value = 0.85 * volume; dry.connect(comp);
      const lim = ctx.createDynamicsCompressor();                                   // safety limiter: dense passages never clip
      lim.threshold.value = -4; lim.knee.value = 3; lim.ratio.value = 20; lim.attack.value = 0.001; lim.release.value = 0.1;
      comp.connect(lim); lim.connect(ctx.destination);
      // A hall: 2.8 s of decaying stereo noise (darker as it fades) through a small pre-delay and a low-pass.
      const conv = ctx.createConvolver();
      const len = Math.floor(ctx.sampleRate * 2.8), buf = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); let lp = 0; for (let i = 0; i < len; i++) { const k = i / len, a = 0.4 + 0.45 * (1 - k); lp += ((Math.random() * 2 - 1) - lp) * a; d[i] = lp * Math.pow(1 - k, 2.4) * (i < 500 ? i / 500 : 1); } }
      conv.buffer = buf;
      const pre = ctx.createDelay(0.1); pre.delayTime.value = 0.026;
      const vlp = ctx.createBiquadFilter(); vlp.type = 'lowpass'; vlp.frequency.value = 4200;
      verb = pre; pre.connect(vlp); vlp.connect(conv);
      const wetGain = ctx.createGain(); wetGain.gain.value = 0.55; conv.connect(wetGain); wetGain.connect(comp);
      noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const nd = noise.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
      live = ctx.createGain(); live.connect(dry); live.connect(verb); newEpoch();
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }
  function newEpoch() {
    const old = [epoch, epochDry];
    epoch = ctx.createGain(); epoch.gain.value = 1; epoch.connect(dry); epoch.connect(verb);
    epochDry = ctx.createGain(); epochDry.gain.value = 1; epochDry.connect(dry);    // the metronome stays out of the hall reverb
    for (const o of old) if (o) { const t = ctx.currentTime; o.gain.cancelScheduledValues(t); o.gain.setValueAtTime(o.gain.value, t); o.gain.linearRampToValueAtTime(0, t + 0.015); setTimeout(() => { try { o.disconnect(); } catch {} }, 4500); }
  }

  // A partial: two oscillators a few Hz apart (the shimmer), an exponential envelope. `swell` > 0 delays the peak (gongs bloom).
  function partial(c, out, t, freq, amp, dec, beat, swell = 0.002) {
    for (const s of [-1, 1]) {
      const o = c.createOscillator(), g = c.createGain();
      o.type = 'sine'; o.frequency.value = freq + s * beat / 2;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, amp * 0.5), t + swell); g.gain.exponentialRampToValueAtTime(0.0001, t + swell + dec);
      o.connect(g); g.connect(out); o.start(t); o.stop(t + swell + dec + 0.05);
    }
  }
  function tick(c, out, t, freq, amp, dur, q = 1.2) {
    const s = c.createBufferSource(); s.buffer = noise; s.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    const sg = c.createGain(); sg.gain.setValueAtTime(0.0001, t); sg.gain.exponentialRampToValueAtTime(amp, t + 0.0015); sg.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(sg); sg.connect(out); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }

  function voice(kind, f, vel, at, out, pan) {
    const c = ctx, v = clamp(vel * (0.95 + Math.random() * 0.1), 0.05, 1), t = at;
    const g = c.createGain(), pn = c.createStereoPanner ? c.createStereoPanner() : null;
    if (pn) { pn.pan.value = pan; g.connect(pn); pn.connect(out); } else g.connect(out);
    if (kind === 'bar') {
      const dec = clamp(2.8 * Math.pow(300 / f, 0.55), 0.7, 4.6), beat = f < 200 ? 1.6 : f < 420 ? 2.8 : f < 800 ? 4.4 : 6.2;
      partial(c, g, t, f, 0.55 * v, dec, beat);
      partial(c, g, t, f * 2.756, 0.26 * v, dec * 0.42, beat * 1.3);
      partial(c, g, t, f * 5.404, 0.1 * v, dec * 0.18, beat * 1.6);
      if (f < 900) partial(c, g, t, f * 8.93, 0.04 * v, dec * 0.08, beat * 2);
      const h = c.createOscillator(), hg = c.createGain();                      // the resonator hum
      h.type = 'sine'; h.frequency.value = f; hg.gain.setValueAtTime(0.0001, t); hg.gain.exponentialRampToValueAtTime(0.16 * v, t + 0.03); hg.gain.exponentialRampToValueAtTime(0.0001, t + dec * 0.9);
      h.connect(hg); hg.connect(g); h.start(t); h.stop(t + dec);
      tick(c, g, t, clamp(f * 6, 1800, 5200), 0.3 * v, 0.014);                   // the mallet
      g.gain.value = 0.85;
    } else if (kind === 'gong') {
      const beat = 0.5;
      [[1, 0.8, 7.5, 0.05], [1.5, 0.34, 5, 0.09], [2.2, 0.3, 4, 0.12], [2.96, 0.2, 3, 0.16], [4.2, 0.1, 1.8, 0.2]].forEach(([r, a, d, sw], i) => partial(c, g, t, f * r, a * v, d, beat * (1 + i * 0.4), sw));
      const su = c.createOscillator(), sg = c.createGain(); su.type = 'sine'; su.frequency.setValueAtTime(f * 0.5, t); su.frequency.exponentialRampToValueAtTime(f * 0.48, t + 1.5);
      sg.gain.setValueAtTime(0.0001, t); sg.gain.exponentialRampToValueAtTime(0.4 * v, t + 0.06); sg.gain.exponentialRampToValueAtTime(0.0001, t + 3.2); su.connect(sg); sg.connect(g); su.start(t); su.stop(t + 3.3);
      tick(c, g, t, 420, 0.5 * v, 0.12, 0.8);
      g.gain.value = 0.3;                                                       // balance: the gong sat ~8 dB over the bars; now ~3 dB
    } else if (kind === 'kenong') {
      const o = c.createOscillator(), og = c.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(f * 1.025, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.07);
      og.gain.setValueAtTime(0.0001, t); og.gain.exponentialRampToValueAtTime(0.7 * v, t + 0.004); og.gain.exponentialRampToValueAtTime(0.0001, t + 1.7); o.connect(og); og.connect(g); o.start(t); o.stop(t + 1.8);
      partial(c, g, t, f * 2.03, 0.28 * v, 0.7, 2.2); partial(c, g, t, f * 2.9, 0.12 * v, 0.35, 3); partial(c, g, t, f * 4.1, 0.05 * v, 0.15, 3);
      tick(c, g, t, 2200, 0.35 * v, 0.02, 1.6);
      g.gain.value = 0.85;
    } else if (kind === 'kempul') {
      partial(c, g, t, f, 0.6 * v, 2.4, 1.2, 0.012); partial(c, g, t, f * 1.99, 0.22 * v, 1.2, 1.6, 0.012); partial(c, g, t, f * 3.2, 0.08 * v, 0.5, 2, 0.012);
      tick(c, g, t, 900, 0.3 * v, 0.03, 1);
      g.gain.value = 0.85;
    } else if (kind === 'kethuk') {
      const o = c.createOscillator(), og = c.createGain(); o.type = 'triangle'; o.frequency.setValueAtTime(900, t); o.frequency.exponentialRampToValueAtTime(760, t + 0.04);
      og.gain.setValueAtTime(0.0001, t); og.gain.exponentialRampToValueAtTime(0.4 * v, t + 0.002); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.13); o.connect(og); og.connect(g); o.start(t); o.stop(t + 0.16);
      partial(c, g, t, 1380, 0.15 * v, 0.07, 0); tick(c, g, t, 3600, 0.4 * v, 0.02, 1.4);
      g.gain.value = 1.6;                                                       // a dry tick is short, so it needs more level to be felt
    }
  }
  function click(accent, at, out) {
    const c = ctx, o = c.createOscillator(), og = c.createGain();
    o.type = 'square'; o.frequency.value = accent ? 1900 : 1250;
    og.gain.setValueAtTime(0.0001, at); og.gain.exponentialRampToValueAtTime(accent ? 0.14 : 0.09, at + 0.001); og.gain.exponentialRampToValueAtTime(0.0001, at + 0.035);
    o.connect(og); og.connect(out); o.start(at); o.stop(at + 0.05);
  }

  const api = {
    get available() { return !!AC; },
    haptic(ms) { try { globalThis.navigator?.vibrate?.(ms); } catch {} },
    unlock() { ensure(); },
    get ready() { return !!ctx && ctx.state === 'running'; },
    setMuted(m) { muted = !!m; if (dry) dry.gain.value = muted ? 0 : 0.85 * volume; },
    get muted() { return muted; },
    setVolume(v) { volume = v; if (dry && !muted) dry.gain.value = 0.85 * volume; },
    now() { return ctx ? ctx.currentTime : 0; },
    get outputLatency() { return ctx ? (ctx.outputLatency || ctx.baseLatency || 0) : 0; },
    // Pair the song clock with the audio clock. Called every update with the current song time.
    sync(songT, hard = false) {
      if (!ctx) return;
      const target = ctx.currentTime - songT;
      if (!haveOffset || hard) { offset = target + 0.03; haveOffset = true; } else offset += (target - offset) * 0.02;
    },
    toSong(audioTime) { return haveOffset && ctx ? audioTime - offset : NaN; },
    toAudio(songT) { return songT + offset; },
    // kind: 'bar' | 'kenong' | 'kempul' | 'gong' | 'kethuk' | 'click' (f = 'accent' | 'beat' for the click). songT = null: right now (the
    // player's own touch). Otherwise at that song time.
    play(kind, f, vel = 0.8, songT = null, pan = 0) {
      if (muted) return;
      if (!ensure() || ctx.state !== 'running') return;
      let at;
      if (songT === null) at = ctx.currentTime + 0.002; else at = Math.max(ctx.currentTime + 0.002, songT + offset);
      const out = songT === null ? live : epoch;
      if (kind === 'click') click(f === 'accent', at, epochDry); else voice(kind, f, vel, at, out, pan);
    },
    // Silence everything scheduled but not yet heard (pause, leaving a piece) and forget the clock pairing.
    flush() { if (ctx) newEpoch(); haveOffset = false; },
    // Audio time of a pointer event (DOM timeStamp is performance.now() based): the time the finger actually touched.
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

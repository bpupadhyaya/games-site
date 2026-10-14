// Santoor: the instrument engine (Web Audio). It lives OUTSIDE web/src because it touches the browser (the game core stays pure).
// The kit's env.audio can only play a tone "now"; a rhythm game needs sounds scheduled on the audio clock, so this module owns its own
// AudioContext and is handed to the game as env.rhythm. Everything is synthesised (no recordings):
//   a struck course = three slightly detuned bright harmonic waves through a filter that closes as the note settles, plus the tick of the
//   mallet and the knock of the board. Accompaniment: a tanpura-like drone and a small hand drum.
// Scheduled sounds (accompaniment, teacher) go through an "epoch" gain, so a pause can silence everything not yet heard.
// Song time -> audio time uses an offset that is smoothed over the last second, so frame jitter never reaches the ear.

export function createSantoorEngine() {
  const AC = globalThis.AudioContext ?? globalThis.webkitAudioContext;
  let ctx = null, comp = null, lim = null, dry = null, verb = null, noise = null, live = null, epoch = null, epochDry = null, wave = null, buzz = null;
  let muted = false, volume = 1, offset = 0, haveOffset = false;

  function ensure() {
    if (!AC) return null;
    if (!ctx) {
      try { ctx = new AC({ latencyHint: 'interactive' }); } catch { ctx = new AC(); }
      comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -16; comp.knee.value = 14; comp.ratio.value = 3.5; comp.attack.value = 0.004; comp.release.value = 0.25;
      dry = ctx.createGain(); dry.gain.value = 0.72 * volume; dry.connect(comp); lim = ctx.createWaveShaper();   // transparent below 0.8, a soft shoulder above it: the safety net against clipping
      const curve = new Float32Array(2049); for (let i = 0; i < curve.length; i++) { const x = (i / 1024) - 1, a = Math.abs(x); curve[i] = a <= 0.8 ? x : Math.sign(x) * (0.8 + 0.2 * Math.tanh((a - 0.8) / 0.2)); }
      lim.curve = curve; comp.connect(lim); lim.connect(ctx.destination);
      // a small wooden room: 1.9 s of decaying stereo noise, darker as it fades, with a short pre-delay
      const conv = ctx.createConvolver(), len = Math.floor(ctx.sampleRate * 1.9), buf = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); let lp = 0; for (let i = 0; i < len; i++) { const k = i / len, a = 0.5 + 0.4 * (1 - k); lp += ((Math.random() * 2 - 1) - lp) * a; d[i] = lp * Math.pow(1 - k, 2.8) * (i < 300 ? i / 300 : 1); } }
      conv.buffer = buf;
      const pre = ctx.createDelay(0.1); pre.delayTime.value = 0.018;
      const vlp = ctx.createBiquadFilter(); vlp.type = 'lowpass'; vlp.frequency.value = 4600;
      verb = pre; pre.connect(vlp); vlp.connect(conv);
      const wetGain = ctx.createGain(); wetGain.gain.value = 0.5; conv.connect(wetGain); wetGain.connect(comp);
      noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const nd = noise.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
      // the struck string's timbre: a strong fundamental, partials falling off slowly (bright), a little extra at the 3rd and 5th
      const N = 20, re = new Float32Array(N + 1), im = new Float32Array(N + 1);
      for (let n = 1; n <= N; n++) im[n] = (1 / Math.pow(n, 0.95)) * (n === 3 || n === 5 ? 1.2 : 1);
      wave = ctx.createPeriodicWave(re, im);
      const im2 = new Float32Array(N + 1); for (let n = 1; n <= N; n++) im2[n] = 1 / Math.pow(n, 0.55);
      buzz = ctx.createPeriodicWave(re, im2);
      live = ctx.createGain(); live.connect(dry); live.connect(verb); newEpoch();
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }
  function newEpoch() {
    const old = [epoch, epochDry];
    epoch = ctx.createGain(); epoch.gain.value = 1; epoch.connect(dry); epoch.connect(verb);
    epochDry = ctx.createGain(); epochDry.gain.value = 1; epochDry.connect(dry);
    for (const o of old) if (o) { const t = ctx.currentTime; o.gain.cancelScheduledValues(t); o.gain.setValueAtTime(o.gain.value, t); o.gain.linearRampToValueAtTime(0, t + 0.02); setTimeout(() => { try { o.disconnect(); } catch {} }, 1800); }
  }

  // One struck course into `out` at audio time `at`. n: note 0-15 (stereo position: left mallet's half to the left). hz: pitch. vel 0..1.
  // A santoor note is three or four strings tuned almost the same, struck by a light wooden mallet: a bright tick, a body that rings for
  // seconds, and a slow beating shimmer between the strings. short = a tremolo hit (rings less, so rapid hits do not pile up).
  function strike(n, hz, vel, at, out, short) {
    const c = ctx, v = Math.max(0.05, Math.min(1, vel * (0.96 + Math.random() * 0.08))) * Math.pow(2, 0.4 * Math.log2(Math.max(1, hz / 138))), t = at;
    const dec = (short ? 1.1 : Math.max(1.8, Math.min(4.6, 4.8 - 0.95 * Math.log2(Math.max(1, hz / 138))))) * (0.85 + 0.25 * v);
    const g = c.createGain(), pn = c.createStereoPanner ? c.createStereoPanner() : null;
    const side = (n & 1) ? 1 : -1, course = (n >> 1) / 7;
    if (pn) { pn.pan.value = side * (0.18 + 0.2 * (1 - course)); g.connect(pn); pn.connect(out); } else g.connect(out);
    const amp = c.createGain();
    amp.gain.setValueAtTime(0.0001, t); amp.gain.exponentialRampToValueAtTime(0.54 * v, t + 0.0025);
    amp.gain.exponentialRampToValueAtTime(0.26 * v, t + 0.18); amp.gain.exponentialRampToValueAtTime(0.0001, t + dec);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.6;
    lp.frequency.setValueAtTime(Math.min(12000, hz * 15), t); lp.frequency.exponentialRampToValueAtTime(Math.max(600, hz * 3.2), t + 0.5);
    lp.connect(amp); amp.connect(g);
    [[-6.5, 0.8], [0.5, 1], [7, 0.8]].forEach(([cents, gain]) => {
      const o = c.createOscillator(), og = c.createGain();
      o.setPeriodicWave(wave); o.frequency.value = hz; o.detune.value = cents; og.gain.value = gain * 0.55;
      o.connect(og); og.connect(lp); o.start(t); o.stop(t + dec + 0.1);
    });
    // the mallet: a very short bright tick and a soft knock of the wooden board
    const nz = c.createBufferSource(); nz.buffer = noise; const nf = c.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = Math.min(7500, hz * 5 + 2200); nf.Q.value = 1.4;
    const ng = c.createGain(); ng.gain.setValueAtTime(0.0001, t); ng.gain.exponentialRampToValueAtTime(0.34 * v, t + 0.001); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.016);
    nz.connect(nf); nf.connect(ng); ng.connect(g); nz.start(t, Math.random() * 0.5); nz.stop(t + 0.04);
    const kn = c.createOscillator(), kg = c.createGain(); kn.type = 'sine'; kn.frequency.setValueAtTime(240, t); kn.frequency.exponentialRampToValueAtTime(110, t + 0.05);
    kg.gain.setValueAtTime(0.0001, t); kg.gain.exponentialRampToValueAtTime(0.14 * v, t + 0.003); kg.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
    kn.connect(kg); kg.connect(g); kn.start(t); kn.stop(t + 0.1);
    g.gain.value = 0.9;
  }
  // The drone (a tanpura-like string): slow bloom, buzzing upper partials that swell and fade.
  function drone(hz, vel, at, dur, out) {
    const c = ctx, g = c.createGain(), lp = c.createBiquadFilter(), amp = c.createGain();
    lp.type = 'lowpass'; lp.Q.value = 3.2;
    lp.frequency.setValueAtTime(hz * 2.2, at); lp.frequency.exponentialRampToValueAtTime(hz * 9, at + dur * 0.35); lp.frequency.exponentialRampToValueAtTime(hz * 2.6, at + dur);
    amp.gain.setValueAtTime(0.0001, at); amp.gain.exponentialRampToValueAtTime(0.16 * vel, at + 0.06); amp.gain.exponentialRampToValueAtTime(0.0001, at + dur + 0.6);
    lp.connect(amp); amp.connect(g); g.connect(out);
    [[-3, 0.7], [3, 0.7]].forEach(([cents, gain]) => {
      const o = c.createOscillator(), og = c.createGain();
      o.setPeriodicWave(buzz); o.frequency.value = hz; o.detune.value = cents; og.gain.value = gain;
      o.connect(og); og.connect(lp); o.start(at); o.stop(at + dur + 0.7);
    });
  }
  // A hand-drum pulse: dha (bass with a ringing tone), na (high tap), tin (high ring).
  function tab(kind, vel, at, out) {
    const c = ctx, g = c.createGain(); g.connect(out);
    const tone = (f0, f1, len, peak, type = 'sine') => {
      const o = c.createOscillator(), og = c.createGain(); o.type = type; o.frequency.setValueAtTime(f0, at); o.frequency.exponentialRampToValueAtTime(f1, at + len * 0.7);
      og.gain.setValueAtTime(0.0001, at); og.gain.exponentialRampToValueAtTime(peak * vel, at + 0.003); og.gain.exponentialRampToValueAtTime(0.0001, at + len);
      o.connect(og); og.connect(g); o.start(at); o.stop(at + len + 0.05);
    };
    const tick = (f, len, peak) => {
      const nz = c.createBufferSource(); nz.buffer = noise; const nf = c.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = f; nf.Q.value = 1.2;
      const ng = c.createGain(); ng.gain.setValueAtTime(0.0001, at); ng.gain.exponentialRampToValueAtTime(peak * vel, at + 0.001); ng.gain.exponentialRampToValueAtTime(0.0001, at + len);
      nz.connect(nf); nf.connect(ng); ng.connect(g); nz.start(at, Math.random() * 0.4); nz.stop(at + len + 0.02);
    };
    if (kind === 'dha') { tone(115, 62, 0.34, 0.5); tone(330, 300, 0.22, 0.16); tick(1800, 0.03, 0.22); }
    else if (kind === 'na') { tone(560, 520, 0.1, 0.13); tick(3200, 0.02, 0.14); }
    else { tone(700, 640, 0.22, 0.14); tick(2600, 0.02, 0.1); }
  }
  function click(accent, at, out) {
    const c = ctx, o = c.createOscillator(), og = c.createGain();
    o.type = 'sine'; o.frequency.value = accent ? 1500 : 1000;
    og.gain.setValueAtTime(0.0001, at); og.gain.exponentialRampToValueAtTime(accent ? 0.14 : 0.09, at + 0.002); og.gain.exponentialRampToValueAtTime(0.0001, at + 0.05);
    o.connect(og); og.connect(out); o.start(at); o.stop(at + 0.07);
  }

  const api = {
    get available() { return !!AC; },
    haptic(ms) { try { globalThis.navigator?.vibrate?.(ms); } catch {} },
    unlock() { ensure(); },
    get ready() { return !!ctx && ctx.state === 'running'; },
    setMuted(m) { muted = !!m; if (dry) dry.gain.value = muted ? 0 : 0.72 * volume; },
    get muted() { return muted; },
    setVolume(v) { volume = v; if (dry && !muted) dry.gain.value = 0.72 * volume; },
    now() { return ctx ? ctx.currentTime : 0; },
    get outputLatency() { return ctx ? (ctx.outputLatency || ctx.baseLatency || 0) : 0; },
    sync(songT, hard = false) {
      if (!ctx) return;
      const target = ctx.currentTime - songT;
      if (!haveOffset || hard) { offset = target + 0.03; haveOffset = true; }
      else offset += (target - offset) * 0.02;
    },
    toSong(audioTime) { return haveOffset && ctx ? audioTime - offset : NaN; },
    toAudio(songT) { return songT + offset; },
    // Strike note n at pitch hz. songT = null: right now (the player's own touch). Otherwise at that song time (accompaniment, teacher).
    play(n, hz, vel = 0.8, songT = null, short = false) {
      if (muted) return;
      if (!ensure() || ctx.state !== 'running') return;
      const at = songT === null ? ctx.currentTime + 0.002 : Math.max(ctx.currentTime + 0.002, songT + offset);
      strike(n, hz, vel, at, songT === null ? live : epoch, short);
    },
    drone(hz, vel, dur, songT) {
      if (muted) return;
      if (!ensure() || ctx.state !== 'running') return;
      drone(hz, vel, Math.max(ctx.currentTime + 0.002, songT + offset), dur, epoch);
    },
    tab(kind, vel, songT) {
      if (muted) return;
      if (!ensure() || ctx.state !== 'running') return;
      tab(kind, vel, Math.max(ctx.currentTime + 0.002, songT + offset), epochDry);
    },
    click(accent, songT = null) {
      if (muted) return;
      if (!ensure() || ctx.state !== 'running') return;
      click(accent, songT === null ? ctx.currentTime + 0.002 : Math.max(ctx.currentTime + 0.002, songT + offset), epochDry);
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

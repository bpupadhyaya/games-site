// Koto: the string engine (Web Audio). It lives OUTSIDE web/src because it touches the browser (the game core stays pure).
// The kit's env.audio can only play a tone "now"; a rhythm game needs sounds scheduled on the audio clock, so this module owns its own
// AudioContext and is handed to the game as env.rhythm. Everything is synthesised (no recordings):
//   a plucked silk string = two slightly detuned harmonic waves through a filter that closes as the note settles, plus the click of
//   the finger pick (tsume) and the knock of the wooden body. A press (oshide) bends the pitch of a ringing string.
// Scheduled sounds (accompaniment, teacher) go through an "epoch" gain, so a pause can silence everything not yet heard.
// Song time -> audio time uses an offset that is smoothed over the last second, so frame jitter never reaches the ear.

export function createKotoEngine() {
  const AC = globalThis.AudioContext ?? globalThis.webkitAudioContext;
  let ctx = null, comp = null, lim = null, dry = null, verb = null, noise = null, live = null, epoch = null, epochDry = null, wave = null;
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
      // the string's timbre: strong fundamental, partials falling off like 1/n
      const N = 16, re = new Float32Array(N + 1), im = new Float32Array(N + 1);
      for (let n = 1; n <= N; n++) im[n] = (1 / Math.pow(n, 1.2)) * (n % 5 === 0 ? 0.55 : 1);
      wave = ctx.createPeriodicWave(re, im);
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

  // One plucked string into `out` at audio time `at`. s: string 0-12 (for the stereo position). hz: pitch. vel 0..1.
  // bend: { semi, at, glide } schedules a pitch rise after the pluck (the teacher's oshide). Returns a handle for bending a ringing string.
  function pluck(s, hz, vel, at, out, bend) {
    // higher strings decay faster and are filtered darker, so they are lifted (about 2.7 dB per octave) to keep the strings evenly loud
    const c = ctx, v = Math.max(0.05, Math.min(1, vel * (0.96 + Math.random() * 0.08))) * Math.pow(2, 0.45 * Math.log2(Math.max(1, hz / 147))), t = at;
    const dec = Math.max(0.9, Math.min(3.4, 3.4 - 1.05 * Math.log2(Math.max(1, hz / 147)))) * (0.8 + 0.3 * v);
    const g = c.createGain(), pn = c.createStereoPanner ? c.createStereoPanner() : null;
    if (pn) { pn.pan.value = ((s - 6) / 6) * 0.45; g.connect(pn); pn.connect(out); } else g.connect(out);
    const amp = c.createGain();
    amp.gain.setValueAtTime(0.0001, t); amp.gain.exponentialRampToValueAtTime(0.5 * v, t + 0.003);
    amp.gain.exponentialRampToValueAtTime(0.16 * v, t + 0.22); amp.gain.exponentialRampToValueAtTime(0.0001, t + dec);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.7;
    lp.frequency.setValueAtTime(Math.min(11000, hz * 9), t); lp.frequency.exponentialRampToValueAtTime(Math.max(500, hz * 2.4), t + 0.4);
    lp.connect(amp); amp.connect(g);
    const oscs = [];
    [[0, 1], [4.5, 0.55]].forEach(([cents, gain]) => {
      const o = c.createOscillator(), og = c.createGain();
      o.setPeriodicWave(wave); o.frequency.setValueAtTime(hz, t); o.detune.value = cents; og.gain.value = gain;
      o.connect(og); og.connect(lp); o.start(t); o.stop(t + dec + 0.1); oscs.push(o);
    });
    // the click of the pick and the knock of the wood
    const nz = c.createBufferSource(); nz.buffer = noise; const nf = c.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = Math.min(6500, hz * 6 + 1400); nf.Q.value = 1.1;
    const ng = c.createGain(); ng.gain.setValueAtTime(0.0001, t); ng.gain.exponentialRampToValueAtTime(0.28 * v, t + 0.0015); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.022);
    nz.connect(nf); nf.connect(ng); ng.connect(g); nz.start(t, Math.random() * 0.5); nz.stop(t + 0.05);
    const kn = c.createOscillator(), kg = c.createGain(); kn.type = 'sine'; kn.frequency.setValueAtTime(190, t); kn.frequency.exponentialRampToValueAtTime(95, t + 0.07);
    kg.gain.setValueAtTime(0.0001, t); kg.gain.exponentialRampToValueAtTime(0.2 * v, t + 0.004); kg.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    kn.connect(kg); kg.connect(g); kn.start(t); kn.stop(t + 0.12);
    g.gain.value = 0.9;
    const handle = {
      hz, t,
      bend(semi, glide = 0.12) {
        const now = Math.max(c.currentTime, handle.t), to = hz * Math.pow(2, semi / 12);
        for (const o of oscs) { try { o.frequency.cancelScheduledValues(now); o.frequency.setValueAtTime(o.frequency.value, now); o.frequency.exponentialRampToValueAtTime(to, now + glide); } catch {} }
      },
    };
    if (bend) {
      const to = hz * Math.pow(2, bend.semi / 12), b0 = t + (bend.at ?? 0.12);
      for (const o of oscs) { o.frequency.setValueAtTime(hz, b0); o.frequency.exponentialRampToValueAtTime(to, b0 + (bend.glide ?? 0.2)); }
    }
    return handle;
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
    // Pluck string s at pitch hz. songT = null: right now (the player's own touch). Otherwise at that song time (accompaniment, teacher).
    play(s, hz, vel = 0.8, songT = null, bend = null) {
      if (muted) return null;
      if (!ensure() || ctx.state !== 'running') return null;
      const at = songT === null ? ctx.currentTime + 0.002 : Math.max(ctx.currentTime + 0.002, songT + offset);
      return pluck(s, hz, vel, at, songT === null ? live : epoch, bend);
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

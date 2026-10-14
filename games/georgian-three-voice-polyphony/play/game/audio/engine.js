// Three Voices: the choir engine (Web Audio). It lives OUTSIDE web/src because it touches the browser (the game core stays pure).
// Everything is synthesised, no recordings: a voice is two slightly detuned sawtooth waves (the vocal-fold source) through three
// parallel formant band-pass filters that move between vowels, with vibrato that blooms after the onset and a little breath noise.
// Each of the three parts has two chains: an AI chain driven by scheduled notes (the friends and the teacher) and a LIVE chain the
// player's finger drives continuously (pitch every frame). Scheduled sounds go through an "epoch" gain so a pause can silence them.
// A faint shared shimmer (the tonic's octave and fifth) rises while the chord is locked.

const VOWELS = {
  a: [700, 1100, 2550], o: [450, 800, 2500], e: [520, 1800, 2550], i: [320, 2200, 3000], u: [350, 700, 2400],
};
const SYL_VOWEL = (syl) => {
  const m = String(syl || 'a').match(/[aeiou]/);
  return m ? m[0] : 'a';
};

export function createChoirEngine() {
  const AC = globalThis.AudioContext ?? globalThis.webkitAudioContext;
  let ctx = null, master = null, comp = null, lim = null, dry = null, verb = null, noiseBuf = null, epochGain = null, shimmer = null, shimmerGain = null;
  let muted = false, volume = 1, offset = 0, haveOffset = false, key = 196;
  const ai = [], live = [];

  function makeVoice(pan, shift, out) {
    const c = ctx, V = {};
    V.out = c.createGain(); V.out.gain.value = 0.0001;
    const sp = c.createStereoPanner ? c.createStereoPanner() : null;
    if (sp) { sp.pan.value = pan; V.out.connect(sp); sp.connect(out); } else V.out.connect(out);
    V.f = [];
    const gains = [1.0, 0.62, 0.3], qs = [5, 9, 11];
    const sum = c.createGain(); sum.gain.value = 1;
    for (let i = 0; i < 3; i++) {
      const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = qs[i]; f.frequency.value = VOWELS.a[i] * shift;
      const g = c.createGain(); g.gain.value = gains[i] * 3.4;
      sum.connect(f); f.connect(g); g.connect(V.out); V.f.push(f);
    }
    V.shift = shift; V.sum = sum;
    V.osc = [0, 1].map((k) => {
      const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 130; o.detune.value = k ? 7 : -5;
      const g = c.createGain(); g.gain.value = 0.17;
      o.connect(g); g.connect(sum); o.start();
      return o;
    });
    // vibrato: one LFO into both oscillators' detune, depth automated
    V.lfo = c.createOscillator(); V.lfo.frequency.value = 5.1 + Math.random() * 0.8;
    V.lfoGain = c.createGain(); V.lfoGain.gain.value = 0;
    V.lfo.connect(V.lfoGain); V.osc.forEach((o) => V.lfoGain.connect(o.detune)); V.lfo.start();
    // breath
    const nz = c.createBufferSource(); nz.buffer = noiseBuf; nz.loop = true;
    const nf = c.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 2400; nf.Q.value = 0.9;
    const ng = c.createGain(); ng.gain.value = 0.035;
    nz.connect(nf); nf.connect(ng); ng.connect(V.out); nz.start();
    V.hz = 130; V.vowel = 'a'; V.endAt = -1;
    return V;
  }

  function ensure() {
    if (!AC) return null;
    if (!ctx) {
      // iOS: the default "ambient" audio session is silenced by the ringer switch and can be interrupted; "playback" keeps the voices audible.
      try { if (globalThis.navigator?.audioSession) globalThis.navigator.audioSession.type = 'playback'; } catch {}
      try { ctx = new AC({ latencyHint: 'interactive' }); } catch { ctx = new AC(); }
      ctx.onstatechange = () => { if (ctx.state !== 'running') ctx.resume().catch(() => {}); };
      comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -18; comp.knee.value = 14; comp.ratio.value = 3.2; comp.attack.value = 0.01; comp.release.value = 0.3;
      dry = ctx.createGain(); dry.gain.value = 0.8 * volume; dry.connect(comp);
      lim = ctx.createWaveShaper();
      const curve = new Float32Array(2049); for (let i = 0; i < curve.length; i++) { const x = (i / 1024) - 1, a = Math.abs(x); curve[i] = a <= 0.8 ? x : Math.sign(x) * (0.8 + 0.2 * Math.tanh((a - 0.8) / 0.2)); }
      lim.curve = curve; comp.connect(lim); lim.connect(ctx.destination);
      // a stone cellar: 2.6 s of decaying stereo noise, dark, with a short pre-delay
      const conv = ctx.createConvolver(), len = Math.floor(ctx.sampleRate * 2.6), buf = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); let lp = 0; for (let i = 0; i < len; i++) { const k = i / len, a = 0.35 + 0.4 * (1 - k); lp += ((Math.random() * 2 - 1) - lp) * a; d[i] = lp * Math.pow(1 - k, 2.4) * (i < 400 ? i / 400 : 1); } }
      conv.buffer = buf;
      const pre = ctx.createDelay(0.1); pre.delayTime.value = 0.024;
      const vlp = ctx.createBiquadFilter(); vlp.type = 'lowpass'; vlp.frequency.value = 3800;
      verb = pre; pre.connect(vlp); vlp.connect(conv);
      const wet = ctx.createGain(); wet.gain.value = 0.42; conv.connect(wet); wet.connect(comp);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const nd = noiseBuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
      master = ctx.createGain(); master.gain.value = 1; master.connect(dry); master.connect(verb);
      epochGain = ctx.createGain(); epochGain.gain.value = 1; epochGain.connect(master);
      const liveBus = ctx.createGain(); liveBus.gain.value = 1; liveBus.connect(master);
      const PAN = [0, -0.28, 0.28], SH = [0.86, 1.0, 1.12];
      for (let p = 0; p < 3; p++) { ai.push(makeVoice(PAN[p], SH[p], epochGain)); live.push(makeVoice(PAN[p], SH[p], liveBus)); }
      // shimmer: the tonic's octave, fifth and double octave, very quiet, gain follows the chord lock
      shimmerGain = ctx.createGain(); shimmerGain.gain.value = 0; shimmerGain.connect(master);
      shimmer = [2, 3, 4].map((mult, i) => { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.value = key * mult; g.gain.value = [0.5, 0.35, 0.22][i]; o.connect(g); g.connect(shimmerGain); o.start(); return o; });
    }
    if (ctx.state !== 'running') ctx.resume().catch(() => {});
    return ctx;
  }

  // Put a vowel on a voice at audio time t (smooth morph).
  function setVowel(V, vowel, t, tc = 0.045) {
    const f = VOWELS[vowel] ?? VOWELS.a;
    for (let i = 0; i < 3; i++) V.f[i].frequency.setTargetAtTime(f[i] * V.shift, t, tc);
    V.vowel = vowel;
  }
  const hushAll = () => {
    if (!ctx) return;
    const t = ctx.currentTime;
    for (const V of [...ai, ...live]) { V.out.gain.cancelScheduledValues(t); V.out.gain.setTargetAtTime(0.0001, t, 0.04); V.lfoGain.gain.cancelScheduledValues(t); V.lfoGain.gain.setTargetAtTime(0, t, 0.05); }
    for (const V of ai) { V.osc.forEach((o) => { o.frequency.cancelScheduledValues(t); }); }
  };

  const api = {
    get available() { return !!AC; },
    haptic(ms) { try { globalThis.navigator?.vibrate?.(ms); } catch {} },
    unlock() { ensure(); },
    get ready() { return !!ctx && ctx.state === 'running'; },
    setMuted(m) { muted = !!m; if (dry) dry.gain.value = muted ? 0 : 0.8 * volume; },
    get muted() { return muted; },
    setVolume(v) { volume = v; if (dry && !muted) dry.gain.value = 0.8 * volume; },
    now() { return ctx ? ctx.currentTime : 0; },
    setKey(hz) {
      key = hz;
      if (shimmer && ctx) shimmer.forEach((o, i) => o.frequency.setTargetAtTime(hz * [2, 3, 4][i], ctx.currentTime, 0.05));
    },
    sync(songT, hard = false) {
      if (!ctx) return;
      const target = ctx.currentTime - songT;
      if (!haveOffset || hard) { offset = target + 0.03; haveOffset = true; } else offset += (target - offset) * 0.02;
    },
    toSong(audioTime) { return haveOffset && ctx ? audioTime - offset : NaN; },
    // A scheduled note on part p's AI voice: starts at song time songT, lasts dur seconds, `vel` 0..1. A little portamento from the
    // previous pitch; the vibrato blooms after the onset. If the note follows the previous one closely it is joined (legato).
    sing(p, hz, syl, songT, dur, vel = 0.7) {
      if (muted) return;
      if (!ensure()) return;
      const V = ai[p], t = Math.max(ctx.currentTime + 0.003, songT + offset), end = t + dur, legato = t - V.endAt < 0.07 && V.endAt > 0;
      const g = V.out.gain, v = Math.max(0.05, Math.min(1, vel)) * 0.9;
      if (legato) g.cancelScheduledValues(V.endAt - 0.1);
      else { g.cancelScheduledValues(t - 0.01); g.setValueAtTime(Math.max(0.0001, g.value), Math.max(ctx.currentTime, t - 0.01)); }
      g.setTargetAtTime(v, t, 0.035);
      g.setTargetAtTime(0.0001, Math.max(t + 0.05, end - 0.07), 0.05);
      for (const o of V.osc) {
        o.frequency.cancelScheduledValues(t - 0.02);
        if (!legato) o.frequency.setValueAtTime(hz, t - 0.012);
        o.frequency.setTargetAtTime(hz, t, legato ? 0.03 : 0.004);
      }
      setVowel(V, SYL_VOWEL(syl), t);
      const lg = V.lfoGain.gain; lg.cancelScheduledValues(t - 0.01); lg.setValueAtTime(legato ? lg.value : 0, t); lg.linearRampToValueAtTime(11 + Math.min(8, dur * 2), t + Math.min(0.5, dur * 0.7));
      lg.setTargetAtTime(0, Math.max(t + 0.05, end - 0.06), 0.05);
      V.endAt = end; V.hz = hz;
    },
    // The player's own voice: call every frame while a finger is down. hz = the sung pitch. Call live(p, null) on release.
    live(p, hz, syl = 'na', level = 1) {
      if (muted) return;
      if (!ensure()) return;
      const V = live[p], t = ctx.currentTime;
      if (hz === null) {
        if (V.on) { V.out.gain.cancelScheduledValues(t); V.out.gain.setTargetAtTime(0.0001, t, 0.04); V.lfoGain.gain.cancelScheduledValues(t); V.lfoGain.gain.setTargetAtTime(0, t, 0.05); V.on = false; }
        return;
      }
      if (!V.on) {
        V.on = true; V.t0 = t;
        for (const o of V.osc) { o.frequency.cancelScheduledValues(t); o.frequency.setValueAtTime(hz, t); }
        V.out.gain.cancelScheduledValues(t); V.out.gain.setValueAtTime(Math.max(0.0001, V.out.gain.value), t);
        V.lfoGain.gain.cancelScheduledValues(t); V.lfoGain.gain.setValueAtTime(0, t); V.lfoGain.gain.linearRampToValueAtTime(12, t + 0.5);
        setVowel(V, SYL_VOWEL(syl), t, 0.02);
      } else {
        if (t - V.lastT < 0.03 && Math.abs(hz / V.lastHz - 1) < 0.0006) { V.out.gain.setTargetAtTime(0.9 * Math.max(0.2, Math.min(1, level)), t, 0.03); return; }
        for (const o of V.osc) o.frequency.setTargetAtTime(hz, t, 0.016);
        if (V.vowel !== SYL_VOWEL(syl)) setVowel(V, SYL_VOWEL(syl), t);
      }
      V.lastT = t; V.lastHz = hz;
      V.out.gain.setTargetAtTime(0.9 * Math.max(0.2, Math.min(1, level)), t, 0.03);
    },
    // Lock shimmer 0..1.
    lock(level) {
      if (!ensure()) return;
      shimmerGain.gain.setTargetAtTime(muted ? 0 : 0.05 * Math.max(0, Math.min(1, level)), ctx.currentTime, 0.2);
    },
    click(accent, songT = null) {
      if (muted) return;
      if (!ensure()) return;
      const at = songT === null ? ctx.currentTime + 0.002 : Math.max(ctx.currentTime + 0.002, songT + offset);
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'triangle'; o.frequency.value = accent ? 880 : 620;
      g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(accent ? 0.22 : 0.14, at + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.09);
      o.connect(g); g.connect(epochGain); o.start(at); o.stop(at + 0.11);
    },
    // Silence everything (scheduled voices, live voices, shimmer): pause, restart, leaving a screen.
    flush() {
      if (ctx) {
        hushAll(); haveOffset = false;
        for (const V of [...ai, ...live]) { V.endAt = -1; V.on = false; }
        shimmerGain.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
      }
    },
  };
  return api;
}

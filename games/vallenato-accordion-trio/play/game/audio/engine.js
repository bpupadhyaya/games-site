// Vallenato Accordion Trio: the instrument engine (Web Audio). It lives OUTSIDE web/src because it touches the browser (the game core stays
// pure). The kit's env.audio can only play a tone "now"; a rhythm game needs sounds placed on the audio clock, and an accordion note that
// lasts exactly as long as a finger is down. Everything is synthesised (no recordings):
//   reed    the accordion: three detuned reeds (a musette pair and a low octave) through a nasal filter, with a breath of bellows noise;
//           a push is a little brighter and a pull a little softer, so the direction can be heard
//   tum     the caja's deep stroke: a short pitch-dropping thump with a woody knock
//   tak     the caja's sharp stroke: a finger slap, a burst of band-passed noise over a tight tone
//   scrape  the guacharaca: a fast ratchet of tiny noise ticks, rising for a right scrape and falling for a left one
//   bajo    the accordion's left-hand bass          click  a wood-block count-in          swish  the bellows changing direction
// Scheduled sounds go through an "epoch" gain, so a pause can silence everything not yet heard. Song time -> audio time uses an offset
// smoothed over the last second, so frame jitter never reaches the ear.

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function createTrioEngine() {
  const AC = globalThis.AudioContext ?? globalThis.webkitAudioContext;
  let ctx = null, dry = null, verb = null, noise = null, live = null, epoch = null, epochDry = null, comp = null;
  let muted = false, volume = 1, offset = 0, haveOffset = false, nextId = 1;
  const liveReeds = new Map();

  function ensure() {
    if (!AC) return null;
    if (!ctx) {
      try { ctx = new AC({ latencyHint: 'interactive' }); } catch { ctx = new AC(); }
      comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -18; comp.knee.value = 12; comp.ratio.value = 3; comp.attack.value = 0.004; comp.release.value = 0.2;
      dry = ctx.createGain(); dry.gain.value = 0.9 * volume; dry.connect(comp);
      const lim = ctx.createDynamicsCompressor();                                   // safety limiter: dense passages never clip
      lim.threshold.value = -4; lim.knee.value = 3; lim.ratio.value = 20; lim.attack.value = 0.001; lim.release.value = 0.1;
      comp.connect(lim); lim.connect(ctx.destination);
      // A small patio room: 1.1 s of quickly decaying stereo noise through a low-pass.
      const conv = ctx.createConvolver(), len = Math.floor(ctx.sampleRate * 1.1), buf = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); let lp = 0; for (let i = 0; i < len; i++) { const k = i / len; lp += ((Math.random() * 2 - 1) - lp) * (0.5 + 0.4 * (1 - k)); d[i] = lp * Math.pow(1 - k, 2.8); } }
      conv.buffer = buf;
      const lpf = ctx.createBiquadFilter(); lpf.type = 'lowpass'; lpf.frequency.value = 5200;
      verb = lpf; lpf.connect(conv);
      const wet = ctx.createGain(); wet.gain.value = 0.32; conv.connect(wet); wet.connect(comp);
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
    epochDry = ctx.createGain(); epochDry.gain.value = 1; epochDry.connect(dry);
    for (const o of old) if (o) { const t = ctx.currentTime; o.gain.cancelScheduledValues(t); o.gain.setValueAtTime(o.gain.value, t); o.gain.linearRampToValueAtTime(0, t + 0.015); setTimeout(() => { try { o.disconnect(); } catch {} }, 3000); }
  }

  const env = (g, t, peak, a, d) => { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); };
  function noiseBurst(out, t, freq, q, peak, dur, type = 'bandpass') {
    const s = ctx.createBufferSource(); s.buffer = noise; s.playbackRate.value = 0.85 + Math.random() * 0.3;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); env(g, t, peak, 0.0015, dur);
    s.connect(f); f.connect(g); g.connect(out); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.03);
  }

  // The accordion reed stack. Returns { g, oscs, stopAt(t) } so a live note can be released when the finger lifts.
  function reed(out, t, freq, vel, pull, dur) {
    const c = ctx, g = c.createGain(), lp = c.createBiquadFilter(), pk = c.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = (pull ? 1900 : 2500) + vel * 700; lp.Q.value = 0.7;
    pk.type = 'peaking'; pk.frequency.value = 1350; pk.gain.value = 7; pk.Q.value = 0.9;
    const a = 0.018, peak = 0.12 * (0.5 + vel * 0.6);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a);
    const oscs = [], mk = (type, f, level) => {
      const o = c.createOscillator(), og = c.createGain(); o.type = type; o.frequency.value = f; og.gain.value = level;
      o.connect(og); og.connect(lp); o.start(t); oscs.push(o);
    };
    mk('sawtooth', freq, 1); mk('sawtooth', freq * 1.0042, 0.85); mk('sawtooth', freq * 0.5, 0.32); mk('square', freq * 2.003, 0.1);
    lp.connect(pk); pk.connect(g); g.connect(out);
    const breath = c.createBufferSource(); breath.buffer = noise; breath.loop = true;
    const bf = c.createBiquadFilter(); bf.type = 'bandpass'; bf.frequency.value = 1700; bf.Q.value = 0.6;
    const bg = c.createGain(); bg.gain.value = 0.014 * vel; breath.connect(bf); bf.connect(bg); bg.connect(g); breath.start(t); oscs.push(breath);
    const handle = {
      stopAt(when) {
        const e = Math.max(when, t + 0.05);
        g.gain.cancelScheduledValues(e - 0.001); g.gain.setValueAtTime(Math.max(0.0002, peak), e); g.gain.exponentialRampToValueAtTime(0.0001, e + 0.09);
        for (const o of oscs) { try { o.stop(e + 0.12); } catch {} }
      },
    };
    if (dur) handle.stopAt(t + dur);
    return handle;
  }
  function tum(out, t, vel) {
    const c = ctx, o = c.createOscillator(), g = c.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(190, t); o.frequency.exponentialRampToValueAtTime(64, t + 0.14);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.95 * vel, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.36);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.4);
    noiseBurst(out, t, 520, 1.1, 0.5 * vel, 0.05);
    const h = c.createOscillator(), hg = c.createGain(); h.type = 'triangle'; h.frequency.setValueAtTime(330, t); h.frequency.exponentialRampToValueAtTime(190, t + 0.05);
    env(hg, t, 0.22 * vel, 0.002, 0.07); h.connect(hg); hg.connect(out); h.start(t); h.stop(t + 0.1);
  }
  function tak(out, t, vel) {
    const c = ctx;
    noiseBurst(out, t, 2300, 1.3, 1.6 * vel, 0.09);
    noiseBurst(out, t, 4200, 0.9, 0.7 * vel, 0.04, 'highpass');
    const o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(520, t); o.frequency.exponentialRampToValueAtTime(340, t + 0.05);
    env(g, t, 0.7 * vel, 0.002, 0.11); o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.12);
  }
  function scrape(out, t, vel, dir, accent) {
    const c = ctx, n = accent ? 9 : 7, span = accent ? 0.1 : 0.075, up = dir === 'R';
    const s = c.createBufferSource(); s.buffer = noise; s.playbackRate.value = 1.1;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 3.2;
    f.frequency.setValueAtTime(up ? 4300 : 6600, t); f.frequency.linearRampToValueAtTime(up ? 6600 : 4300, t + span + 0.02);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t);
    for (let k = 0; k < n; k++) {
      const tk = t + (k / n) * span, shape = up ? (0.55 + 0.45 * k / n) : (1 - 0.45 * k / n), a = (accent ? 1.6 : 1.1) * vel * shape;
      g.gain.setValueAtTime(0.0001, tk); g.gain.linearRampToValueAtTime(a, tk + 0.0016); g.gain.exponentialRampToValueAtTime(0.0001, tk + span / n * 0.82);
    }
    s.connect(f); f.connect(g); g.connect(out); s.start(t, Math.random() * 0.4); s.stop(t + span + 0.05);
  }
  function bajo(out, t, freq, vel) {
    const c = ctx, o = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain(), lp = c.createBiquadFilter();
    o.type = 'sawtooth'; o.frequency.value = freq; o2.type = 'sine'; o2.frequency.value = freq * 2;
    lp.type = 'lowpass'; lp.frequency.value = 520;
    env(g, t, 0.5 * vel, 0.012, 0.38); o.connect(lp); o2.connect(lp); lp.connect(g); g.connect(out);
    o.start(t); o2.start(t); o.stop(t + 0.42); o2.stop(t + 0.42);
  }
  function click(out, t, accent) {
    const c = ctx, o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(accent ? 1500 : 1050, t); o.frequency.exponentialRampToValueAtTime(accent ? 1100 : 780, t + 0.03);
    env(g, t, accent ? 0.2 : 0.14, 0.001, 0.05); o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.08);
  }
  function swish(out, t, pull) { noiseBurst(out, t, pull ? 900 : 1500, 0.5, 0.1, 0.16); }

  const api = {
    get available() { return !!AC; },
    get _ctx() { return ctx; },
    haptic(ms) { try { globalThis.navigator?.vibrate?.(ms); } catch {} },
    unlock() { ensure(); },
    get ready() { return !!ctx && ctx.state === 'running'; },
    setMuted(m) { muted = !!m; if (dry) dry.gain.value = muted ? 0 : 0.9 * volume; },
    get muted() { return muted; },
    setVolume(v) { volume = v; if (dry && !muted) dry.gain.value = 0.9 * volume; },
    now() { return ctx ? ctx.currentTime : 0; },
    get outputLatency() { return ctx ? (ctx.outputLatency || ctx.baseLatency || 0) : 0; },
    sync(songT, hard = false) {
      if (!ctx) return;
      const target = ctx.currentTime - songT;
      if (!haveOffset || hard) { offset = target + 0.03; haveOffset = true; } else offset += (target - offset) * 0.02;
    },
    toSong(audioTime) { return haveOffset && ctx ? audioTime - offset : NaN; },
    toAudio(songT) { return songT + offset; },
    // kind: tum | tak | scrape | reed | bajo | click | swish. o: { vel, freq, dur, pull, dir, accent }. songT = null: right now (the player's touch).
    play(kind, o = {}, songT = null) {
      if (muted) return;
      if (!ensure() || ctx.state !== 'running') return;
      const at = songT === null ? ctx.currentTime + 0.002 : Math.max(ctx.currentTime + 0.002, songT + offset);
      const out = songT === null ? live : epoch, vel = clamp(o.vel ?? 0.8, 0.05, 1);
      if (kind === 'tum') tum(out, at, vel);
      else if (kind === 'tak') tak(out, at, vel);
      else if (kind === 'scrape') scrape(out, at, vel, o.dir, o.accent);
      else if (kind === 'reed') reed(out, at, o.freq, vel, !!o.pull, o.dur ?? 0.4);
      else if (kind === 'bajo') bajo(out, at, o.freq, vel);
      else if (kind === 'click') click(epochDry, at, !!o.accent);
      else if (kind === 'swish') swish(out, at, !!o.pull);
    },
    // A live accordion note that lasts as long as the finger: returns a handle id for reedOff.
    reedOn(freq, vel, pull) {
      if (muted || !ensure() || ctx.state !== 'running') return 0;
      const id = nextId++, h = reed(live, ctx.currentTime + 0.002, freq, vel, pull, 0);
      liveReeds.set(id, h);
      return id;
    },
    reedOff(id, minHold = 0.12) {
      const h = liveReeds.get(id); if (!h || !ctx) return;
      liveReeds.delete(id); h.stopAt(ctx.currentTime + minHold * 0.5);
    },
    // Silence everything scheduled but not yet heard (pause, leaving a piece) and forget the clock pairing.
    flush() { if (ctx) { newEpoch(); for (const [id, h] of liveReeds) { h.stopAt(ctx.currentTime); liveReeds.delete(id); } } haveOffset = false; },
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

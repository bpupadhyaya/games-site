// Taiko Drum Circle: the drum engine (Web Audio). It lives OUTSIDE web/src because it touches the browser (the game core stays pure).
// The kit's env.audio can only play a tone "now"; a rhythm game needs sounds scheduled on the audio clock, so this module owns its own
// AudioContext and is handed to the game as env.rhythm. Everything is synthesised (no recordings):
//   don  = a pitch-dropping skin body + a short noise slap        ka = a bright wood-and-skin rim click
// Scheduled sounds (the ensemble, the click) go through an "epoch" gain, so a pause can silence everything not yet heard.
// Song time -> audio time uses an offset that is smoothed over the last second, so frame jitter never reaches the ear.

const PAN = [-0.4, -0.14, 0.14, 0.4, 0.55];
const VOICES = [
  // f: body pitch (Hz) of don, drop: pitch multiplier at the start, dec: body decay (s), rim: ka partial (Hz), slap: noise band (Hz), gain
  { f: 215, drop: 1.9, dec: 0.17, rim: 1650, slap: 3200, gain: 0.9, wet: 0.16 },    // shime
  { f: 138, drop: 1.8, dec: 0.3, rim: 1100, slap: 2100, gain: 1.0, wet: 0.2 },      // chu
  { f: 104, drop: 1.7, dec: 0.42, rim: 820, slap: 1500, gain: 1.05, wet: 0.22 },    // okedo
  { f: 62, drop: 1.6, dec: 0.95, rim: 430, slap: 900, gain: 1.25, wet: 0.3 },       // o-daiko
];

export function createDrumEngine() {
  const AC = globalThis.AudioContext ?? globalThis.webkitAudioContext;
  let ctx = null, comp = null, dry = null, verb = null, noise = null, live = null, epoch = null, epochDry = null;
  let muted = false, volume = 1, offset = 0, haveOffset = false;
  let lastHit = 0;

  function ensure() {
    if (!AC) return null;
    if (!ctx) {
      try { ctx = new AC({ latencyHint: 'interactive' }); } catch { ctx = new AC(); }
      comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.knee.value = 12; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.18;
      dry = ctx.createGain(); dry.gain.value = 0.9 * volume; dry.connect(comp); comp.connect(ctx.destination);
      // A small hall: decaying stereo noise.
      // A hall: 2.4 s of decaying stereo noise (darker as it fades), fed through a small pre-delay and a low-pass.
      const conv = ctx.createConvolver();
      const len = Math.floor(ctx.sampleRate * 2.4), buf = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); let lp = 0; for (let i = 0; i < len; i++) { const k = i / len, a = 0.55 + 0.4 * (1 - k); lp += (((Math.random() * 2 - 1)) - lp) * a; d[i] = lp * Math.pow(1 - k, 2.6) * (i < 400 ? i / 400 : 1); } }
      conv.buffer = buf;
      const pre = ctx.createDelay(0.1); pre.delayTime.value = 0.022;
      const vlp = ctx.createBiquadFilter(); vlp.type = 'lowpass'; vlp.frequency.value = 5200;
      verb = pre; pre.connect(vlp); vlp.connect(conv);
      const wetGain = ctx.createGain(); wetGain.gain.value = 0.5; conv.connect(wetGain); wetGain.connect(comp);
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
    for (const o of old) if (o) { const t = ctx.currentTime; o.gain.cancelScheduledValues(t); o.gain.setValueAtTime(o.gain.value, t); o.gain.linearRampToValueAtTime(0, t + 0.015); setTimeout(() => { try { o.disconnect(); } catch {} }, 1500); }
  }

  // One drum hit into `out` at audio time `at`. vel 0..1.
  function hit(drum, kind, vel, at, out) {
    const c = ctx, V = VOICES[drum] ?? VOICES[1];
    const v = Math.max(0.05, Math.min(1, vel * (0.95 + Math.random() * 0.1))), t = at;
    const g = c.createGain(), pn = c.createStereoPanner ? c.createStereoPanner() : null;
    if (pn) { pn.pan.value = PAN[drum] ?? 0; g.connect(pn); pn.connect(out); } else g.connect(out);
    if (kind === 'D') {
      const o = c.createOscillator(), og = c.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(V.f * V.drop, t); o.frequency.exponentialRampToValueAtTime(V.f, t + 0.045); o.frequency.exponentialRampToValueAtTime(V.f * 0.82, t + V.dec);
      og.gain.setValueAtTime(0.0001, t); og.gain.exponentialRampToValueAtTime(0.9 * v * V.gain, t + 0.004); og.gain.exponentialRampToValueAtTime(0.0001, t + V.dec * (0.8 + 0.5 * v));
      o.connect(og); og.connect(g); o.start(t); o.stop(t + V.dec * 1.5 + 0.05);
      // a second, slightly detuned body for width, a shell ring, and a deep sub for the big drum
      const ob = c.createOscillator(), obg = c.createGain();
      ob.type = 'sine'; ob.detune.value = 9; ob.frequency.setValueAtTime(V.f * V.drop, t); ob.frequency.exponentialRampToValueAtTime(V.f, t + 0.05); ob.frequency.exponentialRampToValueAtTime(V.f * 0.8, t + V.dec * 1.1);
      obg.gain.setValueAtTime(0.0001, t); obg.gain.exponentialRampToValueAtTime(0.4 * v * V.gain, t + 0.006); obg.gain.exponentialRampToValueAtTime(0.0001, t + V.dec * 1.2);
      ob.connect(obg); obg.connect(g); ob.start(t); ob.stop(t + V.dec * 1.5 + 0.05);
      ring(c, g, t, V.f * 2.6, 0.2 * v, V.dec * 0.7);
      if (drum === 3) { const su = c.createOscillator(), sg = c.createGain(); su.type = 'sine'; su.frequency.setValueAtTime(75, t); su.frequency.exponentialRampToValueAtTime(40, t + 0.5); sg.gain.setValueAtTime(0.0001, t); sg.gain.exponentialRampToValueAtTime(0.55 * v, t + 0.01); sg.gain.exponentialRampToValueAtTime(0.0001, t + 1.2); su.connect(sg); sg.connect(g); su.start(t); su.stop(t + 1.3); }
      const o2 = c.createOscillator(), o2g = c.createGain();            // an upper partial for body
      o2.type = 'triangle'; o2.frequency.setValueAtTime(V.f * 2.1, t); o2.frequency.exponentialRampToValueAtTime(V.f * 1.6, t + 0.1);
      o2g.gain.setValueAtTime(0.0001, t); o2g.gain.exponentialRampToValueAtTime(0.3 * v, t + 0.003); o2g.gain.exponentialRampToValueAtTime(0.0001, t + V.dec * 0.45);
      o2.connect(o2g); o2g.connect(g); o2.start(t); o2.stop(t + V.dec);
      slap(c, g, t, V.slap, 0.45 * v, 0.045);
    } else {
      const o = c.createOscillator(), og = c.createGain();
      o.type = 'triangle'; o.frequency.setValueAtTime(V.rim * 1.25, t); o.frequency.exponentialRampToValueAtTime(V.rim, t + 0.02);
      og.gain.setValueAtTime(0.0001, t); og.gain.exponentialRampToValueAtTime(0.55 * v, t + 0.002); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.09 + V.dec * 0.12);
      o.connect(og); og.connect(g); o.start(t); o.stop(t + 0.3);
      const o2 = c.createOscillator(), o2g = c.createGain();
      o2.type = 'sine'; o2.frequency.setValueAtTime(V.rim * 2.76, t);
      o2g.gain.setValueAtTime(0.0001, t); o2g.gain.exponentialRampToValueAtTime(0.22 * v, t + 0.002); o2g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
      o2.connect(o2g); o2g.connect(g); o2.start(t); o2.stop(t + 0.1);
      slap(c, g, t, V.slap * 2.2, 0.7 * v, 0.03);
      ring(c, g, t, V.rim * 1.6, 0.22 * v, 0.07);
      // a little body so the rim is not thin
      const b = c.createOscillator(), bg = c.createGain();
      b.type = 'sine'; b.frequency.setValueAtTime(V.f * 1.1, t); bg.gain.setValueAtTime(0.0001, t); bg.gain.exponentialRampToValueAtTime(0.18 * v * V.gain, t + 0.004); bg.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
      b.connect(bg); bg.connect(g); b.start(t); b.stop(t + 0.15);
    }
    g.gain.value = 0.9;
  }
  function ring(c, out, t, freq, amp, dur) {
    const s = c.createBufferSource(); s.buffer = noise; const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 9;
    const sg = c.createGain(); sg.gain.setValueAtTime(0.0001, t); sg.gain.exponentialRampToValueAtTime(amp, t + 0.003); sg.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(sg); sg.connect(out); s.start(t, Math.random() * 0.4); s.stop(t + dur + 0.02);
  }
  function slap(c, out, t, freq, amp, dur) {
    const s = c.createBufferSource(); s.buffer = noise; s.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 0.9;
    const sg = c.createGain(); sg.gain.setValueAtTime(0.0001, t); sg.gain.exponentialRampToValueAtTime(amp, t + 0.002); sg.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(sg); sg.connect(out); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
  }
  // The small hand gong (atarigane): a bright, inharmonic ring.
  function gong(kind, vel, at, out) {
    const c = ctx, t = at, v = Math.max(0.05, Math.min(1, vel)), g = c.createGain(); g.connect(out); g.gain.value = 0.55;
    const base = kind === 'D' ? 1250 : 1580;
    [1, 1.48, 2.26, 3.1].forEach((m, i) => {
      const o = c.createOscillator(), og = c.createGain();
      o.type = 'sine'; o.frequency.value = base * m;
      og.gain.setValueAtTime(0.0001, t); og.gain.exponentialRampToValueAtTime((0.4 / (i + 1)) * v, t + 0.002); og.gain.exponentialRampToValueAtTime(0.0001, t + (kind === 'D' ? 0.55 : 0.32) / (1 + i * 0.5));
      o.connect(og); og.connect(g); o.start(t); o.stop(t + 0.7);
    });
    slap(c, g, t, 6000, 0.25 * v, 0.02);
  }
  function click(accent, at, out) {
    const c = ctx, o = c.createOscillator(), og = c.createGain();
    o.type = 'square'; o.frequency.value = accent ? 1900 : 1250;
    og.gain.setValueAtTime(0.0001, at); og.gain.exponentialRampToValueAtTime(accent ? 0.16 : 0.1, at + 0.001); og.gain.exponentialRampToValueAtTime(0.0001, at + 0.035);
    o.connect(og); og.connect(out); o.start(at); o.stop(at + 0.05);
  }

  const api = {
    get available() { return !!AC; },
    haptic(ms) { try { globalThis.navigator?.vibrate?.(ms); } catch {} },
    unlock() { ensure(); },
    get ready() { return !!ctx && ctx.state === 'running'; },
    setMuted(m) { muted = !!m; if (dry) dry.gain.value = muted ? 0 : 0.9 * volume; },
    get muted() { return muted; },
    setVolume(v) { volume = v; if (dry && !muted) dry.gain.value = 0.9 * volume; },
    // The audio clock, in seconds (0 before the context exists).
    now() { return ctx ? ctx.currentTime : 0; },
    // Output delay the device reports (seconds); a hint only, the calibrated offset is what the game really uses.
    get outputLatency() { return ctx ? (ctx.outputLatency || ctx.baseLatency || 0) : 0; },
    // Pair the song clock with the audio clock. Called every update with the current song time.
    sync(songT, hard = false) {
      if (!ctx) return;
      const target = ctx.currentTime - songT;
      if (!haveOffset || hard) { offset = target + 0.03; haveOffset = true; }
      else offset += (target - offset) * 0.02;
    },
    toSong(audioTime) { return haveOffset && ctx ? audioTime - offset : NaN; },
    toAudio(songT) { return songT + offset; },
    // Play a drum voice. songT = null: right now (the player's own touch). Otherwise at that song time.
    // drum 0-3 drums, 4 bell, -1 metronome; kind 'D' | 'K' (or 'accent' | 'beat' for the click).
    play(drum, kind, vel = 0.8, songT = null) {
      if (muted) return;
      if (!ensure() || ctx.state !== 'running') return;
      let at;
      if (songT === null) { at = ctx.currentTime + 0.002; lastHit = at; }
      else at = Math.max(ctx.currentTime + 0.002, songT + offset);
      const out = songT === null ? live : epoch;
      if (drum === -1) click(kind === 'accent', at, epochDry);
      else if (drum === 4) gong(kind, vel, at, out);
      else hit(drum, kind, vel, at, out);
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

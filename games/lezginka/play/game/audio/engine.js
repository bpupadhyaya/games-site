// Lezginka: the sound engine (Web Audio). It lives OUTSIDE web/src because it touches the browser (the game core stays pure).
// The kit's env.audio can only play a tone "now"; a rhythm game needs sounds scheduled on the audio clock, so this module owns its own
// AudioContext and is handed to the game as env.rhythm. Everything is synthesised (no recordings, no licensed music):
//   boots on a wooden floor, hand claps, a low hand drum with a bright rim, and a reed instrument (a small accordion) for the tune.
// Scheduled sounds (the band) go through an "epoch" gain, so a pause can silence everything not yet heard.
// Song time -> audio time uses an offset that is smoothed over the last second, so frame jitter never reaches the ear.

const SCALE = [0, 1, 4, 5, 7, 8, 10, 12, 13];
const TONIC = 146.83;

export function createDanceEngine() {
  const AC = globalThis.AudioContext ?? globalThis.webkitAudioContext;
  let ctx = null, comp = null, dry = null, verb = null, noise = null, live = null, epoch = null, epochDry = null;
  let muted = false, offset = 0, haveOffset = false;

  function ensure() {
    if (!AC) return null;
    if (!ctx) {
      try { ctx = new AC({ latencyHint: 'interactive' }); } catch { ctx = new AC(); }
      comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.knee.value = 12; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.18;
      dry = ctx.createGain(); dry.gain.value = 0.9; dry.connect(comp); const master = ctx.createGain(); master.gain.value = 0.8; comp.connect(master); master.connect(ctx.destination);   // headroom: full band + every step stays under 0 dBFS
      // A courtyard: 1.6 s of decaying stereo noise, darker as it fades.
      const conv = ctx.createConvolver();
      const len = Math.floor(ctx.sampleRate * 1.6), buf = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); let lp = 0; for (let i = 0; i < len; i++) { const k = i / len, a = 0.5 + 0.4 * (1 - k); lp += (((Math.random() * 2 - 1)) - lp) * a; d[i] = lp * Math.pow(1 - k, 2.4) * (i < 300 ? i / 300 : 1); } }
      conv.buffer = buf;
      const pre = ctx.createDelay(0.1); pre.delayTime.value = 0.018;
      const vlp = ctx.createBiquadFilter(); vlp.type = 'lowpass'; vlp.frequency.value = 4800;
      verb = pre; pre.connect(vlp); vlp.connect(conv);
      const wetGain = ctx.createGain(); wetGain.gain.value = 0.4; conv.connect(wetGain); wetGain.connect(comp);
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
    for (const o of old) if (o) { const t = ctx.currentTime; o.gain.cancelScheduledValues(t); o.gain.setValueAtTime(o.gain.value, t); o.gain.linearRampToValueAtTime(0, t + 0.015); setTimeout(() => { try { o.disconnect(); } catch {} }, 1500); }
  }

  const env = (g, t, peak, a, dec) => { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec); };
  function tone(out, type, f0, f1, t, peak, a, dec, detune = 0) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.detune.value = detune; o.frequency.setValueAtTime(f0, t); if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + a + dec * 0.8);
    env(g, t, peak, a, dec); o.connect(g); g.connect(out); o.start(t); o.stop(t + a + dec + 0.05);
  }
  function burst(out, t, freq, q, peak, dec, rate = 1, sweepTo = 0, type = 'bandpass') {
    const s = ctx.createBufferSource(); s.buffer = noise; s.playbackRate.value = rate * (0.9 + Math.random() * 0.2);
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dec); f.Q.value = q;
    const g = ctx.createGain(); env(g, t, peak, 0.002, dec);
    s.connect(f); f.connect(g); g.connect(out); s.start(t, Math.random() * 0.5); s.stop(t + dec + 0.05);
  }

  // One voice into `out` at audio time `t`. v = velocity 0..1.
  function voice(name, x, v, t, out) {
    const g = ctx.createGain(), pn = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    let pan = 0;
    if (name === 'L') pan = -0.35; else if (name === 'R') pan = 0.35; else if (name === 'C') pan = 0.15; else if (name === 'N') pan = -0.1;
    if (pn) { pn.pan.value = pan; g.connect(pn); pn.connect(out); } else g.connect(out);
    g.gain.value = 0.9;
    if (name === 'L' || name === 'R') {                              // a boot stamped on a wooden floor
      const base = name === 'L' ? 118 : 138;
      tone(g, 'sine', base * 1.7, base * 0.6, t, 0.95 * v, 0.003, 0.16);
      tone(g, 'triangle', base * 3.1, base * 1.4, t, 0.35 * v, 0.002, 0.07);
      burst(g, t, 1100, 1.2, 0.65 * v, 0.05, 1);                    // the heel on the boards
      burst(g, t, 3600, 0.9, 0.3 * v, 0.018, 1.3);
    } else if (name === 'A') {                                       // a sweep of sleeves and a hand clap
      burst(g, t - 0.08 > ctx.currentTime ? t - 0.08 : t, 500, 1.4, 0.35 * v, 0.2, 1, 3000);
      burst(g, t, 1900, 0.8, 0.8 * v, 0.045, 1);
      burst(g, t + 0.012, 2300, 0.8, 0.55 * v, 0.06, 1.1);
      tone(g, 'sine', 3200, 3200, t, 0.12 * v, 0.002, 0.25);
    } else if (name === 'S') {                                       // a whirl: rising whoosh and a bright chime
      burst(g, t, 400, 2.2, 0.55 * v, 0.34, 1, 2600);
      tone(g, 'sine', 880 * 1.5, 880 * 1.5, t, 0.22 * v, 0.004, 0.5);
      tone(g, 'sine', 880 * 2.4, 880 * 2.4, t, 0.1 * v, 0.004, 0.35);
      tone(g, 'triangle', 300, 90, t, 0.4 * v, 0.004, 0.18);
    } else if (name === 'D') {                                       // low hand drum
      tone(g, 'sine', 150, 78, t, 0.95 * v, 0.004, 0.24);
      tone(g, 'sine', 300, 150, t, 0.25 * v, 0.003, 0.09);
      burst(g, t, 900, 0.9, 0.35 * v, 0.04, 1);
    } else if (name === 'T' || name === 't') {                       // the rim of the drum
      const k = name === 't' ? 0.5 : 1;
      tone(g, 'triangle', 1550, 1250, t, 0.5 * v * k, 0.002, 0.08);
      burst(g, t, 3400, 1.1, 0.7 * v * k, 0.04, 1.2);
      tone(g, 'sine', 410, 380, t, 0.3 * v * k, 0.002, 0.07);
    } else if (name === 'C') {                                       // hand clap
      burst(g, t, 1500, 0.9, 0.7 * v, 0.05, 1);
      burst(g, t + 0.017, 1800, 0.9, 0.5 * v, 0.06, 1.1);
    } else if (name === 'B' || name === 'b') {                       // the left-hand bass of the accordion
      const f = TONIC / 2 * (name === 'B' ? 1 : 0.75), d = Math.min(0.5, x.dur ?? 0.3);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520; lp.Q.value = 0.8; lp.connect(g);
      tone(lp, 'sawtooth', f, f, t, 0.55 * v, 0.01, d);
      tone(lp, 'square', f * 2.003, f * 2.003, t, 0.18 * v, 0.01, d * 0.8);
    } else if (name === 'N') {                                       // accordion reeds: two saws, a square an octave up, formant filters
      const deg = Math.max(1, Math.min(9, x.deg | 0)), f = TONIC * 2 * Math.pow(2, SCALE[deg - 1] / 12), d = Math.max(0.12, Math.min(0.7, (x.dur ?? 0.25) * 1.15));
      const bp1 = ctx.createBiquadFilter(), bp2 = ctx.createBiquadFilter(), mix = ctx.createGain();
      bp1.type = 'peaking'; bp1.frequency.value = 900; bp1.gain.value = 9; bp1.Q.value = 1.2;
      bp2.type = 'peaking'; bp2.frequency.value = 2200; bp2.gain.value = 6; bp2.Q.value = 1;
      mix.connect(bp1); bp1.connect(bp2); bp2.connect(g); g.gain.value = 0.55;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 4200; lp.connect(mix);
      tone(lp, 'sawtooth', f, f, t, 0.5 * v, 0.02, d, -7);
      tone(lp, 'sawtooth', f, f, t, 0.5 * v, 0.02, d, 7);
      tone(lp, 'square', f * 2, f * 2, t, 0.14 * v, 0.02, d * 0.9, 3);
    }
  }
  function click(accent, at, out) {
    const o = ctx.createOscillator(), og = ctx.createGain();
    o.type = 'square'; o.frequency.value = accent ? 1900 : 1250;
    og.gain.setValueAtTime(0.0001, at); og.gain.exponentialRampToValueAtTime(accent ? 0.16 : 0.1, at + 0.001); og.gain.exponentialRampToValueAtTime(0.0001, at + 0.035);
    o.connect(og); og.connect(out); o.start(at); o.stop(at + 0.05);
  }

  const api = {
    get available() { return !!AC; },
    haptic(ms) { try { const n = globalThis.navigator; if (n && (!n.userActivation || n.userActivation.hasBeenActive)) n.vibrate?.(ms); } catch {} },
    unlock() { ensure(); },
    get ready() { return !!ctx && ctx.state === 'running'; },
    setMuted(m) { muted = !!m; if (dry) dry.gain.value = muted ? 0 : 0.9; },
    get muted() { return muted; },
    now() { return ctx ? ctx.currentTime : 0; },
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
    // Play a voice. songT = null: right now (the player's own touch). Otherwise at that song time.
    // voice: 'L' 'R' 'A' 'S' (the steps), 'D' 'T' 't' 'C' (drum and claps), 'B' 'b' (bass), 'N' (tune; x = { deg, dur }), 'click' (x = 'accent' | 'beat').
    play(name, x = {}, vel = 0.8, songT = null) {
      if (muted) return;
      if (!ensure() || ctx.state !== 'running') return;
      let at;
      if (songT === null) at = ctx.currentTime + 0.002;
      else at = Math.max(ctx.currentTime + 0.002, songT + offset);
      if (name === 'click') { click(x === 'accent', at, epochDry); return; }
      voice(name, x, Math.max(0.05, Math.min(1, vel)), at, songT === null ? live : epoch);
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

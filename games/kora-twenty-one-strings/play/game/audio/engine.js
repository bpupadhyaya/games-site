// Kora: the string engine (Web Audio). It lives OUTSIDE web/src because it touches the browser (the game core stays pure).
// The kit's env.audio can only play a tone "now"; a rhythm game needs sounds scheduled on the audio clock, so this module owns its own
// AudioContext and is handed to the game as env.rhythm. Everything is synthesised (no recordings):
//   each of the 21 strings is rendered ONCE into a buffer: a plucked string = a stack of partials that die away faster the higher they are,
//   a slightly detuned twin for the shimmer of a real string, a short thumb-on-string transient, and a soft calabash thump. The buffers are
//   played through a "calabash body" (two broad resonances) and a small courtyard room.
// Scheduled sounds (the accompaniment, the click) go through an "epoch" gain, so a pause can silence everything not yet heard.
// Song time -> audio time uses an offset that is smoothed over the last second, so frame jitter never reaches the ear.
import { stringFreq, STRING_COUNT } from '../src/music.js';

let seed = 1234567;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

// Render string `i` as mono samples. Pure maths, no audio nodes (so it can be inspected offline).
export function renderString(i, sr) {
  const f = stringFreq(i), low = i / (STRING_COUNT - 1);                         // 0 for the lowest string, 1 for the highest
  const dur = 2.3 - 1.0 * low, n = Math.floor(sr * dur), out = new Float32Array(n);
  const tau1 = 0.9 - 0.48 * low;                                                // decay time of the first partial (s)
  const pluck = 0.17 + 0.05 * low;                                               // where along the string the thumb plucks (fraction): shapes the harmonic mix
  const partials = Math.max(5, Math.min(22, Math.floor(7600 / f)));
  for (let k = 1; k <= partials; k++) {
    const fk = f * k * Math.sqrt(1 + 0.00012 * k * k);                           // a touch of stiffness: higher partials sit slightly sharp
    if (fk > sr * 0.45) break;
    const amp = Math.abs(Math.sin(Math.PI * k * pluck)) / Math.pow(k, 1.15);
    const tau = tau1 / (1 + 0.62 * (k - 1) * (0.7 + 0.5 * low));
    const ph = rnd() * 6.2832, w = 6.2832 * fk / sr, wb = 6.2832 * (fk * 1.0011) / sr;   // twin: a second, 0.11% sharp, slowly beating
    const lim = Math.min(n, Math.floor(sr * tau * 7));
    const dec = Math.exp(-1 / (sr * tau));
    let env = amp * 0.5;
    for (let s = 0; s < lim; s++) { out[s] += env * (Math.sin(ph + w * s) + 0.6 * Math.sin(ph * 1.7 + wb * s)); env *= dec; }
  }
  // thumb-on-string transient: a few ms of band-passed noise
  const nl = Math.floor(sr * 0.012);
  let lp = 0;
  for (let s = 0; s < nl; s++) { const x = rnd() * 2 - 1; lp += (x - lp) * (0.35 + 0.4 * low); out[s] += (x - lp) * 0.22 * (1 - s / nl); }
  // calabash thump: a short soft low pulse for the body under the string
  const tf = 105 + 40 * low, tl = Math.floor(sr * 0.11);
  for (let s = 0; s < tl; s++) out[s] += 0.16 * Math.sin(6.2832 * tf * s / sr) * Math.exp(-s / (sr * 0.028)) * (s < 40 ? s / 40 : 1);
  // normalise to a fixed peak, add a 1 ms fade-in and a 30 ms fade-out
  let pk = 0; for (let s = 0; s < n; s++) pk = Math.max(pk, Math.abs(out[s]));
  let sq = 0; const rn = Math.min(n, Math.floor(sr * 0.5)); for (let s = 0; s < rn; s++) sq += out[s] * out[s];
  const rmsNow = Math.sqrt(sq / rn);                                             // balance the strings by loudness (first half second), never past the peak limit
  const g = pk > 0 ? Math.min(0.95 / pk, 0.16 / Math.max(1e-6, rmsNow)) : 1;
  const fo = Math.floor(sr * 0.03);
  for (let s = 0; s < n; s++) { let v = out[s] * g; if (s < 48) v *= s / 48; if (n - s < fo) v *= (n - s) / fo; out[s] = v; }
  return out;
}

export function createStringEngine() {
  const AC = globalThis.AudioContext ?? globalThis.webkitAudioContext;
  let ctx = null, comp = null, dry = null, verb = null, noise = null, live = null, epoch = null, epochDry = null, bodyIn = null;
  let muted = false, volume = 1, offset = 0, haveOffset = false;
  const buffers = new Array(STRING_COUNT).fill(null);
  let warmIdx = 0;

  function ensure() {
    if (!AC) return null;
    if (!ctx) {
      try { ctx = new AC({ latencyHint: 'interactive' }); } catch { ctx = new AC(); }
      comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -12; comp.knee.value = 14; comp.ratio.value = 3.5; comp.attack.value = 0.004; comp.release.value = 0.2;
      const master = ctx.createGain(); master.gain.value = 0.8;                  // headroom after the compressor so a 4-string chord plus accompaniment never clips
      comp.connect(master); master.connect(ctx.destination);
      // the calabash: a broad low resonance and a gentle presence bump
      bodyIn = ctx.createGain();
      const b1 = ctx.createBiquadFilter(); b1.type = 'peaking'; b1.frequency.value = 190; b1.Q.value = 0.9; b1.gain.value = 4.5;
      const b2 = ctx.createBiquadFilter(); b2.type = 'peaking'; b2.frequency.value = 520; b2.Q.value = 0.8; b2.gain.value = 2.2;
      const hs = ctx.createBiquadFilter(); hs.type = 'highshelf'; hs.frequency.value = 5200; hs.gain.value = -3;
      bodyIn.connect(b1); b1.connect(b2); b2.connect(hs);
      dry = ctx.createGain(); dry.gain.value = 0.7 * volume; hs.connect(dry); dry.connect(comp);
      // a small courtyard room: 1.7 s of decaying stereo noise, dark, with a short pre-delay
      const conv = ctx.createConvolver();
      const len = Math.floor(ctx.sampleRate * 1.7), buf = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); let l = 0; for (let i = 0; i < len; i++) { const k = i / len, a = 0.4 + 0.45 * (1 - k); l += ((rnd() * 2 - 1) - l) * a; d[i] = l * Math.pow(1 - k, 2.4) * (i < 300 ? i / 300 : 1); } }
      conv.buffer = buf;
      const pre = ctx.createDelay(0.1); pre.delayTime.value = 0.018;
      const vlp = ctx.createBiquadFilter(); vlp.type = 'lowpass'; vlp.frequency.value = 4200;
      verb = pre; pre.connect(vlp); vlp.connect(conv);
      const wetGain = ctx.createGain(); wetGain.gain.value = 0.42; conv.connect(wetGain); wetGain.connect(comp);
      noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const nd = noise.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = rnd() * 2 - 1;
      live = ctx.createGain(); live.connect(bodyIn); live.connect(verb); newEpoch();
      warmUp();
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }
  function bufferFor(i) {
    let b = buffers[i];
    if (!b) {
      const d = renderString(i, ctx.sampleRate);
      b = ctx.createBuffer(1, d.length, ctx.sampleRate); b.getChannelData(0).set(d); buffers[i] = b;
    }
    return b;
  }
  // Render the strings in the background, one per timer tick, so the first notes of a piece never have to wait.
  function warmUp() {
    if (!ctx || warmIdx >= STRING_COUNT) return;
    bufferFor(warmIdx++);
    setTimeout(warmUp, 6);
  }
  function newEpoch() {
    const old = [epoch, epochDry];
    epoch = ctx.createGain(); epoch.gain.value = 1; epoch.connect(bodyIn); epoch.connect(verb);
    epochDry = ctx.createGain(); epochDry.gain.value = 1; epochDry.connect(dry);    // the metronome stays out of the body and the room
    for (const o of old) if (o) { const t = ctx.currentTime; o.gain.cancelScheduledValues(t); o.gain.setValueAtTime(o.gain.value, t); o.gain.linearRampToValueAtTime(0, t + 0.02); setTimeout(() => { try { o.disconnect(); } catch {} }, 4000); }
  }

  // One pluck of string `i` into `out` at audio time `at`. vel 0..1.
  function pluck(i, vel, at, out) {
    const c = ctx, v = Math.max(0.05, Math.min(1, vel));
    const src = c.createBufferSource(); src.buffer = bufferFor(i);
    src.playbackRate.value = 1 + (rnd() - 0.5) * 0.0012;                          // no two plucks are identical
    const lpf = c.createBiquadFilter(); lpf.type = 'lowpass'; lpf.frequency.value = 1500 + 7500 * v * v; lpf.Q.value = 0.4;   // softer plucks are darker
    const g = c.createGain(); g.gain.value = 0.28 + 0.72 * v;
    const pn = c.createStereoPanner ? c.createStereoPanner() : null;
    src.connect(lpf); lpf.connect(g);
    if (pn) { pn.pan.value = ((i / (STRING_COUNT - 1)) - 0.5) * 0.5; g.connect(pn); pn.connect(out); } else g.connect(out);
    src.start(at); src.stop(at + src.buffer.duration + 0.05);
  }
  function click(accent, at, out) {
    const c = ctx, o = c.createOscillator(), og = c.createGain();
    o.type = 'triangle'; o.frequency.value = accent ? 1500 : 1000;
    og.gain.setValueAtTime(0.0001, at); og.gain.exponentialRampToValueAtTime(accent ? 0.2 : 0.12, at + 0.001); og.gain.exponentialRampToValueAtTime(0.0001, at + 0.04);
    o.connect(og); og.connect(out); o.start(at); o.stop(at + 0.06);
  }

  const api = {
    get available() { return !!AC; },
    haptic(ms) { try { globalThis.navigator?.vibrate?.(ms); } catch {} },
    unlock() { ensure(); },
    get ready() { return !!ctx && ctx.state === 'running'; },
    setMuted(m) { muted = !!m; if (dry) dry.gain.value = muted ? 0 : 0.7 * volume; },
    get muted() { return muted; },
    setVolume(v) { volume = v; if (dry && !muted) dry.gain.value = 0.7 * volume; },
    // The audio clock, in seconds (0 before the context exists).
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
    // Pluck string 0-20, or play the metronome click with string = -1 (kind 'accent' | 'beat').
    // songT = null: right now (the player's own touch). Otherwise at that song time.
    play(str, kind, vel = 0.8, songT = null) {
      if (muted) return;
      if (!ensure() || ctx.state !== 'running') return;
      let at;
      if (songT === null) at = ctx.currentTime + 0.002;
      else at = Math.max(ctx.currentTime + 0.002, songT + offset);
      const out = songT === null ? live : epoch;
      if (str === -1) click(kind === 'accent', at, epochDry);
      else if (str >= 0 && str < STRING_COUNT) pluck(str, vel, at, out);
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

// Krar Lyre: the sound engine (Web Audio). It lives OUTSIDE web/src because it touches the browser (the game core stays pure).
// The kit's env.audio can only play a tone "now"; a rhythm game needs sounds scheduled on the audio clock, so this module owns its own
// AudioContext and is handed to the game as env.rhythm. Everything is synthesised (no recordings):
//   each string is rendered ONCE per mode into a buffer: a plucked gut string = a stack of partials that die away quickly (a krar rings
//   for under a second), soft saturation for the nasal buzz of strings over a hide-covered bowl, a short finger transient and a "tok" of
//   the hide. Buffers play through a small "bowl" (two broad resonances) and a light room. Two hand-drum sounds are rendered too.
// Scheduled sounds go through an "epoch" gain, so a pause can silence everything not yet heard. A damp (palm on the bowl) fades every
// string that has started. Song time -> audio time uses an offset smoothed over the last second, so frame jitter never reaches the ear.
import { soundFreq, SOUND_COUNT } from '../src/music.js';

let seed = 90210;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

// Render sound k (a string 0..9, or 10 = tok, 11 = thump) of mode qi as mono samples. Pure maths, no audio nodes.
export function renderSound(k, qi, sr) {
  if (k === 10) return renderTok(sr);
  if (k === 11) return renderThump(sr);
  const f = soundFreq(k, qi), low = Math.min(1, Math.max(0, (k - 0) / 9));
  const dur = 1.7 - 0.7 * low, n = Math.floor(sr * dur), out = new Float32Array(n);
  const tau1 = 0.62 - 0.3 * low;                                                    // decay time of the first partial (s)
  const pluck = 0.2 + 0.06 * low;                                                   // where along the string the finger lands: shapes the harmonic mix
  const partials = Math.max(5, Math.min(18, Math.floor(6400 / f)));
  for (let p = 1; p <= partials; p++) {
    const fk = f * p * Math.sqrt(1 + 0.00018 * p * p);
    if (fk > sr * 0.45) break;
    const amp = Math.abs(Math.sin(Math.PI * p * pluck)) / Math.pow(p, 0.95);
    const tau = tau1 / (1 + 0.55 * (p - 1) * (0.7 + 0.5 * low));
    const ph = rnd() * 6.2832, w = 6.2832 * fk / sr, wb = 6.2832 * (fk * 1.0016) / sr;
    const lim = Math.min(n, Math.floor(sr * tau * 6)), dec = Math.exp(-1 / (sr * tau));
    let env = amp * 0.5;
    for (let s = 0; s < lim; s++) { out[s] += env * (Math.sin(ph + w * s) + 0.5 * Math.sin(ph * 1.3 + wb * s)); env *= dec; }
  }
  // nasal buzz: soft saturation adds odd harmonics, strongest while the string is loud
  let pk0 = 0; for (let s = 0; s < n; s++) pk0 = Math.max(pk0, Math.abs(out[s]));
  const drive = 2.4 / Math.max(1e-6, pk0);
  for (let s = 0; s < n; s++) { const x = out[s] * drive; out[s] = Math.tanh(x) * (pk0 / 1.2); }
  // finger-on-gut transient and the hide's "tok"
  const nl = Math.floor(sr * 0.008); let lp = 0;
  for (let s = 0; s < nl; s++) { const x = rnd() * 2 - 1; lp += (x - lp) * 0.5; out[s] += (x - lp) * 0.25 * (1 - s / nl); }
  const tf = 150 + 30 * low, tl = Math.floor(sr * 0.09);
  for (let s = 0; s < tl; s++) out[s] += 0.14 * Math.sin(6.2832 * tf * s / sr) * Math.exp(-s / (sr * 0.02)) * (s < 30 ? s / 30 : 1);
  return normalise(out, sr, 0.16);
}
function normalise(out, sr, rmsTarget) {
  const n = out.length; let pk = 0, sq = 0;
  for (let s = 0; s < n; s++) pk = Math.max(pk, Math.abs(out[s]));
  const rn = Math.min(n, Math.floor(sr * 0.4)); for (let s = 0; s < rn; s++) sq += out[s] * out[s];
  const rms = Math.sqrt(sq / rn), g = pk > 0 ? Math.min(0.95 / pk, rmsTarget / Math.max(1e-6, rms)) : 1, fo = Math.floor(sr * 0.03);
  for (let s = 0; s < n; s++) { let v = out[s] * g; if (s < 40) v *= s / 40; if (n - s < fo) v *= (n - s) / fo; out[s] = v; }
  return out;
}
function renderTok(sr) {
  const n = Math.floor(sr * 0.16), out = new Float32Array(n); let lp = 0, lp2 = 0;
  for (let s = 0; s < n; s++) {
    const x = rnd() * 2 - 1; lp += (x - lp) * 0.28; lp2 += (lp - lp2) * 0.6;
    const e = Math.exp(-s / (sr * 0.022));
    out[s] = (lp - lp2) * 2.2 * e + 0.5 * Math.sin(6.2832 * (360 - 90 * Math.min(1, s / (sr * 0.05))) * s / sr) * e;
  }
  return normalise(out, sr, 0.1);
}
function renderThump(sr) {
  const n = Math.floor(sr * 0.34), out = new Float32Array(n); let ph = 0;
  for (let s = 0; s < n; s++) {
    const fr = 66 + 70 * Math.exp(-s / (sr * 0.03));
    ph += 6.2832 * fr / sr;
    out[s] = Math.sin(ph) * Math.exp(-s / (sr * 0.1)) * 0.9 + (s < 80 ? (rnd() - 0.5) * 0.25 * (1 - s / 80) : 0);
  }
  return normalise(out, sr, 0.17);
}

export function createKrarEngine() {
  const AC = globalThis.AudioContext ?? globalThis.webkitAudioContext;
  let ctx = null, comp = null, dry = null, verb = null, live = null, epoch = null, epochDry = null, bodyIn = null, noise = null;
  let muted = false, volume = 1, offset = 0, haveOffset = false, mode = 0;
  const buffers = new Map();
  const voices = [];
  let warmQ = [];

  function ensure() {
    if (!AC) return null;
    if (!ctx) {
      try { ctx = new AC({ latencyHint: 'interactive' }); } catch { ctx = new AC(); }
      comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -12; comp.knee.value = 14; comp.ratio.value = 3.5; comp.attack.value = 0.004; comp.release.value = 0.2;
      const master = ctx.createGain(); master.gain.value = 0.8;
      // a last-resort soft ceiling: linear to 0.8, then a smooth knee towards 1, so a dense chord can never clip the output
      const ceil = ctx.createWaveShaper(), cv = new Float32Array(2049);
      for (let i = 0; i < cv.length; i++) { const x = (i / 1024) - 1, a = Math.abs(x); cv[i] = Math.sign(x) * (a <= 0.8 ? a : 0.8 + 0.2 * Math.tanh((a - 0.8) / 0.2)); }
      ceil.curve = cv; ceil.oversample = 'none';
      comp.connect(master); master.connect(ceil); ceil.connect(ctx.destination);
      // the bowl: a broad low resonance, a nasal midrange bump and a soft top
      bodyIn = ctx.createGain();
      const b1 = ctx.createBiquadFilter(); b1.type = 'peaking'; b1.frequency.value = 240; b1.Q.value = 1.0; b1.gain.value = 4;
      const b2 = ctx.createBiquadFilter(); b2.type = 'peaking'; b2.frequency.value = 1500; b2.Q.value = 0.9; b2.gain.value = 2.5;
      const hs = ctx.createBiquadFilter(); hs.type = 'highshelf'; hs.frequency.value = 5600; hs.gain.value = -4;
      bodyIn.connect(b1); b1.connect(b2); b2.connect(hs);
      dry = ctx.createGain(); dry.gain.value = 0.7 * volume; hs.connect(dry); dry.connect(comp);
      // a light room: 1.1 s of decaying stereo noise, with a short pre-delay
      const conv = ctx.createConvolver();
      const len = Math.floor(ctx.sampleRate * 1.1), buf = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); let l = 0; for (let i = 0; i < len; i++) { const kk = i / len, a = 0.45 + 0.4 * (1 - kk); l += ((rnd() * 2 - 1) - l) * a; d[i] = l * Math.pow(1 - kk, 2.6) * (i < 240 ? i / 240 : 1); } }
      conv.buffer = buf;
      const pre = ctx.createDelay(0.1); pre.delayTime.value = 0.012;
      const vlp = ctx.createBiquadFilter(); vlp.type = 'lowpass'; vlp.frequency.value = 4800;
      verb = pre; pre.connect(vlp); vlp.connect(conv);
      const wetGain = ctx.createGain(); wetGain.gain.value = 0.3; conv.connect(wetGain); wetGain.connect(comp);
      noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const nd = noise.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = rnd() * 2 - 1;
      live = ctx.createGain(); live.connect(bodyIn); live.connect(verb); newEpoch();
      queueWarm();
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }
  const keyOf = (k, qi) => (k >= 10 ? k : qi * 16 + k);
  function bufferFor(k, qi) {
    const key = keyOf(k, qi);
    let b = buffers.get(key);
    if (!b) { const d = renderSound(k, qi, ctx.sampleRate); b = ctx.createBuffer(1, d.length, ctx.sampleRate); b.getChannelData(0).set(d); buffers.set(key, b); }
    return b;
  }
  function queueWarm() { warmQ = [10, 11, ...Array.from({ length: 10 }, (_, k) => k)]; warm(); }
  function warm() {
    if (!ctx || !warmQ.length) return;
    bufferFor(warmQ.shift(), mode);
    setTimeout(warm, 6);
  }
  function newEpoch() {
    const old = [epoch, epochDry];
    epoch = ctx.createGain(); epoch.gain.value = 1; epoch.connect(bodyIn); epoch.connect(verb);
    epochDry = ctx.createGain(); epochDry.gain.value = 1; epochDry.connect(dry);
    for (const o of old) if (o) { const t = ctx.currentTime; o.gain.cancelScheduledValues(t); o.gain.setValueAtTime(o.gain.value, t); o.gain.linearRampToValueAtTime(0, t + 0.02); setTimeout(() => { try { o.disconnect(); } catch {} }, 4000); }
    voices.length = 0;
  }

  function pluck(k, vel, at, out) {
    const c = ctx, v = Math.max(0.05, Math.min(1, vel));
    const src = c.createBufferSource(); src.buffer = bufferFor(k, mode);
    src.playbackRate.value = 1 + (rnd() - 0.5) * 0.0015;
    const lpf = c.createBiquadFilter(); lpf.type = 'lowpass'; lpf.frequency.value = 1400 + 7000 * v * v; lpf.Q.value = 0.4;
    const g = c.createGain(); g.gain.value = 0.3 + 0.7 * v;
    const pn = c.createStereoPanner ? c.createStereoPanner() : null;
    src.connect(lpf); lpf.connect(g);
    if (pn) { pn.pan.value = ((Math.min(9, Math.max(0, k)) / 9) - 0.5) * 0.5; g.connect(pn); pn.connect(out); } else g.connect(out);
    const end = at + src.buffer.duration + 0.05;
    src.start(at); src.stop(end);
    if (k < 10) { voices.push({ g, at, end }); if (voices.length > 40) voices.shift(); }
  }
  function click(accent, at, out) {
    const c = ctx, o = c.createOscillator(), og = c.createGain();
    o.type = 'triangle'; o.frequency.value = accent ? 1400 : 950;
    og.gain.setValueAtTime(0.0001, at); og.gain.exponentialRampToValueAtTime(accent ? 0.2 : 0.12, at + 0.001); og.gain.exponentialRampToValueAtTime(0.0001, at + 0.04);
    o.connect(og); og.connect(out); o.start(at); o.stop(at + 0.06);
  }
  // A palm on the bowl: every string that has started is faded in 30 ms, with a soft hide thud.
  function damp(at, out) {
    for (const v of voices) if (v.at <= at + 0.002 && v.end > at) { v.g.gain.cancelScheduledValues(at); v.g.gain.setTargetAtTime(0, at, 0.012); }
    const src = ctx.createBufferSource(); src.buffer = noise;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 520;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(0.16, at + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.07);
    src.connect(f); f.connect(g); g.connect(out); src.start(at, 0, 0.1);
  }

  const api = {
    get available() { return !!AC; },
    haptic(ms) { try { globalThis.navigator?.vibrate?.(ms); } catch {} },
    unlock() { ensure(); },
    get ready() { return !!ctx && ctx.state === 'running'; },
    setMuted(m) { muted = !!m; if (dry) dry.gain.value = muted ? 0 : 0.7 * volume; },
    get muted() { return muted; },
    setVolume(v) { volume = v; if (dry && !muted) dry.gain.value = 0.7 * volume; },
    setMode(qi) { if (qi !== mode) { mode = qi; if (ctx) { voices.length = 0; queueWarm(); } } },
    get mode() { return mode; },
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
    // Sound k (0..9 strings, 10 tok, 11 thump), k = -1 the click (kind 'accent' | 'beat'), k = -2 a damp. songT = null: right now.
    play(k, kind, vel = 0.8, songT = null) {
      if (muted) return;
      if (!ensure() || ctx.state !== 'running') return;
      const at = songT === null ? ctx.currentTime + 0.002 : Math.max(ctx.currentTime + 0.002, songT + offset);
      const out = songT === null ? live : epoch;
      if (k === -1) click(kind === 'accent', at, epochDry);
      else if (k === -2) damp(at, out);
      else if (k >= 0 && k < SOUND_COUNT) pluck(k, vel, at, out);
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

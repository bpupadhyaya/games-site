// Oud Maqam Strings: the sound engine (Web Audio). It lives OUTSIDE web/src because it touches the browser (the game core stays pure).
// Everything is synthesised (no recordings): a plucked course pair (two detuned saws + an octave string through a filter that closes as
// the note decays, a plectrum click, a body resonance), a riq-like dum/tak/sak, a drone, and a flute-like shimmer.
// The player's own plucks are live voices whose pitch can be moved while they ring; the computer's notes and the rhythm are scheduled
// on the audio clock through an "epoch" gain so a pause can silence everything not yet heard.
// Song time -> audio time uses an offset smoothed over the last second, so frame jitter never reaches the ear.

export function createOudEngine() {
  const AC = globalThis.AudioContext ?? globalThis.webkitAudioContext;
  let ctx = null, comp = null, dry = null, verb = null, noise = null, live = null, epoch = null, body = null, droneNodes = null;
  let muted = false, offset = 0, haveOffset = false, nextId = 1;
  const voices = new Map();

  function ensure() {
    if (!AC) return null;
    if (!ctx) {
      try { ctx = new AC({ latencyHint: 'interactive' }); } catch { ctx = new AC(); }
      comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -16; comp.knee.value = 14; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.2;
      dry = ctx.createGain(); dry.gain.value = 0.9; dry.connect(comp); comp.connect(ctx.destination);
      // the wooden body: a high-pass and two soft resonances shared by every string
      body = ctx.createGain();
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 70;
      const r1 = ctx.createBiquadFilter(); r1.type = 'peaking'; r1.frequency.value = 215; r1.Q.value = 1.6; r1.gain.value = 5;
      const r2 = ctx.createBiquadFilter(); r2.type = 'peaking'; r2.frequency.value = 520; r2.Q.value = 1.2; r2.gain.value = 3;
      body.connect(hp); hp.connect(r1); r1.connect(r2); r2.connect(dry);
      // a small room
      const conv = ctx.createConvolver();
      const len = Math.floor(ctx.sampleRate * 1.8), buf = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); let lp = 0; for (let i = 0; i < len; i++) { const k = i / len; lp += ((Math.random() * 2 - 1) - lp) * (0.5 + 0.4 * (1 - k)); d[i] = lp * Math.pow(1 - k, 2.4) * (i < 300 ? i / 300 : 1); } }
      conv.buffer = buf;
      const pre = ctx.createDelay(0.1); pre.delayTime.value = 0.018;
      const vlp = ctx.createBiquadFilter(); vlp.type = 'lowpass'; vlp.frequency.value = 4800;
      verb = pre; pre.connect(vlp); vlp.connect(conv);
      const wet = ctx.createGain(); wet.gain.value = 0.42; conv.connect(wet); wet.connect(comp);
      noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const nd = noise.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
      live = ctx.createGain(); live.connect(body); live.connect(verb);
      newEpoch();
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }
  function newEpoch() {
    const old = epoch;
    epoch = ctx.createGain(); epoch.gain.value = 1; epoch.connect(body); epoch.connect(verb);
    if (old) { const t = ctx.currentTime; old.gain.cancelScheduledValues(t); old.gain.setValueAtTime(old.gain.value, t); old.gain.linearRampToValueAtTime(0, t + 0.02); setTimeout(() => { try { old.disconnect(); } catch {} }, 2500); }
  }

  const hz = (tonic, c) => tonic * Math.pow(2, c / 1200);
  function clickNoise(t, out, vel, freq = 2800) {
    const s = ctx.createBufferSource(); s.buffer = noise; const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 1.1;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.32 * vel, t + 0.0015); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.022);
    s.connect(f); f.connect(g); g.connect(out); s.start(t, Math.random() * 0.5); s.stop(t + 0.04);
  }

  // One plucked course. Returns an id. opts: { tonic, vel, at (audio time or null for now), live (bool), to, slideAt, slideDur }
  function pluckVoice(c0, o) {
    const t = o.at, f0 = hz(o.tonic, c0), vel = Math.max(0.1, Math.min(1, o.vel ?? 0.8));
    const out = o.live ? live : epoch;
    const g = ctx.createGain(), flt = ctx.createBiquadFilter(), pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    flt.type = 'lowpass'; flt.Q.value = 0.9;
    flt.frequency.setValueAtTime(Math.min(9000, f0 * 11), t); flt.frequency.exponentialRampToValueAtTime(Math.max(600, f0 * 2.4), t + 0.28);
    const tau = Math.max(0.28, 0.9 - f0 / 700);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.5 * vel, t + 0.003); g.gain.setTargetAtTime(0.0001, t + 0.004, tau);
    const oscs = [];
    const mk = (type, mul, det, amp) => { const os = ctx.createOscillator(), og = ctx.createGain(); os.type = type; os.frequency.setValueAtTime(f0 * mul, t); os.detune.value = det; og.gain.value = amp; os.connect(og); og.connect(flt); os.start(t); os.stop(t + 4); oscs.push({ os, mul }); };
    mk('sawtooth', 1, -4, 0.34); mk('sawtooth', 1, 4, 0.34); mk('triangle', 2, 0, 0.2); mk('sine', 1, 0, 0.22);
    flt.connect(g);
    if (pan) { pan.pan.value = 0.12; g.connect(pan); pan.connect(out); } else g.connect(out);
    clickNoise(t, out, vel);
    if (o.to !== undefined) {                                      // a scheduled slide (the computer's hand)
      const s0 = t + (o.slideAt ?? 0.05), s1 = s0 + (o.slideDur ?? 0.4), f1 = hz(o.tonic, o.to);
      for (const { os, mul } of oscs) { os.frequency.setValueAtTime(f0 * mul, s0); os.frequency.exponentialRampToValueAtTime(f1 * mul, s1); }
      flt.frequency.cancelScheduledValues(s0); flt.frequency.setValueAtTime(Math.max(600, f0 * 2.4), s0); flt.frequency.exponentialRampToValueAtTime(Math.max(600, f1 * 2.4), s1);
    }
    const id = nextId++;
    voices.set(id, { g, oscs, flt, tonic: o.tonic, start: t, c: c0 });
    if (voices.size > 24) voices.delete(voices.keys().next().value);
    return id;
  }

  function drumHit(kind, vel, at) {
    const t = at, out = epoch, v = vel;
    if (kind === 'dum') {
      const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(190, t); o.frequency.exponentialRampToValueAtTime(92, t + 0.09);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.34 * v, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
      o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.35);
      clickNoise(t, out, 0.3 * v, 1200);
    } else if (kind === 'tak') {
      const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'triangle'; o.frequency.setValueAtTime(1100, t); o.frequency.exponentialRampToValueAtTime(760, t + 0.04);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.14 * v, t + 0.002); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
      o.connect(g); g.connect(out); o.start(t); o.stop(t + 0.15);
      clickNoise(t, out, 0.6 * v, 4200);
    } else clickNoise(t, out, 0.45 * v, 5200);
  }
  function click(accent, at) {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'square'; o.frequency.value = accent ? 1900 : 1250;
    g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(accent ? 0.12 : 0.07, at + 0.001); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.035);
    o.connect(g); g.connect(epoch); o.start(at); o.stop(at + 0.05);
  }
  function shimmer(c, tonic, vel, at) {
    const f = hz(tonic, c) * 2, o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'sine'; o.frequency.value = f; o2.type = 'sine'; o2.frequency.value = f * 2; const g2 = ctx.createGain(); g2.gain.value = 0.2;
    g.gain.setValueAtTime(0.0001, at); g.gain.linearRampToValueAtTime(0.1 * vel, at + 0.04); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.7);
    o.connect(g); o2.connect(g2); g2.connect(g); g.connect(epoch); o.start(at); o2.start(at); o.stop(at + 0.8); o2.stop(at + 0.8);
  }

  const api = {
    get available() { return !!AC; },
    haptic(ms) { try { globalThis.navigator?.vibrate?.(ms); } catch {} },
    unlock() { ensure(); },
    get ready() { return !!ctx && ctx.state === 'running'; },
    setMuted(m) { muted = !!m; if (dry) dry.gain.value = muted ? 0 : 0.9; },
    now() { return ctx ? ctx.currentTime : 0; },
    sync(songT, hard = false) {
      if (!ctx) return;
      const target = ctx.currentTime - songT;
      if (!haveOffset || hard) { offset = target + 0.03; haveOffset = true; } else offset += (target - offset) * 0.02;
    },
    toSong(audioTime) { return haveOffset && ctx ? audioTime - offset : NaN; },
    // The player's own plucked note, right now. Returns a voice id (or 0).
    pluck(cents, tonic, vel = 0.85) {
      if (muted || !ensure() || ctx.state !== 'running') return 0;
      return pluckVoice(cents, { tonic, vel, at: ctx.currentTime + 0.002, live: true });
    },
    // The computer's note at song time `songT` (optionally sliding to `to` over `dur`).
    play(cents, tonic, vel, songT, to, dur) {
      if (muted || !ensure() || ctx.state !== 'running') return 0;
      const at = Math.max(ctx.currentTime + 0.002, songT + offset);
      return pluckVoice(cents, { tonic, vel, at, live: false, to, slideAt: 0.04, slideDur: dur ? Math.max(0.1, dur - 0.08) : 0.3 });
    },
    // Move the pitch of a ringing voice (the player's finger sliding).
    bend(id, cents) {
      const v = voices.get(id); if (!v || !ctx) return;
      const t = ctx.currentTime, f = hz(v.tonic, cents);
      for (const { os, mul } of v.oscs) os.frequency.setTargetAtTime(f * mul, t, 0.02);
      v.flt.frequency.setTargetAtTime(Math.max(600, f * 2.4), t, 0.05);
    },
    // Lift the finger: damp the string (but let a very short note be heard for a moment first).
    release(id) {
      const v = voices.get(id); if (!v || !ctx) return;
      const t = Math.max(ctx.currentTime, v.start + 0.32);
      v.g.gain.cancelScheduledValues(ctx.currentTime); v.g.gain.setTargetAtTime(0.0001, t, 0.09);
      voices.delete(id);
    },
    drum(kind, vel, songT) { if (muted || !ensure() || ctx.state !== 'running') return; drumHit(kind, vel, Math.max(ctx.currentTime + 0.002, songT + offset)); },
    click(accent, songT) { if (muted || !ensure() || ctx.state !== 'running') return; click(accent, Math.max(ctx.currentTime + 0.002, songT + offset)); },
    shimmer(cents, tonic, vel = 0.7) { if (muted || !ensure() || ctx.state !== 'running') return; shimmer(cents, tonic, vel, ctx.currentTime + 0.004); },
    // A steady tonic and fifth under the music.
    drone(on, tonic) {
      if (!ensure()) return;
      if (droneNodes) { const d = droneNodes; droneNodes = null; const t = ctx.currentTime; d.g.gain.cancelScheduledValues(t); d.g.gain.setTargetAtTime(0.0001, t, 0.3); setTimeout(() => { try { d.oscs.forEach((o) => o.stop()); } catch {} }, 1800); }
      if (!on) return;
      const g = ctx.createGain(), f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 700; g.gain.setValueAtTime(0.0001, ctx.currentTime); g.gain.setTargetAtTime(0.05, ctx.currentTime, 0.4);
      const oscs = [];
      for (const [mul, det] of [[0.5, -5], [0.5, 5], [0.75, 0], [1, 0]]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = tonic * mul; o.detune.value = det; const og = ctx.createGain(); og.gain.value = mul === 0.75 ? 0.5 : 1; o.connect(og); og.connect(f); o.start(); oscs.push(o); }
      f.connect(g); g.connect(live);
      droneNodes = { g, oscs };
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

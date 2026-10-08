// Procedural sound for the regatta (no audio files): the big drum, paddle splashes, wood knocks, a crowd, the finish horn.
// Own AudioContext (resumed on the first tap). Reads events only; never touches the simulation.
export function createSfx() {
  const AC = globalThis.AudioContext ?? globalThis.webkitAudioContext;
  let ctx = null, master = null, noiseBuf = null, muted = false, amb = null, ambGain = null, crowd = null, crowdGain = null, click = false;
  const ensure = () => {
    if (!AC) return null;
    if (!ctx) {
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
      const n = ctx.sampleRate * 2, buf = ctx.createBuffer(1, n, ctx.sampleRate), d = buf.getChannelData(0);
      let s = 1; for (let i = 0; i < n; i++) { s = (s * 16807) % 2147483647; d[i] = (s / 2147483647) * 2 - 1; }
      noiseBuf = buf;
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  };
  const noise = (t0, dur, { f = 3000, q = 1, type = 'bandpass', vol = 0.3, attack = 0.001, sweepTo = null } = {}) => {
    const c = ctx; const src = c.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
    const flt = c.createBiquadFilter(); flt.type = type; flt.frequency.setValueAtTime(f, t0); flt.Q.value = q;
    if (sweepTo) flt.frequency.exponentialRampToValueAtTime(sweepTo, t0 + dur);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(vol, t0 + attack); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(flt).connect(g).connect(master); src.start(t0, (t0 * 7.13) % 1.5); src.stop(t0 + dur + 0.02);
  };
  const tone = (t0, dur, f0, f1, { type = 'sine', vol = 0.2, attack = 0.002 } = {}) => {
    const c = ctx; const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t0);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(vol, t0 + attack); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(master); o.start(t0); o.stop(t0 + dur + 0.02);
  };
  const ok = () => !muted && ensure() && ctx.state === 'running';
  const drum = (t, power = 1, bright = 0) => {
    tone(t, 0.32, 150 + bright * 30, 62, { type: 'sine', vol: 0.55 * power, attack: 0.002 });
    tone(t, 0.12, 320, 120, { type: 'triangle', vol: 0.25 * power });
    noise(t, 0.07, { f: 1800 + bright * 800, q: 0.9, vol: 0.22 * power });
    noise(t, 0.35, { f: 260, q: 0.7, vol: 0.16 * power, type: 'lowpass' });
  };

  const api = {
    unlock() { ensure(); },
    setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : 0.9; },
    setClick(on) { click = on; },
    ui(kind = 'tap') {
      if (!ok()) return; const t = ctx.currentTime;
      if (kind === 'tap') tone(t, 0.06, 760, 520, { type: 'triangle', vol: 0.07 });
      else if (kind === 'back') tone(t, 0.07, 520, 360, { type: 'triangle', vol: 0.07 });
      else if (kind === 'good') { tone(t, 0.09, 660, 660, { type: 'triangle', vol: 0.08 }); tone(t + 0.08, 0.14, 990, 990, { type: 'triangle', vol: 0.08 }); }
    },
    event(e, v3) {
      if (!ok()) return;
      const t = ctx.currentTime;
      if (e.type === 'beat') {
        if (e.count) { drum(t, 0.7, 0); tone(t, 0.07, 880, 880, { type: 'triangle', vol: 0.05 }); }
        else { const k = e.kind; drum(t, 1, k === 'sprint' ? 1.6 : k === 'up' ? 1 : 0); if (click) tone(t, 0.04, 1900, 1900, { type: 'square', vol: 0.03 }); }
      } else if (e.type === 'tap') {
        noise(t, 0.12, { f: 1500, sweepTo: 600, q: 0.8, vol: e.tier === 'perfect' ? 0.2 : 0.13 });
        if (e.tier === 'perfect') tone(t, 0.12, 1568, 1568, { type: 'triangle', vol: 0.05 });
        else if (e.tier === 'ragged') tone(t, 0.1, 260, 200, { type: 'square', vol: 0.03 });
      } else if (e.type === 'stray') {
        noise(t, 0.05, { f: 900, q: 1, vol: 0.05 });
      } else if (e.type === 'miss') {
        tone(t, 0.18, 190, 110, { type: 'sine', vol: 0.12 }); noise(t, 0.12, { f: 400, q: 0.6, type: 'lowpass', vol: 0.1 });
      } else if (e.type === 'bump') {
        noise(t, 0.12, { f: 500, q: 0.8, vol: 0.4 }); tone(t, 0.14, 130, 70, { type: 'triangle', vol: 0.3 });
      } else if (e.type === 'clash') {
        noise(t, 0.05, { f: 2200, q: 2, vol: 0.4 }); noise(t + 0.05, 0.05, { f: 1700, q: 2, vol: 0.3 }); tone(t, 0.08, 420, 300, { type: 'square', vol: 0.05 });
      } else if (e.type === 'surge') {
        noise(t, 0.9, { f: 400, sweepTo: 3600, q: 0.6, vol: 0.2, attack: 0.3 });
        for (let k = 0; k < 8; k++) drum(t + k * 0.06, 0.5 + k * 0.05, 1);
      } else if (e.type === 'lift') {
        if (e.ok) { drum(t, 0.9, 1); drum(t + 0.1, 1, 1.4); tone(t + 0.1, 0.25, 880, 1320, { type: 'triangle', vol: 0.07 }); } else tone(t, 0.18, 220, 150, { type: 'square', vol: 0.04 });
      } else if (e.type === 'start') {
        noise(t, 0.6, { f: 900, sweepTo: 2800, q: 0.6, vol: 0.14, attack: 0.1 }); drum(t, 1.2, 1.5);
      } else if (e.type === 'finish' && e.mine) {
        [392, 523, 659, 784].forEach((f, i) => tone(t + i * 0.12, 0.5, f, f, { type: 'sawtooth', vol: 0.05 }));
        noise(t, 2.0, { f: 1200, q: 0.4, vol: 0.2, attack: 0.4 });
      } else if (e.type === 'segment') {
        tone(t, 0.14, 660, 660, { type: 'triangle', vol: 0.06 });
      }
    },
    splash(power = 0.5) {
      if (!ok()) return; const t = ctx.currentTime;
      noise(t, 0.16, { f: 2600, sweepTo: 900, q: 0.5, vol: 0.05 + power * 0.05, attack: 0.01 });
    },
    // faint water and crowd bed while a race is on
    ambience(on, level = 0.5) {
      if (!AC || muted) on = false;
      if (on && !amb && ensure() && ctx.state === 'running') {
        const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
        const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 600;
        ambGain = ctx.createGain(); ambGain.gain.value = 0.0001; ambGain.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 1.5);
        src.connect(f).connect(ambGain).connect(master); src.start(); amb = src;
        const s2 = ctx.createBufferSource(); s2.buffer = noiseBuf; s2.loop = true;
        const f2 = ctx.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 900; f2.Q.value = 0.3;
        crowdGain = ctx.createGain(); crowdGain.gain.value = 0.0001; crowdGain.gain.linearRampToValueAtTime(0.03, ctx.currentTime + 2);
        s2.connect(f2).connect(crowdGain).connect(master); s2.start(); crowd = s2;
      } else if (!on && amb) {
        try { ambGain.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.4); amb.stop(ctx.currentTime + 0.5); crowdGain.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.4); crowd.stop(ctx.currentTime + 0.5); } catch { /* already stopped */ }
        amb = null; crowd = null;
      }
      if (on && crowdGain) crowdGain.gain.value = 0.02 + 0.05 * level;
    },
  };
  return api;
}

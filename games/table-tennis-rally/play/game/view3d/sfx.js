// Procedural sound for the arena (no audio files): the crisp "tok" of the paddle, the "pok" of the table, the net, the swing,
// the crowd. Own AudioContext (resumed on the first tap). Reads events only; never touches the simulation.
export function createSfx() {
  const AC = globalThis.AudioContext ?? globalThis.webkitAudioContext;
  let ctx = null, master = null, noiseBuf = null, muted = false, amb = null, crowdGain = null;
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
    src.connect(flt).connect(g).connect(master); src.start(t0, Math.random() * 1.5); src.stop(t0 + dur + 0.02);
  };
  const tone = (t0, dur, f0, f1, { type = 'sine', vol = 0.2, attack = 0.002 } = {}) => {
    const c = ctx; const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t0);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(vol, t0 + attack); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(master); o.start(t0); o.stop(t0 + dur + 0.02);
  };
  const ok = () => !muted && ensure() && ctx.state === 'running';

  const api = {
    unlock() { ensure(); },
    setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : 0.9; },
    ui(kind = 'tap') {
      if (!ok()) return; const t = ctx.currentTime;
      if (kind === 'tap') tone(t, 0.06, 760, 520, { type: 'triangle', vol: 0.07 });
      else if (kind === 'back') tone(t, 0.07, 520, 360, { type: 'triangle', vol: 0.07 });
      else if (kind === 'good') { tone(t, 0.09, 660, 660, { type: 'triangle', vol: 0.08 }); tone(t + 0.08, 0.14, 990, 990, { type: 'triangle', vol: 0.08 }); }
    },
    event(e, v3) {
      if (!ok()) return;
      const t = ctx.currentTime;
      if (e.type === 'hit') {
        const sp = Math.min(1, (e.speed || 8) / 16), big = e.kind === 'smash', spin = e.kind === 'loop' || e.kind === 'chop' || e.kind === 'push';
        const v = 0.28 + sp * 0.4 + (big ? 0.15 : 0) + (e.perfect ? 0.06 : 0);
        noise(t, 0.045, { f: 3400 + sp * 1400, q: 1.6, vol: v });
        tone(t, 0.05, 1500 + sp * 300, 800, { type: 'triangle', vol: v * 0.45 });
        tone(t, 0.09, 220, 130, { type: 'sine', vol: v * (big ? 0.7 : 0.35) });
        if (spin) noise(t + 0.004, 0.09, { f: 1800, q: 0.7, vol: v * 0.3, type: 'highpass' });
        if (e.q !== undefined && e.q < 0.4) tone(t + 0.01, 0.1, 600, 300, { type: 'square', vol: 0.04 });
      } else if (e.type === 'bounce') {
        const sp = Math.min(1, (e.vIn || 2) / 6);
        tone(t, 0.06, 1250 + e.z * 0, 820, { type: 'sine', vol: 0.12 + sp * 0.2 });
        noise(t, 0.03, { f: 4200, q: 2, vol: 0.06 + sp * 0.1 });
      } else if (e.type === 'net') {
        noise(t, 0.12, { f: 600, q: 0.8, type: 'lowpass', vol: 0.22 }); tone(t, 0.1, 180, 110, { type: 'sine', vol: 0.12 });
      } else if (e.type === 'swing') {
        noise(t, 0.16, { f: 700, sweepTo: 2600, q: 0.9, vol: 0.05 + (e.f || 0.4) * 0.1, attack: 0.05 });
      } else if (e.type === 'toss') {
        tone(t, 0.05, 1900, 2300, { type: 'sine', vol: 0.05 });
      } else if (e.type === 'whiff') {
        noise(t, 0.12, { f: 500, sweepTo: 1700, q: 0.8, vol: 0.07, attack: 0.04 });
      } else if (e.type === 'point') {
        if (e.winner === 'p') { tone(t, 0.12, 784, 784, { type: 'triangle', vol: 0.07 }); tone(t + 0.1, 0.2, 1175, 1175, { type: 'triangle', vol: 0.07 }); noise(t + 0.05, 0.9, { f: 1100, q: 0.5, vol: 0.09, attack: 0.15 }); }
        else { tone(t, 0.18, 330, 247, { type: 'triangle', vol: 0.06 }); noise(t + 0.05, 0.5, { f: 900, q: 0.5, vol: 0.04, attack: 0.1 }); }
      } else if (e.type === 'game' || e.type === 'over') {
        if (e.winner === 'p') { [523, 659, 784, 1046].forEach((f, i) => tone(t + i * 0.1, 0.3, f, f, { type: 'triangle', vol: 0.08 })); noise(t, 1.8, { f: 1300, q: 0.4, vol: 0.16, attack: 0.3 }); }
        else if (e.winner === 'o') [392, 330, 262].forEach((f, i) => tone(t + i * 0.14, 0.3, f, f, { type: 'triangle', vol: 0.07 }));
      } else if (e.type === 'let') tone(t, 0.14, 500, 500, { type: 'square', vol: 0.04 });
    },
    // faint arena murmur while a match is on
    ambience(on) {
      if (!AC || muted) on = false;
      if (on && !amb && ensure() && ctx.state === 'running') {
        const src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true;
        const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 520; f.Q.value = 0.35;
        crowdGain = ctx.createGain(); crowdGain.gain.value = 0.0001; crowdGain.gain.linearRampToValueAtTime(0.022, ctx.currentTime + 1.5);
        src.connect(f).connect(crowdGain).connect(master); src.start(); amb = src;
      } else if (!on && amb) { try { crowdGain.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.5); amb.stop(ctx.currentTime + 0.6); } catch { /* already stopped */ } amb = null; }
    },
  };
  return api;
}

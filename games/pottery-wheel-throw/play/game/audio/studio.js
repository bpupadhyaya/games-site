// Pottery Wheel: the studio sound (Web Audio, synthesised). It lives OUTSIDE web/src because it touches the browser. It is driven once a frame from
// main.js with the game's audio levels (wheel, touch, press, fire, chime); it never changes the game.
export function createStudioAudio() {
  const AC = globalThis.AudioContext ?? globalThis.webkitAudioContext;
  let ctx = null, master = null, hum = null, humGain = null, whirr = null, whirrGain = null, hiss = null, hissGain = null, hissBp = null, roar = null, roarGain = null, noise = null;
  let muted = false, lastChime = 0, crackleAt = 0;
  function ensure() {
    if (!AC) return null;
    if (!ctx) {
      try { ctx = new AC({ latencyHint: 'interactive' }); } catch { ctx = new AC(); }
      master = ctx.createGain(); master.gain.value = 0.9;
      const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3; master.connect(comp); comp.connect(ctx.destination);
      noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = noise.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const loop = () => { const s = ctx.createBufferSource(); s.buffer = noise; s.loop = true; return s; };
      hum = ctx.createOscillator(); hum.type = 'sawtooth'; hum.frequency.value = 58;
      const humLp = ctx.createBiquadFilter(); humLp.type = 'lowpass'; humLp.frequency.value = 180;
      humGain = ctx.createGain(); humGain.gain.value = 0; hum.connect(humLp); humLp.connect(humGain); humGain.connect(master); hum.start();
      whirr = loop(); const wb = ctx.createBiquadFilter(); wb.type = 'bandpass'; wb.frequency.value = 420; wb.Q.value = 0.7;
      whirrGain = ctx.createGain(); whirrGain.gain.value = 0; whirr.connect(wb); wb.connect(whirrGain); whirrGain.connect(master); whirr.start();
      hiss = loop(); hissBp = ctx.createBiquadFilter(); hissBp.type = 'bandpass'; hissBp.frequency.value = 1100; hissBp.Q.value = 0.9;
      hissGain = ctx.createGain(); hissGain.gain.value = 0; hiss.connect(hissBp); hissBp.connect(hissGain); hissGain.connect(master); hiss.start();
      roar = loop(); const rl = ctx.createBiquadFilter(); rl.type = 'lowpass'; rl.frequency.value = 220;
      roarGain = ctx.createGain(); roarGain.gain.value = 0; roar.connect(rl); rl.connect(roarGain); roarGain.connect(master); roar.start();
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }
  function chime() {
    if (!ctx) return;
    const t = ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'sine'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t + i * 0.13); g.gain.exponentialRampToValueAtTime(0.16, t + i * 0.13 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.13 + 1.4);
      o.connect(g); g.connect(master); o.start(t + i * 0.13); o.stop(t + i * 0.13 + 1.5);
    });
  }
  function crackle() {
    const t = ctx.currentTime, s = ctx.createBufferSource(); s.buffer = noise;
    const bp = ctx.createBiquadFilter(); bp.type = 'highpass'; bp.frequency.value = 2500 + Math.random() * 3000;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.14 * Math.random() + 0.03, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03 + Math.random() * 0.04);
    s.connect(bp); bp.connect(g); g.connect(master); s.start(t, Math.random()); s.stop(t + 0.1);
  }
  return {
    unlock: ensure,
    setMuted(m) { muted = m; },
    update(a, o = {}) {
      if (!ctx) return;
      const t = ctx.currentTime, on = !muted && !o.paused;
      const smoothTo = (p, v) => p.setTargetAtTime(v, t, 0.08);
      smoothTo(humGain.gain, on ? 0.05 * a.wheel : 0); hum.frequency.setTargetAtTime(52 + 14 * a.wheel * (o.speed ?? 1), t, 0.2);
      smoothTo(whirrGain.gain, on ? 0.022 * a.wheel : 0);
      smoothTo(hissGain.gain, on ? 0.11 * a.touch : 0); hissBp.frequency.setTargetAtTime(700 + 1700 * Math.min(1, a.press * 2.5), t, 0.1);
      smoothTo(roarGain.gain, on ? 0.12 * Math.sin(Math.min(1, a.fire) * Math.PI) * (a.fire > 0 ? 1 : 0) : 0);
      if (on && a.fire > 0.05 && a.fire < 0.95 && t > crackleAt) { crackle(); crackleAt = t + 0.05 + Math.random() * 0.25 * (1.2 - Math.sin(a.fire * Math.PI)); }
      if (a.chime !== lastChime) { if (on && a.chime > lastChime) chime(); lastChime = a.chime; }
    },
  };
}

// Tiny synthesized sound effects (no audio files needed). Silent no-op in headless tests.
export function createAudio() {
  const AudioCtx = globalThis.AudioContext ?? globalThis.webkitAudioContext;
  let ctx = null;
  let muted = false;

  const ensure = () => {
    if (!AudioCtx) return null;
    if (!ctx) ctx = new AudioCtx();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  };

  return {
    // Call from the first user tap: browsers only allow audio after a gesture.
    unlock: () => void ensure(),
    setMuted(value) {
      muted = value;
    },
    get muted() {
      return muted;
    },
    tone({ freq = 440, to = null, dur = 0.12, type = 'sine', vol = 0.2 } = {}) {
      if (muted) return;
      const ac = ensure();
      if (!ac) return;
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ac.currentTime);
      if (to) osc.frequency.exponentialRampToValueAtTime(to, ac.currentTime + dur);
      gain.gain.setValueAtTime(vol, ac.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + dur);
      osc.connect(gain).connect(ac.destination);
      osc.start();
      osc.stop(ac.currentTime + dur);
    },
  };
}

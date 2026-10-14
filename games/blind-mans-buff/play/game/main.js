import { boot } from './kit/index.js';
import { createGame, meta } from './src/game.js';
import { host } from './src/layout.js';
import { setLogo, setLockup } from './src/brand.js';
import { rosterOf } from './src/engine.js';
import { ABOUT } from './src/content.js';
import { setFogSprite, FOG } from './src/view.js';

const canvas = document.getElementById('game');
let game = null;

// Host safe areas (notch, home indicator) and the floating back button, converted to virtual units (short side = 720).
const syncHost = () => {
  const px = 720 / Math.max(1, Math.min(window.innerWidth, window.innerHeight)), s = window.__safeInsets;
  host.t = s ? (s.top || 0) * px : 0; host.r = s ? (s.right || 0) * px : 0; host.b = s ? (s.bottom || 0) * px : 0; host.l = s ? (s.left || 0) * px : 0;
  host.back = s && s.back !== false && window.__hostBack !== false ? 56 * px : 0; host.px = 1 / px;
};
// The candlelit fog is baked once into a small sprite: a fixed, cheap cost per frame on any phone.
try {
  const N = 384, h = N / 2, fc = document.createElement('canvas'); fc.width = N; fc.height = N;
  const g = fc.getContext('2d'), gr = g.createRadialGradient(h, h, (h * FOG.inner) / FOG.span, h, h, (h * FOG.R) / FOG.span);
  gr.addColorStop(0, 'rgba(8,6,26,0)'); gr.addColorStop(0.35, 'rgba(8,6,26,0.32)'); gr.addColorStop(1, `rgba(8,6,26,${FOG.alpha})`);
  g.fillStyle = gr; g.fillRect(0, 0, N, N); setFogSprite(fc);
} catch (e) { /* the gradient fallback in view.js is used */ }
syncHost();
window.addEventListener('resize', syncHost);
window.addEventListener('safeinsets', syncHost);
document.addEventListener('visibilitychange', () => { if (document.hidden && game) game.autoPause(); });

const q = new URLSearchParams(location.search);
// Store screenshots (`tools/arc shots` loads ?shot=1&seed=N&ticks=0): the seed picks a real screen instead of random monkey taps.
const SHOT_SCENES = {
  1: { scene: 'title' },
  2: { scene: 'play', mode: 'seek', sel: 1, advance: 7 },
  3: { scene: 'play', mode: 'seek', sel: 0, phase: 'feel', clues: 2, select: true },
  4: { scene: 'venues' },
  5: { scene: 'play', auto: true, think: 'think' },
  6: { scene: 'result', mode: 'seek', sel: 0 },
  7: { scene: 'rules', page: 1 },
  8: { scene: 'play', mode: 'hide', sel: 1, advance: 6 },
  9: { scene: 'about' },
  10: { scene: 'play', mode: 'seek', sel: 3, meet: true },
};
const create = async (env) => {
  game = await createGame(env);
  if (q.has('shot') && !q.has('scene') && SHOT_SCENES[Number(q.get('seed'))]) game.dev.jump(SHOT_SCENES[Number(q.get('seed'))]);
  if (env.config.dev) {
    window.__bmb = game;
    if (q.has('scene')) {
      game.dev.jump({
        scene: q.get('scene'), sel: Number(q.get('sel') ?? 0), mode: q.get('mode') ?? 'seek', page: Number(q.get('page') ?? 0), advance: Number(q.get('adv') ?? 0),
        phase: q.get('phase') ?? undefined, clues: Number(q.get('clues') ?? 0), select: q.has('select'), auto: q.has('auto'), meet: q.has('meet'), pause: q.has('pause'),
        hold: q.has('hold'), hint: q.has('hint'), think: q.get('think') ?? undefined,
      });
    }
  }
  return game;
};

const af = new Image(); af.onload = () => setLogo(af); af.src = './brand/arcforge-af.png';
const lk = new Image(); lk.onload = () => setLockup(lk); lk.src = './brand/arcforge-lockup.png';

// ---- real 3D people (presentation layer, platform/view3d) ------------------------------------------------------------------------------
// The sim and the 2D room own everything; src/view.js asks globalThis.__people3d to draw the cast and falls back to its 2D art when it is
// missing (no WebGL2, a failed load, a lost context) or when the page is opened with ?fig=2d.
const wantFig = !/[?&]fig=2d/.test(globalThis.location.search);
const hasWebGL2 = () => { try { return !!globalThis.WebGL2RenderingContext && !!document.createElement('canvas').getContext('webgl2'); } catch { return false; } };
if (wantFig && hasWebGL2()) {
  globalThis.__people3d = { pending: true, draw: () => true };
  const weak = (navigator.deviceMemory && navigator.deviceMemory <= 2) || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 3);
  import('./view3d/people.js')
    .then((m) => m.createPeople({ quality: weak ? 'low' : 'medium' }))
    .then((w) => { globalThis.__people3d = w || null; })
    .catch((e) => { console.warn('3D people unavailable, using the 2D picture', e); globalThis.__people3d = null; });
}
// The vendored 3D layer's licence text, shown with the other About pages (required by the layer's licences).
fetch('./vendor3d/LICENSES.md').then((r) => (r.ok ? r.text() : '')).then((txt) => {
  const paras = txt.split(/\n\s*\n/).map((q) => q.replace(/^#+\s*/gm, '').replace(/\*\*/g, '').replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);
  if (paras.length > 1) ABOUT.push({ h: 'Credits: 3D people and tools' }, ...paras.slice(2).map((p) => ({ p })));
}).catch(() => {});

boot({ createGame: create, meta, canvas, background: '#120f26' });

// ---- the ear: stereo-panned sound for what the seeker hears ------------------------------------------------------------------------------
// The game only reports events (game.cues()); this presenter plays each one once, panned left/right and quieter with distance.
let ac = null, noiseBuf = null, lastId = -1, lastN = 0, nseed = 12345;
const noise = () => { nseed = (Math.imul(nseed, 1664525) + 1013904223) >>> 0; return nseed / 4294967296; };
const ensure = () => {
  if (ac) return ac;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ac = new AC();
  const len = Math.floor(ac.sampleRate * 0.12);
  noiseBuf = ac.createBuffer(1, len, ac.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (noise() * 2 - 1) * Math.pow(1 - i / len, 3);
  return ac;
};
const wake = () => { const c = ensure(); if (c && c.state === 'suspended') c.resume(); };
window.addEventListener('pointerdown', wake, { passive: true });
window.addEventListener('keydown', wake);

function panner(pan, vol) {
  const g = ac.createGain(); g.gain.value = vol;
  if (ac.createStereoPanner) { const p = ac.createStereoPanner(); p.pan.value = pan; g.connect(p).connect(ac.destination); } else g.connect(ac.destination);
  return g;
}
let creakN = 0;
function playEvent(e, me, mode, floor) {
  if (!ac || ac.state !== 'running') return;
  const dx = e.x - me.x, dy = e.y - me.y, d = Math.hypot(dx, dy);
  if (e.who === 'me') { if (e.kind === 'call') return; }
  const pan = Math.max(-1, Math.min(1, dx / 380));
  let vol = Math.max(0.03, 0.55 - d / 1500);
  if (mode === 'hide') vol *= 0.7;
  const t0 = ac.currentTime;
  if (e.kind === 'clap' || e.kind === 'taunt' || e.kind === 'call') {
    const src = ac.createBufferSource(); src.buffer = noiseBuf;
    const f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = e.kind === 'call' ? 900 : 1700; f.Q.value = 0.9;
    const g = panner(e.kind === 'call' ? 0 : pan, vol * (e.kind === 'taunt' ? 0.9 : 0.8));
    src.connect(f).connect(g); src.start(t0);
  } else if (e.kind === 'giggle') {
    const base = (rosterOf(e.who)?.pitch ?? 520) * 1.0;
    const g = panner(pan, vol * 0.35);
    for (let i = 0; i < 3; i++) {
      const o = ac.createOscillator(); o.type = 'triangle';
      const g2 = ac.createGain(); const t = t0 + i * 0.085; g2.gain.setValueAtTime(0.0001, t); g2.gain.exponentialRampToValueAtTime(1, t + 0.01); g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.075);
      o.frequency.setValueAtTime(base * (1 + i * 0.12), t); o.connect(g2).connect(g); o.start(t); o.stop(t + 0.09);
    }
  } else if (e.kind === 'step') {
    const src = ac.createBufferSource(); src.buffer = noiseBuf;
    const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = floor === 'marble' || floor === 'tiles' ? 900 : floor === 'gravel' ? 1800 : 420;
    const g = panner(pan, vol * 0.5); src.connect(f).connect(g); src.start(t0);
    // an old parquet board answers every few steps with a short creak (a falling saw glide, band-passed)
    if (floor === 'parquet' && ((creakN = (creakN + 1) % 5) === 0 || e.n % 7 === 0)) {
      const o = ac.createOscillator(); o.type = 'sawtooth';
      const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 520 + (e.n % 5) * 70; bp.Q.value = 6;
      const cg = panner(pan, vol * 0.22); const ge = ac.createGain(); ge.gain.setValueAtTime(0.0001, t0); ge.gain.exponentialRampToValueAtTime(1, t0 + 0.03); ge.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22);
      o.frequency.setValueAtTime(190 + (e.n % 4) * 25, t0); o.frequency.exponentialRampToValueAtTime(95, t0 + 0.2);
      o.connect(bp).connect(ge).connect(cg); o.start(t0); o.stop(t0 + 0.25);
    }
  }
}
function pump() {
  requestAnimationFrame(pump);
  const c = game && game.cues ? game.cues() : null;
  if (!c) return;
  if (c.id !== lastId) { lastId = c.id; lastN = c.events.length ? c.events[c.events.length - 1].n : 0; return; }
  for (const e of c.events) {
    if (e.n <= lastN) continue;
    lastN = e.n;
    if (c.sound) playEvent(e, c.me, c.mode, c.floor);
  }
}
requestAnimationFrame(pump);

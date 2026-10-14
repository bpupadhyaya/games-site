// Kottabos 3D presenter (game-owned). It READS the game state (game.getState()) and the events the play screen records in v3; it never writes
// back to the simulation. One WebGL canvas sits behind the kit's transparent 2D canvas: a lamplit andron with a reclining symposiast, the
// bronze kottabos stands or the basin of floating saucers, the water drops in the air, splashes and ripples. The 2D layer draws only text,
// plaques and buttons. No WebGL / context lost -> v3.on = false and every screen draws with the flat 2D art; context restored -> back to 3D.
import { v3 } from '../src/v3.js';
import { FR, playLayout } from '../src/layout.js';
import { camOf, targetsView, playerView, aimPaths } from '../src/view.js';
import { dropAt, HAND, G } from '../src/sim.js';
import { THREE } from '../vendor3d/index.js';
import { buildWorld } from './world.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TIERS = [
  { name: 'high', dpr: 2, shadow: 2048, guests: true },
  { name: 'medium', dpr: 1.5, shadow: 1024, guests: true },
  { name: 'low', dpr: 1, shadow: 0, guests: false },
];
const HERO_STAND = { x: 170, h: 78, r: 14, rm: 19 };
const HERO_SC = { kind: 'stands', stands: [HERO_STAND] };

const tick = () => new Promise((r) => setTimeout(r, 0));   // yield so the flat title paints and stays interactive while the 3D scene builds
export async function createPresenter({ kitCanvas, quality = 'high' }) {
  const noop = { wrap: (g) => g, ok: false };
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100dvh;display:block;pointer-events:none;z-index:0';
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance', preserveDrawingBuffer: false }); }
  catch (e) { console.warn('WebGL unavailable; 2D fallback', e); return noop; }
  kitCanvas.parentElement.insertBefore(canvas, kitCanvas);
  kitCanvas.style.position = 'relative'; kitCanvas.style.zIndex = '1';
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.setClearColor(0x120a06, 1);

  const qs = new URLSearchParams(location.search);
  let tier = Math.max(0, TIERS.findIndex((t) => t.name === quality));
  if (qs.has('tier')) tier = clamp(Number(qs.get('tier')), 0, TIERS.length - 1);

  let world;
  try { world = await buildWorld({ renderer, tier: TIERS[tier].name, side: 0, withExtras: true }); }
  catch (e) { console.warn('3D world failed to build; 2D fallback', e); canvas.remove(); return noop; }

  let W = 0, H = 0, dprNow = 0, clock = 0, lastT = performance.now(), ema = 16, frames = 0, prevHero = 0;

  function applyTier() {
    const t = TIERS[tier];
    renderer.shadowMap.enabled = t.shadow > 0; world.rig.key.castShadow = t.shadow > 0;
    if (t.shadow) { world.rig.key.shadow.mapSize.set(t.shadow, t.shadow); if (world.rig.key.shadow.map) { world.rig.key.shadow.map.dispose(); world.rig.key.shadow.map = null; } }
    for (const g of world.guests) g.holder.visible = t.guests;
    W = 0;
    world.scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
  }

  await tick();
  // ---- hero loop (title and flow screens): the player flicks at one stand every ~5 s -------------------------------------------------
  function heroFrame(t) {
    const T = 5.2, cyc = (t % T) / T, s = HERO_STAND;
    const v = 505, a = (47 * Math.PI) / 180, vx = Math.cos(a) * v, vy = Math.sin(a) * v;
    const rel = 0.2, tHit = rel + (s.x - HAND.x) / vx / T;
    const charge = cyc < rel ? clamp(cyc / 0.12, 0, 1) * 0.9 : 0.1;
    const snap = cyc > rel - 0.03 && cyc < rel + 0.12 ? clamp(1 - Math.abs(cyc - (rel + 0.02)) / 0.1, 0, 1) : 0;
    const drops = [];
    for (let k = 0; k < 9; k++) {
      const tt = (cyc - rel) * T - k * 0.018;
      if (tt <= 0) continue;
      const x = HAND.x + vx * tt, y = HAND.y + vy * tt - 0.5 * G * tt * tt;
      if (x < s.x - 6 && y > 0) drops.push({ x, y, vx, vy: vy - G * tt, size: 1 });
    }
    const since = (cyc - tHit) * T, hit = since > 0 && since < 1.6;
    const rock = hit ? Math.sin(since * 22) * 0.12 * Math.exp(-since * 3.2) : 0;
    const tiltDeg = -((47 - 20) * 0.45) - snap * 34 + charge * 8;
    return { kind: 'hero', charge, snap, hand: null, tilt: -(tiltDeg * Math.PI) / 180, loaded: !(cyc > rel + 0.02 && cyc < rel + 0.6), drops, stands: [{ pose: { x: s.x, y: s.h, rot: rock, state: 'rock' }, ring: 0, glow: 0 }], look: { x: s.x / 100, y: (s.h + 12) / 100 }, cyc, tHit };
  }

  await tick();
  // ---- the frame for the play screen ------------------------------------------------------------------------------------------------
  function playFrame(state) {
    const m = state.m, sc = m.sc, fl = m.fl, ft = fl ? fl.t : 0, res = fl ? fl.res : null;
    const tv = targetsView(state, m), pv = playerView(state);
    const fr = { kind: 'play', charge: pv.charge, snap: pv.snap, hand: { x: pv.hand.x, y: pv.hand.y }, tilt: -(pv.tilt * Math.PI) / 180, loaded: pv.loaded, drops: [], stands: [], basin: null };
    if (tv.kind === 'stands') fr.stands = tv.stands; else fr.basin = tv.basin;
    if (res && (m.ph === 'fly' || m.ph === 'settle')) for (const d of res.drops) { const p = dropAt(d, ft); if (p && !p.ended) fr.drops.push({ x: p.x, y: p.y, vx: p.vx, vy: p.vy, size: d.size }); }
    // where he looks: the target while the water is in the air, otherwise the cup
    const first = sc.kind === 'stands' ? { x: sc.stands[0].x / 100, y: (sc.stands[0].h + 8) / 100 } : { x: sc.basin.x / 100, y: 0.25 };
    fr.look = (m.ph === 'fly' || m.ph === 'settle' || m.ph === 'act') ? first : { x: first.x * 0.55, y: first.y * 0.8 };
    return fr;
  }

  function heroCam(state) {
    const r = v3.heroRect;
    const rect = state.scene === 'title' && r ? r : { x: 0, y: FR.h * 0.06, w: FR.w, h: FR.h * 0.44 };
    const wC = 330, s = Math.min(rect.w / wC, (rect.h * 0.9) / 190);
    const floorY = rect.y + rect.h * 0.97, cy = 66, cx = 58;
    const drift = Math.sin(clock * 0.21) * 6;
    return { ox: rect.x + rect.w / 2, cx: cx + drift, cy, my: floorY - cy * s, s };
  }

  function present(state, dt) {
    const L = playLayout();
    const playing = state.scene === 'play' && state.m;
    let fr, cam;
    if (playing) {
      cam = camOf(state, L); fr = playFrame(state);
      world.setTargets(state.m.sc);
    } else {
      fr = heroFrame(clock); cam = heroCam(state);
      world.setTargets(HERO_SC);
      // spray where the stream meets the disc
      if (prevHero < fr.tHit && fr.cyc >= fr.tHit && fr.cyc < fr.tHit + 0.1) world.spawn(HERO_STAND.x - 10, HERO_STAND.h + 4, 7, { col: '#d6f3ff', speed: 0.9, up: 0.5, life: 0.5 });
      prevHero = fr.cyc;
    }
    // sim events -> splashes, sparks, ripples
    for (const e of v3.events.splice(0)) {
      switch (e.type) {
        case 'hit': world.spawn(e.x, e.y, 5, { col: '#d6f3ff', speed: 0.9, up: 0.5, life: 0.5 }); break;
        case 'ting': world.spawn(e.x, e.y, 7, { col: '#ffe9a0', speed: 1.4, up: 0.2, life: 0.4, grav: 3 }); break;
        case 'pole': case 'splat': world.spawn(e.x, e.y, 4, { col: '#cfeeff', speed: 0.8, up: 0.4, life: 0.45 }); break;
        case 'plink': world.spawn(e.x, e.y, 7, { col: '#d6f3ff', speed: 0.9, up: 0.7, life: 0.5 }); world.ripple(e.x, 0.8); break;
        case 'water': world.spawn(e.x, e.y, 5, { col: '#cfeeff', speed: 0.8, up: 0.6, life: 0.5 }); world.ripple(e.x, 0.7); break;
        case 'sink': world.react('cheer', 0.9); world.spawn(e.x, e.y, 18, { col: '#eafcff', speed: 0.7, up: 1.1, life: 1.0, grav: -0.8 }); world.ripple(e.x, 1.1); break;
        case 'clang': world.react('cheer', 1); world.spawn(e.x, e.y, 46, { col: '#ffe08a', speed: 2.4, up: 1.0, life: 0.9, grav: 4 }); break;
        case 'floor': world.spawn(e.x, e.y, 14, { col: '#ffe9a0', speed: 1.6, up: 0.5, life: 0.5, grav: 4 }); break;
        case 'end': { const res = state.m && state.m.fl ? state.m.fl.res : null; if (res) world.react(res.points >= 5 ? 'none' : res.points > 0 ? 'cheer' : 'groan', 0.6); break; }
        default: break;
      }
    }
    world.paths(playing && !state.paused ? aimPaths(state) : []);
    world.setView(cam, FR.w, FR.h, { shake: state.shake || 0, t: state.t });
    world.update(playing && state.paused && state.m.cfg.mode === 'watch' ? 0 : dt, fr);
    renderer.setViewport(0, 0, W, H);
    renderer.render(world.scene, world.camera);
  }

  function prepare() {
    const w = Math.max(1, Math.floor(window.innerWidth)), h = Math.max(1, Math.floor(window.innerHeight));
    const dpr = Math.min(window.devicePixelRatio || 1, TIERS[tier].dpr);
    if (w !== W || h !== H || dpr !== dprNow) { W = w; H = h; dprNow = dpr; renderer.setPixelRatio(dpr); renderer.setSize(w, h, false); }
  }

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); v3.on = false; });
  canvas.addEventListener('webglcontextrestored', () => { W = 0; applyTier(); v3.on = true; });   // B.createEnvironment rebuilds scene.environment itself

  try { applyTier(); }
  catch (e) { console.warn('3D init failed; 2D fallback', e); canvas.remove(); v3.on = false; return noop; }
  await tick();
  try { await renderer.compileAsync(world.scene, world.camera); } catch (e) { /* first frame compiles instead */ }
  v3.on = true;

  return {
    ok: true, renderer, world, scene: world.scene, camera: world.camera,
    wrap(game) {
      return Object.assign({}, game, {
        update(dt, input) {
          const p = input.pointer; v3.pressed = p && p.down ? { x: p.x, y: p.y } : null;
          return game.update(dt, input);
        },
        render(ctx, view) {
          if (!v3.on) { game.render(ctx, view); return; }
          const state = game.getState();
          const now = performance.now(), dt = Math.min(0.1, Math.max(0, (now - lastT) / 1000)); lastT = now; clock += dt;
          ema = ema * 0.95 + dt * 1000 * 0.05; frames++;
          if (frames > 90 && ema > 30 && tier < TIERS.length - 1) { tier++; applyTier(); frames = 0; ema = 16; }
          try { prepare(); } catch (e) { console.warn('3D prepare failed', e); v3.on = false; game.render(ctx, view); return; }
          game.render(ctx, view);
          try { present(state, dt); } catch (e) { console.warn('3D present failed', e); v3.on = false; }
        },
      });
    },
  };
}

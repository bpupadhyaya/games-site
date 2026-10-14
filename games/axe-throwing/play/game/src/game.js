// Axe Throwing: state and flow. Physics live in sim.js; drawing in view.js, art.js and menus.js.
// This is the only file that mutates `state` outside of the simulation step.
//
// Scenes: title, play (match, daily, free, watch), result, collection, settings, howto/about/rules, demolimit.
import {
  AXES, VENUES, LEVELS, RIVALS, makeWorld, stepWorld, press, move, release, advise, newAuto, autoStep, seeded, clamp, axeOwned, venueOwned, HALF,
} from './sim.js';
import { TEXT_SCALES, THINK_STEPS, meta, syncSize, refLayout, inRect, boardRect, toBoard } from './layout.js';
import { renderPlay, layoutOf } from './view.js';
import {
  renderTitle, renderSettings, renderResult, renderPause, renderPages, renderDemoLimit, renderCollection,
  hitScreen, flowMeta, REF, ensureLayout, resetMenus, lockupZone, collectionHit,
} from './menus.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import { setPress } from './ui.js';
import { GL } from './glbridge.js';

export { meta };

// About, plus the third-party credits of the 3D layer when it is in use (web/vendor3d/LICENSES.md, shown whole, as its terms ask).
let aboutKey = '', aboutCache = ABOUT;
const aboutList = () => {
  const txt = GL.licenses || '';
  if (!GL.on || !txt) return ABOUT;
  if (aboutKey === txt) return aboutCache;
  aboutKey = txt;
  const from = txt.indexOf('## '), body = from >= 0 ? txt.slice(from) : txt;
  const paras = body.split(/\n\s*\n/).map((t) => t.replace(/^#+\s*/, '').replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);
  aboutCache = [...ABOUT, { title: 'Credits: the 3D people and scenery', p: paras }];
  return aboutCache;
};
const DEMO_RUNS = 3;
const KEY_SPEED = 380;           // keyboard reticle speed, board units per second
const END_DELAY = 0.4;           // seconds after the last banner before the result

export function createGame(env) {
  const { rng, audio, storage, config, monetization } = env;
  const fxRng = rng.fork(), runRng = rng.fork(), attRng = rng.fork();
  const state = {
    scene: 'title', back: 'title', t: 0, paused: false, pauseMenu: false, demo: !!config.demo, day: (config.day | 0), rev: 0,
    settings: { sound: true, textIdx: 0, thinkIdx: 1 },
    record: { bestSession: 0, bestByVenue: [0, 0, 0, 0], bestDaily: 0, dailyDay: -1, sticks: 0, throws: 0, bulls: 0, clutch: 0, matches: 0, wins: 0, losses: 0, venueSel: 0, level: 1, axeSel: 0, demoRuns: 0 },
    run: null, ws: null, att: null, simRng: null, hint: null, dec: null, pops: [], banner: null, toast: '', toastT: 0,
    fx: { chips: [], dust: [], falls: [], flash: [], shake: 0 }, br: null, kb: { x: 0, y: 60 }, kbDown: false, pend: false,
    fxq: [], fxSeq: 0,
    last: null, collSel: null, collBack: 'title', restoreMsg: '', ui: { scroll: 0, drag: null }, refScroll: 0, loaded: false, hold: 0, endT: 0, attN: 0, drag: false,
  };
  syncSize();
  GL.state = state;
  // sim events for the 3D layer (it only reads): world 'play' or 'att' (the menu match), with a running id
  const feed = (world, ev) => { for (const e of ev) { state.fxq.push({ ...e, id: ++state.fxSeq, world }); } if (state.fxq.length > 60) state.fxq.splice(0, state.fxq.length - 60); };

  // ---- persistence ----------------------------------------------------------------------------------------------
  const save = () => { storage.set('settings', state.settings); storage.set('record', state.record); };
  Promise.all([storage.get('settings', null), storage.get('record', null)]).then(([s, r]) => {
    if (s) Object.assign(state.settings, s);
    if (r) Object.assign(state.record, r);
    const rec = state.record;
    state.settings.textIdx = clamp(state.settings.textIdx | 0, 0, TEXT_SCALES.length - 1);
    state.settings.thinkIdx = clamp(state.settings.thinkIdx | 0, 0, THINK_STEPS.length - 1);
    if (!Array.isArray(rec.bestByVenue) || rec.bestByVenue.length < 4) rec.bestByVenue = [0, 0, 0, 0];
    rec.venueSel = clamp(rec.venueSel | 0, 0, VENUES.length - 1);
    rec.axeSel = clamp(rec.axeSel | 0, 0, AXES.length - 1);
    rec.level = clamp(rec.level | 0, 0, LEVELS.length - 1);
    if (!venueOwned(rec, rec.venueSel)) rec.venueSel = 0;
    if (!axeOwned(rec, rec.axeSel)) rec.axeSel = 0;
    state.loaded = true; state.rev++;
    audio.setMuted?.(!state.settings.sound);
  });

  // ---- sound ----------------------------------------------------------------------------------------------------
  const tone = (o) => { if (state.settings.sound) audio.tone(o); };
  const sfx = {
    grip: () => tone({ freq: 300, to: 380, dur: 0.06, type: 'triangle', vol: 0.04 }),
    whoosh: () => { tone({ freq: 220, to: 900, dur: 0.3, type: 'sawtooth', vol: 0.025 }); tone({ freq: 500, to: 160, dur: 0.4, type: 'triangle', vol: 0.03 }); },
    thunk: (big) => { tone({ freq: 140, to: 55, dur: 0.18, type: 'sine', vol: 0.2 }); tone({ freq: 700 + fxRng.next() * 200, to: 200, dur: 0.06, type: 'triangle', vol: 0.06 }); if (big) tone({ freq: 880, to: 1320, dur: 0.25, type: 'sine', vol: 0.07 }); },
    clank: () => { tone({ freq: 1400, to: 500, dur: 0.12, type: 'square', vol: 0.04 }); tone({ freq: 300, to: 120, dur: 0.2, type: 'triangle', vol: 0.06 }); },
    thud: () => tone({ freq: 110, to: 50, dur: 0.2, type: 'sine', vol: 0.1 }),
    tick: () => tone({ freq: 900, dur: 0.035, type: 'triangle', vol: 0.045 }),
    win: () => [0, 4, 7, 12].forEach((n, i) => tone({ freq: 523 * Math.pow(2, n / 12), dur: 0.22 + i * 0.05, type: 'triangle', vol: 0.09 })),
    lose: () => [0, -3, -7].forEach((n, i) => tone({ freq: 440 * Math.pow(2, n / 12), dur: 0.26 + i * 0.05, type: 'triangle', vol: 0.06 })),
  };
  const toast = (text, secs = 2.8) => { state.toast = text; state.toastT = secs; };

  // ---- effects (drawing only) -------------------------------------------------------------------------------------
  const chips = (x, y, n, col) => {
    for (let i = 0; i < n; i++) {
      const a = -Math.PI * (0.1 + fxRng.next() * 0.8), s = 160 + fxRng.next() * 380;
      state.fx.chips.push({ x, y, vx: Math.cos(a) * s * (fxRng.next() < 0.5 ? -1 : 1), vy: Math.sin(a) * s, rot: fxRng.next() * 6, vr: (fxRng.next() - 0.5) * 18, t: 0, max: 0.7 + fxRng.next() * 0.5, w: 14 + fxRng.next() * 20, h: 6 + fxRng.next() * 6, col: col[i % col.length] });
    }
    if (state.fx.chips.length > 90) state.fx.chips.splice(0, 30);
  };
  const stepFx = (dt) => {
    const f = state.fx;
    for (const c of f.chips) { c.t += dt; c.x += c.vx * dt; c.y += c.vy * dt; c.vy += 1500 * dt; c.rot += c.vr * dt; }
    f.chips = f.chips.filter((c) => c.t < c.max);
    for (const d of f.dust) d.t += dt;
    f.dust = f.dust.filter((d) => d.t < d.max);
    for (const q of f.falls) { q.t += dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 2400 * dt; q.rot += q.vr * dt; }
    f.falls = f.falls.filter((q) => q.t < q.max);
    for (const q of f.flash) q.t += dt;
    f.flash = f.flash.filter((q) => q.t < q.max);
    f.shake = Math.max(0, f.shake - dt * 2.4);
    for (const p of state.pops) p.t += dt;
    state.pops = state.pops.filter((p) => p.t < p.max);
    if (state.toastT > 0) state.toastT -= dt;
    if (state.banner) { state.banner.t += dt; if (state.banner.t >= state.banner.max) state.banner = null; }
  };
  const pop = (text, x, y, col = '#fff', size = 1) => { if (state.pops.length < 8) state.pops.push({ text, x, y, col, size, t: 0, max: 1.2 }); };

  // ---- the title-screen demo: a match that plays itself ---------------------------------------------------------------------------
  let attAuto = newAuto();
  const newAttract = () => { const v = state.attN++ % VENUES.length; state.att = makeWorld({ mode: 'watch', venue: v, level: 1, axe: v % AXES.length }); attAuto = newAuto(); };
  const updateAttract = (dt) => {
    if (!state.att) newAttract();
    const a = state.att;
    autoStep(a, attAuto, attRng, dt); stepWorld(a, dt, attRng); if (a.ev.length) feed('att', a.ev); a.ev.length = 0;
    if (a.over) newAttract();
  };

  // ---- runs ---------------------------------------------------------------------------------------------------------
  const ownedNow = () => ({ axes: AXES.map((_, i) => axeOwned(state.record, i)), venues: VENUES.map((_, i) => venueOwned(state.record, i)) });
  const startRun = (mode) => {
    const rec = state.record;
    if (state.demo && mode !== 'watch' && rec.demoRuns >= DEMO_RUNS) { state.scene = 'demolimit'; state.ui.scroll = 0; state.rev++; return; }
    const daily = mode === 'daily';
    const venue = daily ? state.day % VENUES.length : rec.venueSel, axe = daily ? (state.day >> 2) % AXES.length : rec.axeSel;
    const level = daily ? 1 : rec.level;
    state.simRng = daily ? seeded(state.day * 977 + 5) : runRng;
    state.ws = makeWorld({ mode, venue, level, axe: clamp(axe, 0, AXES.length - 1) });
    state.run = { mode, venue, level, hints: 0, before: ownedNow() };
    state.scene = 'play'; state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; state.last = null;
    state.hint = null; state.dec = null; state.pops.length = 0; state.banner = null; state.endT = 0; state.hold = 0.4; state.drag = false; state.kbDown = false; state.pend = false;
    state.fx = { chips: [], dust: [], falls: [], flash: [], shake: 0 };
    state.kb = { x: 0, y: 60 };
    if (state.demo && mode !== 'watch') { rec.demoRuns++; save(); }
    if (mode === 'watch') state.dec = { phase: 'think', t: 0, dur: THINK_STEPS[state.settings.thinkIdx], why: '', ap: newAuto() };
    toast(mode === 'watch' ? 'Watch & Learn: the game thinks before every throw' : 'Press the board to aim, let go with the marker in a green band', 3.8);
  };
  const finishRun = () => {
    const w = state.ws, run = state.run, rec = state.record, mode = run.mode;
    const solo = w.solo;
    const r = {
      mode, total: w.sc.you, rival: w.sc.rival, won: !!(w.result && w.result.won), draw: !!(w.result && w.result.draw), sticks: w.sticks, throws: w.yourThrows,
      bulls: w.bulls, clutch: w.clutch, rounds: w.hist.map((h) => ({ you: h.you, rival: h.rival, sd: h.sd })), rivalName: RIVALS[w.rival].name,
      hints: run.hints, newBest: false, unlocks: [], venue: run.venue,
    };
    if (mode !== 'watch') {
      if (mode !== 'free') {
        if (!solo) { rec.matches++; if (r.won) rec.wins++; else if (!r.draw) rec.losses++; }
        if (!run.hints) {
          if (mode === 'match') {
            if (w.sc.you > rec.bestByVenue[run.venue]) { rec.bestByVenue[run.venue] = w.sc.you; r.newBest = w.sc.you > 0 && r.won; }
            if (w.sc.you > rec.bestSession) rec.bestSession = w.sc.you;
          } else if (mode === 'daily') {
            if (rec.dailyDay !== state.day) { rec.dailyDay = state.day; rec.bestDaily = 0; }
            if (w.sc.you > rec.bestDaily) { rec.bestDaily = w.sc.you; r.newBest = w.sc.you > 0; }
          }
        }
      }
      const now = ownedNow();
      AXES.forEach((a, i) => { if (!run.before.axes[i] && now.axes[i]) r.unlocks.push(a.name); });
      VENUES.forEach((v, i) => { if (!run.before.venues[i] && now.venues[i]) r.unlocks.push(v.name); });
      save();
    }
    state.last = r; state.scene = 'result'; state.ui.scroll = 0; state.paused = false; state.pauseMenu = false; state.hint = null; state.dec = null; state.rev++;
    if (mode !== 'free' && (r.won || r.newBest || r.unlocks.length || (solo && r.total >= 20))) sfx.win(); else if (!solo && !r.draw && mode !== 'watch') sfx.lose();
  };

  // react to what the sim reported this tick
  const handleEvents = () => {
    const w = state.ws, rec = state.record, run = state.run, practice = run.mode === 'watch';
    if (w.ev.length) feed('play', w.ev);
    for (const e of w.ev) {
      if (e.type === 'grip') sfx.grip();
      else if (e.type === 'throw') { sfx.whoosh(); state.hint = null; }
      else if (e.type === 'stick') {
        const mine = e.side === 'you', big = e.ring === 0 || e.ring >= 10;
        sfx.thunk(big && mine);
        chips(e.sx, e.sy, big ? 16 : 10, ['#e8c58a', '#c9965a', '#f2dcaa']);
        state.fx.dust.push({ x: e.sx, y: e.sy, t: 0, max: 0.6 });
        state.fx.flash.push({ x: e.x, y: e.y, t: 0, max: 0.5 });
        state.fx.shake = Math.min(1, state.fx.shake + (big ? 0.7 : 0.45));
        const label = e.ring === 0 ? `Bull! +${e.pts}` : e.ring >= 10 ? `Clutch! +${e.pts}` : e.pts ? `+${e.pts}` : 'Wood';
        pop(label, e.sx, e.sy, mine ? (big ? '#ffd97a' : '#ffffff') : '#7ff0de', big ? 1.25 : 1);
        if (mine && !practice) { rec.sticks++; rec.throws++; if (e.ring === 0) rec.bulls++; if (e.ring >= 10) rec.clutch++; }
      } else if (e.type === 'bounce' || e.type === 'deflect' || e.type === 'miss') {
        sfx.clank(); if (e.type === 'miss') sfx.thud();
        const dir = fxRng.next() < 0.5 ? -1 : 1;
        state.fx.falls.push({ x: e.sx, y: e.sy, vx: dir * (120 + fxRng.next() * 220), vy: -(260 + fxRng.next() * 200), rot: 0, vr: dir * (6 + fxRng.next() * 8), t: 0, max: 1.3, side: e.side });
        if (e.type !== 'miss') { chips(e.sx, e.sy, 5, ['#e8c58a', '#c9965a']); state.fx.shake = Math.min(1, state.fx.shake + 0.2); }
        const why = e.type === 'miss' ? 'Missed' : e.type === 'deflect' ? 'Crowded' : e.delta > 0 ? 'Too slow' : 'Too fast';
        pop(why, e.sx, e.sy, e.side === 'you' ? '#ffb09a' : '#9fd9d0', 0.85);
        if (e.side === 'you' && !practice) rec.throws++;
      } else if (e.type === 'round') {
        if (!w.endless) state.banner = { text: w.solo ? `Round ${e.n}: ${e.you}` : `Round ${e.n}`, sub: w.solo ? '' : `You ${e.you} – ${RIVALS[w.rival].name} ${e.rival}`, col: '#ffd97a', t: 0, max: 1.9 };
      }
    }
    w.ev.length = 0;
  };

  // ---- the Watch & Learn loop: THINK -> REVEAL -> ACT -------------------------------------------------------------------------
  const updateWatch = (dt) => {
    const dec = state.dec, w = state.ws;
    if (!dec || w.over) return;
    const think = THINK_STEPS[state.settings.thinkIdx];
    const myTurn = w.phase === 'aim' && w.side === 'you';
    if (!myTurn) {
      if (dec.phase !== 'think' || (w.phase !== 'ready' && dec.t > 0)) { dec.phase = 'think'; dec.t = 0; dec.dur = think; }
      state.hint = null; return;
    }
    if (dec.phase === 'go') { autoStep(w, dec.ap, state.simRng, dt); return; }
    dec.t += dt;
    if (dec.phase === 'think' && dec.t >= dec.dur) { dec.phase = 'reveal'; dec.t = 0; dec.dur = 2; }
    if (dec.phase === 'reveal') {
      const adv = advise(w); state.hint = adv; dec.why = adv ? adv.why : '';
      if (dec.t >= dec.dur) { dec.phase = 'go'; dec.t = 0; state.hint = null; dec.ap.cool = 0; }
    }
  };

  // ---- hint -------------------------------------------------------------------------------------------------------------
  const requestThink = () => {
    const run = state.run, w = state.ws;
    if (!run || state.paused || run.mode === 'watch' || w.over) return;
    if (state.hint) { state.hint = null; sfx.tick(); return; }
    const adv = advise(w);
    if (!adv) return;
    state.hint = adv;
    if (run.mode !== 'free') run.hints++;
    sfx.tick();
  };

  // ---- pause ------------------------------------------------------------------------------------------------------------
  const openPause = () => { state.paused = true; state.pauseMenu = true; state.ui.scroll = 0; state.rev++; };
  const closePause = () => { state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; state.rev++; };
  const leaveRun = () => { save(); state.scene = 'title'; state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; state.hint = null; state.dec = null; state.rev++; };

  // ---- the play scene --------------------------------------------------------------------------------------------------------
  const scrollFlow = (ptr) => {
    const d = state.ui.drag, mt = flowMeta();
    d.moved = Math.max(d.moved, Math.abs(ptr.y - d.y0));
    if (d.moved >= 10 && mt.lay) { const max = Math.max(0, mt.lay.contentH - (mt.bottom - mt.top)); state.ui.scroll = clamp(d.s0 - (ptr.y - d.y0), 0, max); }
  };
  function handlePauseTap(id) {
    if (!id) return;
    sfx.tick();
    if (id === 'resume') closePause();
    else if (id === 'p-rules') { state.back = 'play'; state.scene = 'rules'; state.refScroll = 0; }
    else if (id === 'p-howto') { state.back = 'play'; state.scene = 'howto'; state.refScroll = 0; }
    else if (id === 'p-sound') { state.settings.sound = !state.settings.sound; audio.setMuted?.(!state.settings.sound); save(); state.rev++; }
    else if (id === 'quit') leaveRun();
  }
  // the reticle sits above the finger so the finger never hides it
  const aimPoint = (ptr) => toBoard(state.br, ptr.x, ptr.y - state.br.w * 0.17);
  const updatePlay = (dt, input) => {
    const run = state.run, w = state.ws, ptr = input.pointer, keys = input.keys, watch = run.mode === 'watch';
    const L = layoutOf(state);
    state.br = boardRect(L.stage, VENUES[w.venue].rail);
    if (keys.pressed.has('KeyP') || keys.pressed.has('Escape')) { if (state.pauseMenu) closePause(); else if (!watch) openPause(); else state.paused = !state.paused; }
    if (state.pauseMenu) {
      if (flowMeta().key !== 'pause') return;
      if (ptr.pressed) state.ui.drag = { y0: ptr.y, s0: state.ui.scroll, moved: 0 };
      if (state.ui.drag && ptr.down) scrollFlow(ptr);
      if (ptr.released && state.ui.drag) { const d = state.ui.drag; state.ui.drag = null; if (d.moved < 10) handlePauseTap(hitScreen(ptr.x, ptr.y, state.ui.scroll)); }
      return;
    }
    // ---- input
    if (watch) {
      if (ptr.pressed) {
        const D = L.demo, st = state.settings;
        const setThink = (v) => { st.thinkIdx = clamp(v, 0, THINK_STEPS.length - 1); sfx.tick(); save(); toast(`Thinking time: ${THINK_STEPS[st.thinkIdx]} s`, 1.6); if (state.dec && state.dec.phase === 'think') state.dec.dur = THINK_STEPS[st.thinkIdx]; };
        if (inRect(D.pause, ptr.x, ptr.y)) { state.paused = !state.paused; sfx.tick(); }
        else if (inRect(D.dec, ptr.x, ptr.y)) setThink(st.thinkIdx - 1);
        else if (inRect(D.inc, ptr.x, ptr.y)) setThink(st.thinkIdx + 1);
        else if (inRect(D.exit, ptr.x, ptr.y)) { leaveRun(); return; }
      }
    } else if (!w.over && !state.paused) {
      const myAim = w.phase === 'aim' && w.side === 'you';
      if (ptr.pressed) {
        if (inRect(L.pause, ptr.x, ptr.y)) { openPause(); return; }
        if (inRect(L.think, ptr.x, ptr.y)) requestThink();
        else if (state.hold <= 0 && inRect(L.stage, ptr.x, ptr.y)) {
          if (myAim) { const p = aimPoint(ptr); if (press(w, p.x, p.y)) state.drag = true; } else state.pend = true;
        }
      }
      if (state.pend && ptr.down && myAim && !state.drag) { const p = aimPoint(ptr); if (press(w, p.x, p.y)) { state.drag = true; state.pend = false; } }
      if (!ptr.down) state.pend = false;
      if (state.drag) {
        if (w.aim.down && ptr.down) { const p = aimPoint(ptr); move(w, p.x, p.y); }
        if (!ptr.down || ptr.released) { state.drag = false; if (w.aim.down) release(w); }
      } else {
        // keyboard: arrows move the reticle, Space starts the swing (hold) and throws (release)
        const kx = (keys.down.has('ArrowRight') || keys.down.has('KeyD') ? 1 : 0) - (keys.down.has('ArrowLeft') || keys.down.has('KeyA') ? 1 : 0);
        const ky = (keys.down.has('ArrowDown') || keys.down.has('KeyS') ? 1 : 0) - (keys.down.has('ArrowUp') || keys.down.has('KeyW') ? 1 : 0);
        const kb = state.kb;
        if (kx || ky) { kb.x = clamp(kb.x + kx * KEY_SPEED * dt, -HALF, HALF); kb.y = clamp(kb.y + ky * KEY_SPEED * dt, -HALF, HALF); if (w.aim.down && state.kbDown) move(w, kb.x, kb.y); }
        if (keys.pressed.has('Space') && myAim && !w.aim.down && state.hold <= 0) { if (press(w, kb.x, kb.y)) state.kbDown = true; }
        if (state.kbDown && !keys.down.has('Space')) { state.kbDown = false; if (w.aim.down) release(w); }
        if (!w.aim.down) state.kbDown = false;
      }
      if (keys.pressed.has('KeyH')) requestThink();
      if (state.hint) state.hint = myAim || w.phase === 'ready' ? advise(w) : null;
    }
    if (state.paused) return;
    // ---- time passes
    if (state.hold > 0) state.hold = Math.max(0, state.hold - dt);
    if (watch) updateWatch(dt);
    stepWorld(w, dt, state.simRng);
    handleEvents();
    stepFx(dt);
    if (w.over) {
      state.endT += dt;
      if (state.endT >= END_DELAY + (state.banner ? 0.9 : 0.1)) finishRun();
    }
  };

  // ---- menus ----------------------------------------------------------------------------------------------------------------
  const handleTitle = (id) => {
    if (!id) return;
    if (id === 'arcforge') { env.openArcforgeHome?.(); return; }
    sfx.tick();
    const rec = state.record;
    if (id === 'match' || id === 'daily' || id === 'free' || id === 'watch') startRun(id);
    else if (id === 'venue') { let n = rec.venueSel; for (let i = 0; i < VENUES.length; i++) { n = (n + 1) % VENUES.length; if (venueOwned(rec, n)) break; } rec.venueSel = n; save(); state.rev++; }
    else if (id === 'level') { rec.level = (rec.level + 1) % LEVELS.length; save(); state.rev++; }
    else if (id === 'collection') { state.collBack = 'title'; state.collSel = null; state.scene = 'collection'; state.ui.scroll = 0; state.rev++; }
    else if (id === 'howto' || id === 'rules' || id === 'about') { state.back = 'title'; state.scene = id; state.refScroll = 0; }
    else if (id === 'settings') { state.scene = 'settings'; state.ui.scroll = 0; state.rev++; }
    else if (id === 'sound') { state.settings.sound = !state.settings.sound; audio.setMuted?.(!state.settings.sound); save(); state.rev++; }
  };
  const handleSettings = (id) => {
    if (!id) return;
    const st = state.settings;
    sfx.tick();
    if (id === 'set-sound') { st.sound = !st.sound; audio.setMuted?.(!st.sound); }
    else if (id === 'txt-dec') st.textIdx = Math.max(0, st.textIdx - 1);
    else if (id === 'txt-inc') st.textIdx = Math.min(TEXT_SCALES.length - 1, st.textIdx + 1);
    else if (id === 'think-dec') st.thinkIdx = Math.max(0, st.thinkIdx - 1);
    else if (id === 'think-inc') st.thinkIdx = Math.min(THINK_STEPS.length - 1, st.thinkIdx + 1);
    else if (id === 'restore') {
      if (state.restoreBusy || state.owned) return;
      state.restoreBusy = true; state.restoreMsg = 'Checking with the store…'; state.rev++;
      Promise.resolve(monetization.restore?.()).then(() => { state.restoreMsg = monetization.owns('unlock_game') ? 'Purchase restored. Thank you!' : 'No earlier purchase found.'; })
        .catch(() => { state.restoreMsg = 'Could not reach the store. Try again later.'; })
        .finally(() => { state.restoreBusy = false; state.rev++; });
    } else if (id === 'back') { state.scene = 'title'; state.ui.scroll = 0; state.restoreMsg = ''; }
    state.rev++; save();
  };
  const handleResult = (id) => {
    if (!id) return;
    sfx.tick();
    const r = state.last;
    if (id === 'again') startRun(r ? r.mode : 'match');
    else if (id === 'menu') { state.scene = 'title'; state.ui.scroll = 0; state.rev++; }
    else if (id === 'collection') { state.collBack = 'result'; state.collSel = null; state.scene = 'collection'; state.ui.scroll = 0; state.rev++; }
    else if (id === 'share' && r) { Promise.resolve(env.share?.(r.mode === 'match' ? `I scored ${r.total} to ${r.rival} in an Axe Throwing match in Arcforge!` : `I scored ${r.total} in a Daily Round of Axe Throwing in Arcforge!`)).catch(() => {}); }
  };
  const updateFlowScene = (dt, input, handler, key) => {
    const ptr = input.pointer;
    ensureLayout(state, key);
    { const m0 = flowMeta(); state.ui.scroll = clamp(state.ui.scroll, 0, m0.lay ? Math.max(0, m0.lay.contentH - (m0.bottom - m0.top)) : 0); }
    if (ptr.pressed) state.ui.drag = { y0: ptr.y, x0: ptr.x, s0: state.ui.scroll, moved: 0 };
    if (state.ui.drag && ptr.down) scrollFlow(ptr);
    if (ptr.released && state.ui.drag) {
      const d = state.ui.drag; state.ui.drag = null;
      const lay = flowMeta(), scrollable = lay.lay && lay.lay.contentH > lay.bottom - lay.top;
      if (d.moved < 10) handler(hitScreen(ptr.x, ptr.y, state.ui.scroll));
      else if (!scrollable) handler(hitScreen(d.x0, d.y0, state.ui.scroll));
    }
    const mt = flowMeta(), max = mt.lay ? Math.max(0, mt.lay.contentH - (mt.bottom - mt.top)) : 0;
    if (input.keys.pressed.has('Equal') || input.keys.pressed.has('NumpadAdd')) { state.settings.textIdx = Math.min(TEXT_SCALES.length - 1, state.settings.textIdx + 1); state.rev++; save(); }
    if (input.keys.pressed.has('Minus') || input.keys.pressed.has('NumpadSubtract')) { state.settings.textIdx = Math.max(0, state.settings.textIdx - 1); state.rev++; save(); }
    if (input.keys.down.has('ArrowDown')) state.ui.scroll = clamp(state.ui.scroll + 14, 0, max);
    if (input.keys.down.has('ArrowUp')) state.ui.scroll = clamp(state.ui.scroll - 14, 0, max);
  };
  const updateCollection = (dt, input) => {
    const ptr = input.pointer, rec = state.record;
    ensureLayout(state, 'collection');
    if (ptr.pressed) state.ui.drag = { y0: ptr.y, x0: ptr.x, s0: state.ui.scroll, moved: 0 };
    if (state.ui.drag && ptr.down) scrollFlow(ptr);
    if (ptr.released && state.ui.drag) {
      const d = state.ui.drag; state.ui.drag = null;
      if (d.moved < 10) {
        const h = collectionHit(ptr.x, ptr.y);
        if (h) {
          const same = state.collSel && state.collSel.kind === h.kind && state.collSel.i === h.i;
          if (h.kind === 't' && same && venueOwned(rec, h.i) && rec.venueSel !== h.i) { rec.venueSel = h.i; save(); sfx.win(); }
          else if (h.kind === 'f' && same && axeOwned(rec, h.i) && rec.axeSel !== h.i) { rec.axeSel = h.i; save(); sfx.win(); }
          else sfx.tick();
          state.collSel = { kind: h.kind, i: h.i }; state.rev++;
        } else if (hitScreen(ptr.x, ptr.y, state.ui.scroll) === 'back') { state.scene = state.collBack; state.ui.scroll = 0; state.rev++; sfx.tick(); }
      }
    }
    const mt = flowMeta(), max = mt.lay ? Math.max(0, mt.lay.contentH - (mt.bottom - mt.top)) : 0;
    state.ui.scroll = clamp(state.ui.scroll, 0, max);
    if (input.keys.pressed.has('Escape')) { state.scene = state.collBack; state.ui.scroll = 0; state.rev++; }
  };
  let refDrag = null, wheelHooked = false;
  const updatePages = (input) => {
    const ptr = input.pointer, keys = input.keys, RL = refLayout(), set = (v) => { state.refScroll = clamp(v, 0, REF.max); };
    const close = () => { state.scene = state.back === 'play' ? 'play' : 'title'; state.refScroll = 0; };
    if (ptr.pressed) {
      if (inRect(RL.next, ptr.x, ptr.y) || inRect(RL.back, ptr.x, ptr.y)) { close(); return; }
      else if (inRect(RL.dec, ptr.x, ptr.y)) { state.settings.textIdx = Math.max(0, state.settings.textIdx - 1); state.refScroll = 0; state.rev++; save(); }
      else if (inRect(RL.inc, ptr.x, ptr.y)) { state.settings.textIdx = Math.min(TEXT_SCALES.length - 1, state.settings.textIdx + 1); state.refScroll = 0; state.rev++; save(); }
      else if (inRect(RL.panel, ptr.x, ptr.y)) refDrag = { y0: ptr.y, s0: state.refScroll };
    }
    if (refDrag) { if (ptr.down) set(refDrag.s0 - (ptr.y - refDrag.y0)); else refDrag = null; }
    if (keys.pressed.has('ArrowDown')) set(state.refScroll + 70);
    if (keys.pressed.has('ArrowUp')) set(state.refScroll - 70);
    if (keys.pressed.has('PageDown') || keys.pressed.has('Space')) set(state.refScroll + REF.view * 0.9);
    if (keys.pressed.has('PageUp')) set(state.refScroll - REF.view * 0.9);
    if (keys.pressed.has('Home')) set(0);
    if (keys.pressed.has('End')) set(1e9);
    if (keys.pressed.has('Escape')) close();
  };

  resetMenus();
  newAttract();
  for (let i = 0; i < 60 * 3; i++) updateAttract(1 / 60);

  // Store screenshots (main.js calls this only for ?shot=1&scene=...): put the game in a named moment and run it forward.
  const IDLE = { pointer: { x: -1, y: -1, down: false, pressed: false, released: false }, keys: { down: new Set(), pressed: new Set() } };
  const advance = (n) => { for (let i = 0; i < n; i++) api.update(1 / 60, IDLE); };
  let shotAuto = newAuto();
  const autoPlay = (n) => { for (let i = 0; i < n; i++) { autoStep(state.ws, shotAuto, state.simRng, 1 / 60); api.update(1 / 60, IDLE); } };
  const shotScene = (name) => {
    const rec = state.record;
    rec.bestSession = 33; rec.bestDaily = 27; rec.bestByVenue = [33, 24, 0, 0]; rec.dailyDay = state.day; rec.sticks = 40; rec.throws = 61; rec.wins = 3; rec.matches = 6; rec.bulls = 8;
    state.loaded = true; state.rev++;
    advance(10);
    if (name === 'title') { advance(400); return; }
    const play = (venue, axe, lvl, until) => {
      rec.venueSel = venue; rec.axeSel = axe; rec.level = lvl; startRun('match'); state.toastT = 0; state.hold = 0; shotAuto = newAuto();
      for (let i = 0; i < 60 * 150 && !until(state.ws); i++) autoPlay(1);
    };
    const pm = /^play([0-3])$/.exec(name);
    if (pm) { play(+pm[1], +pm[1] % AXES.length, 1, (w) => w.turn >= 2 && w.phase === 'aim' && w.side === 'you'); const w = state.ws; press(w, 30, -70); advance(40); return; }
    if (name === 'play' || name === 'think') {
      play(1, 0, 1, (w) => w.turn >= 3 && w.phase === 'aim' && w.side === 'you');
      const w = state.ws; press(w, 30, -70); advance(40);
      if (name === 'think') { w.aim.down = false; w.aim.mt = 0; requestThink(); }
      return;
    }
    if (name === 'stick') {
      play(0, 0, 1, (w) => w.round === 0 && w.turn >= 2 && w.phase === 'aim' && w.side === 'you');
      const w = state.ws, a = advise(w); press(w, a.x, a.y);
      for (let i = 0; i < 600 && w.aim.mt < a.tc; i++) advance(1);
      release(w);
      for (let i = 0; i < 600 && !(w.f && w.f.t > w.f.dur * 0.55); i++) advance(1);
      return;
    }
    if (name === 'landed') { play(2, 2, 1, (w) => w.round === 1 && w.turn >= 1 && w.phase === 'settle'); return; }
    if (name === 'night') { play(3, 2, 1, (w) => w.round === 0 && w.turn >= 3 && w.phase === 'aim' && w.side === 'you'); return; }
    if (name === 'collection') { state.scene = 'collection'; state.collBack = 'title'; state.collSel = { kind: 'f', i: 2 }; state.rev++; advance(2); return; }
    if (name === 'rules' || name === 'howto' || name === 'about') { state.back = 'title'; state.scene = name; state.refScroll = 0; advance(2); return; }
    if (name === 'settings') { state.scene = 'settings'; state.rev++; advance(2); return; }
    if (name === 'result') {
      state.last = { mode: 'match', total: 31, rival: 24, won: true, draw: false, sticks: 8, throws: 9, bulls: 2, clutch: 1, rounds: [{ you: 12, rival: 10 }, { you: 9, rival: 8 }, { you: 10, rival: 6 }], rivalName: 'Marit', hints: 0, newBest: true, unlocks: [], venue: 1 };
      state.scene = 'result'; state.rev++; advance(3); return;
    }
    if (name === 'watch') {
      rec.venueSel = 2; rec.axeSel = 0; state.settings.thinkIdx = 0;
      startRun('watch'); state.toastT = 0; state.hold = 0;
      for (let i = 0; i < 60 * 40 && !(state.dec && state.dec.phase === 'reveal' && state.dec.t > 0.8 && state.ws.turn >= 2); i++) advance(1);
      return;
    }
    if (name === 'pause') { startRun('match'); state.toastT = 0; state.hold = 0; openPause(); advance(2); }
  };

  const api = {
    // Watch & Learn, the Collection and every menu are free; only real play counts against the free preview (a paused run does not).
    isPreviewExempt: () => !(state.scene === 'play' && state.run && state.run.mode !== 'watch') || state.paused || state.hold > 0,
    update(dt, input) {
      if (config.dev && globalThis.__slow) dt *= globalThis.__slow;   // QA only: slow motion for frame captures
      if (!wheelHooked && input.onWheel) {
        wheelHooked = true;
        input.onWheel(({ dy }) => {
          const mt = flowMeta();
          if (state.scene === 'rules' || state.scene === 'howto' || state.scene === 'about') state.refScroll = clamp((state.refScroll || 0) + dy, 0, REF.max);
          else if (['title', 'settings', 'result', 'demolimit', 'collection'].includes(state.scene) || state.pauseMenu) state.ui.scroll = clamp(state.ui.scroll + dy, 0, mt.lay ? Math.max(0, mt.lay.contentH - (mt.bottom - mt.top)) : 0);
        });
      }
      syncSize();
      { const o = !!(monetization.owns && monetization.owns('unlock_game')); if (o !== !!state.owned) { state.owned = o; state.rev++; } }
      setPress(input.pointer);
      state.t += state.paused && state.scene === 'play' ? 0 : dt;
      if (state.scene !== 'play') updateAttract(dt);
      switch (state.scene) {
        case 'title': updateFlowScene(dt, input, handleTitle, 'title'); break;
        case 'settings': updateFlowScene(dt, input, handleSettings, 'settings'); break;
        case 'collection': updateCollection(dt, input); break;
        case 'result': updateFlowScene(dt, input, handleResult, 'result'); break;
        case 'demolimit': updateFlowScene(dt, input, (id) => { if (id === 'menu') { state.scene = 'title'; state.ui.scroll = 0; state.rev++; } }, 'demolimit'); break;
        case 'howto': case 'about': case 'rules': updatePages(input); break;
        case 'play': updatePlay(dt, input); break;
        default: break;
      }
    },
    render(ctx) {
      syncSize();
      if (GL.on) ctx.clearRect(0, 0, meta.width, meta.height);
      if (state.scene !== 'play') meta.previewBadge = null;
      switch (state.scene) {
        case 'title': renderTitle(ctx, state); break;
        case 'settings': renderSettings(ctx, state); break;
        case 'collection': renderCollection(ctx, state); break;
        case 'result': renderResult(ctx, state); break;
        case 'demolimit': renderDemoLimit(ctx, state); break;
        case 'howto': renderPages(ctx, state, HOWTO, 'How to Play'); break;
        case 'about': renderPages(ctx, state, aboutList(), 'About'); break;
        case 'rules': renderPages(ctx, state, RULES, 'Rules'); break;
        case 'play':
          if (state.run) renderPlay(ctx, state);
          if (state.pauseMenu) renderPause(ctx, state);
          break;
        default: break;
      }
    },
    getState: () => state,
    // QA / store shots: a perfectly timed throw at the best spot (offset in board units), through the real sim
    qaThrow(dx = 0, dy = 0, wait = 0) {
      const w = state.ws; if (w.aim.down) { w.aim.down = false; w.aim.mt = 0; }
      const a = advise(w); if (!a) return false;
      if (!press(w, a.x + dx, a.y + dy)) return false;
      w.aim.mt = a.tc + wait; return release(w);
    },
    lockupZone: () => lockupZone(),
    shotScene,
  };
  return api;
}

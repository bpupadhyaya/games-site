// Kingyo Sukui: state and flow. Physics live in sim.js; drawing in view.js, art.js and menus.js.
// This is the only file that mutates `state` outside of the simulation step.
//
// Scenes: title, play (session, daily, free, watch), result, collection, settings, howto/about/rules, demolimit.
import {
  FISH, TANKS, GRADES, TW, TH, makeWorld, stepWorld, poiPress, poiMove, poiRelease, advise, newAuto, autoStep, seeded, clamp, fishOwned, tankOwned,
} from './sim.js';
import { TEXT_SCALES, THINK_STEPS, host, W, H, meta, syncSize, refLayout, inRect, tankRect, tankToScreen, toTank } from './layout.js';
import { renderPlay, layoutOf } from './view.js';
import {
  renderTitle, renderSettings, renderResult, renderPause, renderPages, renderDemoLimit, renderCollection,
  hitScreen, flowMeta, REF, ensureLayout, resetMenus, lockupZone, collectionHit,
} from './menus.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import { setPress } from './ui.js';
import { v3 } from './v3.js';

export { meta };
const DEMO_RUNS = 3;
const POI_OFFSET = 92;           // the poi sits this far above the finger (tank units) so the paper stays visible
const KEY_SPEED = 240;           // keyboard poi speed, units per second
const END_DELAY = 1.5;           // seconds the finished tank stays before the result

export function createGame(env) {
  const { rng, audio, storage, config, monetization } = env;
  const fxRng = rng.fork(), runRng = rng.fork(), attRng = rng.fork();
  const state = {
    scene: 'title', back: 'title', t: 0, paused: false, pauseMenu: false, demo: !!config.demo, day: (config.day | 0), rev: 0,
    settings: { sound: true, textIdx: 0, thinkIdx: 1 },
    record: { bestSession: 0, bestByTank: [0, 0, 0, 0], bestDaily: 0, dailyDay: -1, scoops: 0, caughtBy: [0, 0, 0, 0, 0, 0, 0, 0], sessions: 0, tankSel: 0, grade: 1, demoRuns: 0 },
    run: null, ws: null, att: null, simRng: null, hint: null, dec: null, pops: [], banner: null, toast: '', toastT: 0,
    fx: { ripples: [], drops: [], bits: [], flights: [] }, tr: null, kb: { x: TW / 2, y: TH / 2 }, kbDown: false,
    last: null, collSel: null, collBack: 'title', restoreMsg: '', ui: { scroll: 0, drag: null }, refScroll: 0, loaded: false, hold: 0, endT: 0, attN: 0, drag: false,
  };
  syncSize();
  const owns = () => { try { return !!monetization.owns('unlock_game'); } catch { return false; } };
  state.owned = owns();
  monetization.onChange?.(() => { state.owned = owns(); state.rev++; });

  // ---- persistence ----------------------------------------------------------------------------------------------
  const save = () => { storage.set('settings', state.settings); storage.set('record', state.record); };
  Promise.all([storage.get('settings', null), storage.get('record', null)]).then(([s, r]) => {
    if (s) Object.assign(state.settings, s);
    if (r) Object.assign(state.record, r);
    const rec = state.record;
    state.settings.textIdx = clamp(state.settings.textIdx | 0, 0, TEXT_SCALES.length - 1);
    state.settings.thinkIdx = clamp(state.settings.thinkIdx | 0, 0, THINK_STEPS.length - 1);
    if (!Array.isArray(rec.bestByTank) || rec.bestByTank.length < 4) rec.bestByTank = [0, 0, 0, 0];
    if (!Array.isArray(rec.caughtBy) || rec.caughtBy.length < 8) rec.caughtBy = [0, 0, 0, 0, 0, 0, 0, 0];
    rec.tankSel = clamp(rec.tankSel | 0, 0, TANKS.length - 1);
    rec.grade = clamp(rec.grade | 0, 0, GRADES.length - 1);
    if (!tankOwned(rec, rec.tankSel)) rec.tankSel = 0;
    state.loaded = true; state.rev++;
    audio.setMuted?.(!state.settings.sound);
  });

  // ---- sound ----------------------------------------------------------------------------------------------------
  const tone = (o) => { if (state.settings.sound) audio.tone(o); };
  const PENTA = [0, 2, 4, 7, 9];
  const sfx = {
    plop: () => { tone({ freq: 420, to: 150, dur: 0.14, type: 'sine', vol: 0.1 }); tone({ freq: 900, to: 400, dur: 0.07, type: 'triangle', vol: 0.04 }); },
    lift: () => tone({ freq: 220, to: 520, dur: 0.24, type: 'sine', vol: 0.05 }),
    catch: (n) => { const semis = PENTA[n % 5] + 12 * Math.min(1, Math.floor(n / 5)); tone({ freq: 523 * Math.pow(2, semis / 12), dur: 0.2, type: 'sine', vol: 0.11 }); tone({ freq: 1568, to: 1200, dur: 0.07, type: 'triangle', vol: 0.03 }); },
    slip: () => tone({ freq: 700, to: 260, dur: 0.14, type: 'triangle', vol: 0.06 }),
    tear: () => { tone({ freq: 240, to: 60, dur: 0.38, type: 'sawtooth', vol: 0.05 }); tone({ freq: 1800 + fxRng.next() * 500, to: 400, dur: 0.12, type: 'triangle', vol: 0.05 }); },
    tick: () => tone({ freq: 900, dur: 0.035, type: 'triangle', vol: 0.045 }),
    win: () => [0, 4, 7, 12].forEach((n, i) => tone({ freq: 523 * Math.pow(2, n / 12), dur: 0.22 + i * 0.05, type: 'triangle', vol: 0.09 })),
  };
  const toast = (text, secs = 2.8) => { state.toast = text; state.toastT = secs; };

  // ---- effects (drawing only) -------------------------------------------------------------------------------------
  const ripple = (x, y, big = 1) => { const f = state.fx; f.ripples.push({ x, y, t: 0, max: 1.3, r0: 8, sp: 90 * big }); if (f.ripples.length > 24) f.ripples.shift(); };
  const splash = (x, y, n) => {
    for (let i = 0; i < n; i++) { const a = fxRng.next() * Math.PI * 2, s = 40 + fxRng.next() * 140; state.fx.drops.push({ x: x + Math.cos(a) * 20, y: y + Math.sin(a) * 20, vx: Math.cos(a) * s, vy: Math.sin(a) * s, t: 0, max: 0.5 + fxRng.next() * 0.4, r: 3 + fxRng.next() * 4 }); }
    if (state.fx.drops.length > 120) state.fx.drops.splice(0, 40);
  };
  const tearBits = (x, y) => {
    for (let i = 0; i < 16; i++) { const a = fxRng.next() * Math.PI * 2, s = 60 + fxRng.next() * 180; state.fx.bits.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, rot: fxRng.next() * 6, vr: (fxRng.next() - 0.5) * 8, t: 0, max: 1 + fxRng.next() * 0.6 }); }
  };
  const stepFx = (dt) => {
    const f = state.fx;
    for (const r of f.ripples) r.t += dt;
    f.ripples = f.ripples.filter((r) => r.t < r.max);
    for (const d of f.drops) { d.t += dt; d.x += d.vx * dt; d.y += d.vy * dt; d.vx *= 0.96; d.vy *= 0.96; }
    f.drops = f.drops.filter((d) => d.t < d.max);
    for (const b of f.bits) { b.t += dt; b.x += b.vx * dt; b.y += b.vy * dt; b.rot += b.vr * dt; b.vx *= 0.97; b.vy *= 0.97; }
    f.bits = f.bits.filter((b) => b.t < b.max);
    for (const fl of f.flights) fl.t += dt;
    f.flights = f.flights.filter((fl) => fl.t < fl.max);
    for (const p of state.pops) p.t += dt;
    state.pops = state.pops.filter((p) => p.t < p.max);
    if (state.toastT > 0) state.toastT -= dt;
    if (state.banner) { state.banner.t += dt; if (state.banner.t >= state.banner.max) state.banner = null; }
  };
  const pop = (text, x, y, col = '#fff', size = 1) => { if (state.pops.length < 8) state.pops.push({ text, x, y, col, size, t: 0, max: 1.1 }); };

  // ---- the title-screen demo: a tank where goldfish drift --------------------------------------------------------------------
  const newAttract = () => { const tank = state.attN++ % TANKS.length; state.att = makeWorld({ tank, grade: 1, rng: attRng, owned: null }); };
  const updateAttract = (dt) => { if (!state.att) newAttract(); stepWorld(state.att, dt, attRng); state.att.ev.length = 0; };

  // ---- runs ---------------------------------------------------------------------------------------------------------
  const ownedList = () => FISH.map((_, i) => fishOwned(state.record, i));
  const ownedNow = () => ({ fish: FISH.map((_, i) => fishOwned(state.record, i)), tanks: TANKS.map((_, i) => tankOwned(state.record, i)) });
  const startRun = (mode) => {
    const rec = state.record;
    if (state.demo && mode !== 'watch' && rec.demoRuns >= DEMO_RUNS) { state.scene = 'demolimit'; state.ui.scroll = 0; state.rev++; return; }
    const daily = mode === 'daily', tank = daily ? state.day % TANKS.length : rec.tankSel;
    const grade = daily ? 1 : rec.grade;
    const r = daily ? seeded(state.day * 977 + 5) : runRng;
    state.simRng = r;
    state.ws = makeWorld({ tank, grade, rng: r, owned: daily ? null : ownedList(), endless: mode === 'free', release: mode === 'free' || mode === 'watch' });
    if (mode === 'watch') state.ws.goal = state.ws.fish.length;
    state.run = { mode, tank, grade, hints: 0, before: ownedNow() };
    state.scene = 'play'; state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; state.last = null;
    state.hint = null; state.dec = null; state.pops.length = 0; state.banner = null; state.endT = 0; state.hold = 0.4; state.drag = false; state.kbDown = false;
    state.fx = { ripples: [], drops: [], bits: [], flights: [] };
    state.kb = { x: TW / 2, y: TH / 2 };
    if (state.demo && mode !== 'watch') { rec.demoRuns++; save(); }
    if (mode === 'watch') state.dec = { phase: 'think', t: 0, dur: THINK_STEPS[state.settings.thinkIdx], adv: null, why: '', ap: newAuto(), went: false };
    toast(mode === 'watch' ? 'Watch & Learn: the game thinks before every scoop' : 'Press on the water, slide under a fish, let go to lift', 3.6);
  };
  const finishRun = () => {
    const w = state.ws, run = state.run, rec = state.record, mode = run.mode;
    const r = {
      mode, total: w.score, fish: w.caught.slice(), sheets: Math.max(1, Math.min(w.sheets, w.sheetNo + (w.sheetNo < w.sheets ? 1 : 0))), torn: w.torn, bestScoop: w.bestScoop,
      hints: run.hints, newBest: false, unlocks: [], cleared: !w.endless && w.fish.length === 0, tank: run.tank,
    };
    if (mode !== 'watch') {
      rec.scoops += w.caught.length;
      for (const k of w.caught) rec.caughtBy[k]++;
      if (mode !== 'free') {
        rec.sessions++;
        if (!run.hints) {
          if (mode === 'session') {
            if (w.score > rec.bestByTank[run.tank]) { rec.bestByTank[run.tank] = w.score; r.newBest = w.score > 0; }
            if (w.score > rec.bestSession) rec.bestSession = w.score;
          } else if (mode === 'daily') {
            if (rec.dailyDay !== state.day) { rec.dailyDay = state.day; rec.bestDaily = 0; }
            if (w.score > rec.bestDaily) { rec.bestDaily = w.score; r.newBest = w.score > 0; }
          }
        }
      }
      const now = ownedNow();
      FISH.forEach((f, i) => { if (!run.before.fish[i] && now.fish[i]) r.unlocks.push(f.name); });
      TANKS.forEach((t, i) => { if (!run.before.tanks[i] && now.tanks[i]) r.unlocks.push(t.name); });
      save();
    }
    state.last = r; state.scene = 'result'; state.ui.scroll = 0; state.paused = false; state.pauseMenu = false; state.hint = null; state.dec = null; state.rev++;
    if (r.newBest || r.unlocks.length) sfx.win();
  };

  // react to what the sim reported this tick
  const handleEvents = () => {
    const w = state.ws, tr = state.tr;
    for (const e of w.ev) {
      if (e.type === 'entry') { ripple(e.x, e.y, 1); ripple(e.x, e.y, 0.6); splash(e.x, e.y, 8); sfx.plop(); state.hint = null; }
      else if (e.type === 'catch') {
        sfx.catch(Math.max(0, w.streak - 1)); ripple(e.x, e.y, 0.8); splash(e.x, e.y, 10);
        pop(`+${e.pts}`, e.x, e.y, w.streak > 2 ? '#ffd97a' : '#ffffff', 1 + Math.min(0.5, FISH[e.k].pts * 0.06));
        if (tr && !w.release) { const sp = tankToScreen(tr, e.x, e.y); state.fx.flights.push({ k: e.k, x0: sp.x, y0: sp.y, t: 0, max: 0.75 }); }
      } else if (e.type === 'release') { ripple(e.x, e.y, 0.7); ripple(e.x, e.y, 0.4); splash(e.x, e.y, 5); sfx.plop(); }
      else if (e.type === 'slip') { sfx.slip(); splash(e.x, e.y, 4); pop('slipped', e.x, e.y, '#ffb09a', 0.7); }
      else if (e.type === 'empty') { ripple(e.x, e.y, 0.5); sfx.lift(); }
      else if (e.type === 'tear') {
        tearBits(e.x, e.y); sfx.tear(); splash(e.x, e.y, 6);
        state.banner = { text: e.why === 'spent' ? 'Spent' : 'Torn!', sub: w.over ? 'That was the last sheet' : 'A fresh sheet is ready', col: '#ff9a7a', t: 0, max: 1.6 };
      }
    }
    w.ev.length = 0;
  };

  // ---- the Watch & Learn loop: THINK -> REVEAL -> ACT --------------------------------------------------------------------
  const updateWatch = (dt) => {
    const dec = state.dec, w = state.ws;
    if (!dec || w.over) return;
    dec.t += dt;
    const rethink = () => { dec.phase = 'think'; dec.t = 0; dec.dur = THINK_STEPS[state.settings.thinkIdx]; dec.ap.pref = null; };
    if (dec.phase === 'think') {
      if (dec.t >= dec.dur && w.poi.hold <= 0) {
        const adv = advise(w);
        if (!adv) return;
        dec.phase = 'reveal'; dec.t = 0; dec.dur = 2; dec.adv = adv; dec.why = adv.why; state.hint = adv;
      }
    } else if (dec.phase === 'reveal') {
      if (dec.t >= dec.dur) { dec.phase = 'go'; dec.t = 0; dec.went = false; dec.ap.pref = dec.adv.id; dec.ap.cool = 0.2; state.hint = null; }
    } else if (dec.phase === 'go') {
      autoStep(w, dec.ap, state.simRng, dt);
      if (w.poi.down) dec.went = true;
      if (dec.went && !w.poi.down) rethink();
      else if (dec.t > 14 && !w.poi.down) rethink();
    }
  };

  // ---- hint -------------------------------------------------------------------------------------------------------------
  const requestThink = () => {
    const run = state.run;
    if (!run || state.paused || run.mode === 'watch' || state.ws.over) return;
    if (state.hint) { state.hint = null; sfx.tick(); return; }
    const adv = advise(state.ws);
    if (!adv) return;
    state.hint = adv;
    if (run.mode !== 'free') run.hints++;
    sfx.tick();
  };

  // ---- pause ------------------------------------------------------------------------------------------------------------
  const openPause = () => { state.paused = true; state.pauseMenu = true; state.ui.scroll = 0; state.rev++; };
  const closePause = () => { state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; state.rev++; };
  const leaveRun = () => { state.scene = 'title'; state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; state.hint = null; state.dec = null; state.rev++; };

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
  // Put the kit's "Preview m:ss" pill where it covers no HUD control and not the tank: first free of stage-top, stage-bottom,
  // then the top-left corner of the stage (over the tank's rim padding only).
  const placeBadge = (L, tr) => {
    const k = host.px > 0 ? host.px : 0.5, fs = Math.max(16, 11.5 / k), ph = fs * 1.7, pw = fs * 8.6, st = L.stage, g = 6;
    const hud = [L.pause, L.think, L.score, L.gauge, L.bowl, L.demo && L.demo.dec, L.demo && L.demo.pause, L.demo && L.demo.inc, L.demo && L.demo.exit].filter(Boolean);
    const free = (x, y) => x >= 0 && x + pw <= W && y >= 0 && y + ph <= H
      && !hud.some((r) => x < r.x + r.w + 2 && x + pw > r.x - 2 && y < r.y + r.h + 2 && y + ph > r.y - 2)
      && !(x < tr.x + tr.w && x + pw > tr.x && y < tr.y + tr.h && y + ph > tr.y);
    const cx = st.x + st.w / 2 - pw / 2;
    const cands = [[cx, st.y + g], [cx, st.y + st.h - ph - g], [st.x + g, st.y + g], [st.x + st.w - pw - g, st.y + g], [st.x + g, st.y + st.h - ph - g]];
    const hit = cands.find(([x, y]) => free(x, y)) || [st.x + g, st.y + g];
    meta.previewBadge = { x: hit[0], y: hit[1], align: 'left' };
  };
  const toPoint = (ptr) => toTank(state.tr, ptr.x, ptr.y - POI_OFFSET * state.tr.s);
  const lift = () => { sfx.lift(); poiRelease(state.ws, state.simRng); };
  const updatePlay = (dt, input) => {
    const run = state.run, w = state.ws, ptr = input.pointer, keys = input.keys, watch = run.mode === 'watch', P = w.poi;
    const L = layoutOf(state);
    state.tr = tankRect(L.stage);
    placeBadge(L, state.tr);
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
      if (ptr.pressed) {
        if (inRect(L.pause, ptr.x, ptr.y)) { openPause(); return; }
        if (inRect(L.think, ptr.x, ptr.y)) requestThink();
        else if (state.hold <= 0 && inRect({ x: L.stage.x, y: L.stage.y, w: L.stage.w, h: L.stage.h + (state.tr ? 100 * state.tr.s : 0) }, ptr.x, ptr.y)) { // the finger rides below the poi, so a dip near the tank's lower edge may start over the bowl panel
          const p = toPoint(ptr);
          if (poiPress(w, p.x, p.y)) state.drag = true;
        }
      }
      if (state.drag) {
        if (P.down && ptr.down) { const p = toPoint(ptr); poiMove(w, p.x, p.y); }
        if (!ptr.down || ptr.released) { state.drag = false; if (P.down) lift(); }
      } else {
        // keyboard: arrows move, Space dips (hold) and lifts (release)
        const kx = (keys.down.has('ArrowRight') || keys.down.has('KeyD') ? 1 : 0) - (keys.down.has('ArrowLeft') || keys.down.has('KeyA') ? 1 : 0);
        const ky = (keys.down.has('ArrowDown') || keys.down.has('KeyS') ? 1 : 0) - (keys.down.has('ArrowUp') || keys.down.has('KeyW') ? 1 : 0);
        const kb = state.kb;
        if (!P.down && !P.lift && P.hold <= 0 && !state.kbDown) { kb.x = P.x; kb.y = P.y; }
        if (kx || ky) {
          kb.x = clamp(kb.x + kx * KEY_SPEED * dt, 0, TW); kb.y = clamp(kb.y + ky * KEY_SPEED * dt, 0, TH);
          if (!P.down && !P.lift && P.hold <= 0) { P.x = kb.x; P.y = kb.y; }
        }
        if (keys.pressed.has('Space') && !P.down && state.hold <= 0) { if (poiPress(w, kb.x, kb.y)) state.kbDown = true; }
        if (P.down && state.kbDown) {
          poiMove(w, kb.x, kb.y);
          if (!keys.down.has('Space')) { state.kbDown = false; lift(); }
        } else if (!P.down) state.kbDown = false;
      }
      if (keys.pressed.has('KeyH')) requestThink();
    }
    if (state.paused) return;
    // ---- time passes
    if (state.hold > 0) state.hold = Math.max(0, state.hold - dt);
    if (watch) updateWatch(dt);
    stepWorld(w, dt, state.simRng);
    handleEvents();
    stepFx(dt);
    if (w.over && !P.lift) {
      if (state.endT === 0) {
        state.banner = state.banner || { text: w.fish.length === 0 && !w.endless ? 'Tank cleared!' : 'Session over', sub: `${w.score} points`, col: '#ffd97a', t: 0, max: END_DELAY };
        if (!watch) sfx.win();
      }
      state.endT += dt;
      if (state.endT >= END_DELAY) finishRun();
    }
  };

  // ---- menus ----------------------------------------------------------------------------------------------------------------
  const handleTitle = (id) => {
    if (!id) return;
    if (id === 'arcforge') { env.openArcforgeHome?.(); return; }
    sfx.tick();
    const rec = state.record;
    if (id === 'session' || id === 'daily' || id === 'free' || id === 'watch') startRun(id);
    else if (id === 'tank') { let n = rec.tankSel; for (let i = 0; i < TANKS.length; i++) { n = (n + 1) % TANKS.length; if (tankOwned(rec, n)) break; } rec.tankSel = n; save(); state.rev++; }
    else if (id === 'grade') { rec.grade = (rec.grade + 1) % GRADES.length; save(); state.rev++; }
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
      if (state.restoreBusy || owns()) { state.rev++; return; }
      state.restoreBusy = true; state.restoreMsg = 'Checking with the store…';
      const done = (msg) => { state.restoreBusy = false; state.restoreMsg = msg; state.rev++; };
      Promise.resolve().then(() => monetization.restore()).then(() => done(owns() ? 'Purchase restored. Thank you!' : 'No previous purchase found for this store account.'))
        .catch(() => done('The store is not available right now. Please try again later.'));
    } else if (id === 'back') { state.scene = 'title'; state.ui.scroll = 0; state.restoreMsg = ''; }
    state.rev++; save();
  };
  const handleResult = (id) => {
    if (!id) return;
    sfx.tick();
    const r = state.last;
    if (id === 'again') startRun(r ? r.mode : 'session');
    else if (id === 'menu') { state.scene = 'title'; state.ui.scroll = 0; state.rev++; }
    else if (id === 'collection') { state.collBack = 'result'; state.collSel = null; state.scene = 'collection'; state.ui.scroll = 0; state.rev++; }
    else if (id === 'share' && r) { Promise.resolve(env.share?.(`I scooped ${r.total} points of goldfish in one Kingyo Sukui session in Arcforge!`)).catch(() => {}); }
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
          if (h.kind === 't' && same && tankOwned(rec, h.i) && rec.tankSel !== h.i) { rec.tankSel = h.i; save(); sfx.win(); } else sfx.tick();
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
  for (let i = 0; i < 60 * 2; i++) updateAttract(1 / 60);

  // Store screenshots (main.js calls this only for ?shot=1&scene=...): put the game in a named moment and run it forward.
  const IDLE = { pointer: { x: -1, y: -1, down: false, pressed: false, released: false }, keys: { down: new Set(), pressed: new Set() } };
  const advance = (n) => { for (let i = 0; i < n; i++) api.update(1 / 60, IDLE); };
  const shotScene = (name) => {
    const rec = state.record;
    rec.bestSession = 62; rec.bestDaily = 34; rec.bestByTank = [62, 48, 0, 0]; rec.dailyDay = state.day; rec.scoops = 120; rec.sessions = 24; rec.caughtBy = [30, 28, 20, 14, 10, 8, 5, 5];
    state.loaded = true; state.rev++;
    advance(10);
    if (name === 'title') { advance(240); return; }
    if (name === 'play' || name === 'think') {
      rec.tankSel = 1; startRun('session'); state.toastT = 0; state.hold = 0; advance(200);
      if (name === 'think') requestThink();
      return;
    }
    if (name === 'lift' || name === 'catch') {
      rec.tankSel = 0; startRun('session'); state.toastT = 0; state.hold = 0; advance(90);
      const w = state.ws, f = w.fish.slice().sort((a, b) => FISH[b.k].pts - FISH[a.k].pts)[0];
      f.rest = 3; f.s = 1; f.tt = 5; advance(2);
      poiPress(w, f.x, f.y); advance(4); poiRelease(w, state.simRng); handleEvents(); advance(14);
      return;
    }
    if (name === 'tear') {
      rec.tankSel = 2; startRun('session'); state.toastT = 0; state.hold = 0; advance(120);
      const w = state.ws; poiPress(w, TW * 0.5, TH * 0.5); w.poi.paper = 0.015; advance(5);
      return;
    }
    if (name === 'collection') { state.scene = 'collection'; state.collBack = 'title'; state.collSel = { kind: 'f', i: 4 }; state.rev++; advance(2); return; }
    if (name === 'rules' || name === 'howto' || name === 'about') { state.back = 'title'; state.scene = name; state.refScroll = 0; advance(2); return; }
    if (name === 'settings') { state.scene = 'settings'; state.rev++; advance(2); return; }
    if (name === 'result') {
      // a real session played by the autopilot on a fixed seed, then the real result screen
      rec.tankSel = 1; startRun('session'); state.toastT = 0; state.hold = 0;
      const w = state.ws, ap = newAuto();
      for (let i = 0; i < 60 * 240 && !w.over; i++) { autoStep(w, ap, state.simRng, 1 / 60); stepWorld(w, 1 / 60, state.simRng); handleEvents(); }
      finishRun(); advance(3); return;
    }
    if (name === 'watch') {
      rec.tankSel = 1; state.settings.thinkIdx = 0;
      startRun('watch'); state.toastT = 0; state.hold = 0;
      for (let i = 0; i < 60 * 14 && !(state.dec && state.dec.phase === 'reveal' && state.dec.t > 0.8); i++) advance(1);
      return;
    }
    if (name === 'pause') { startRun('session'); state.toastT = 0; state.hold = 0; openPause(); advance(2); }
  };

  const api = {
    // Watch & Learn, the Collection and every menu are free; only real play counts against the free preview (a paused run does not).
    isPreviewExempt: () => !(state.scene === 'play' && state.run && state.run.mode !== 'watch') || state.paused || state.hold > 0 || !!(state.ws && state.ws.over),
    update(dt, input) {
      if (!wheelHooked && input.onWheel) {
        wheelHooked = true;
        input.onWheel(({ dy }) => {
          const mt = flowMeta();
          if (state.scene === 'rules' || state.scene === 'howto' || state.scene === 'about') state.refScroll = clamp((state.refScroll || 0) + dy, 0, REF.max);
          else if (['title', 'settings', 'result', 'demolimit', 'collection'].includes(state.scene) || state.pauseMenu) state.ui.scroll = clamp(state.ui.scroll + dy, 0, mt.lay ? Math.max(0, mt.lay.contentH - (mt.bottom - mt.top)) : 0);
        });
      }
      syncSize();
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
      if (v3.on) ctx.clearRect(0, 0, W, H);   // transparent canvas over the 3D scene: never accumulate scrims
      switch (state.scene) {
        case 'title': renderTitle(ctx, state); break;
        case 'settings': renderSettings(ctx, state); break;
        case 'collection': renderCollection(ctx, state); break;
        case 'result': renderResult(ctx, state); break;
        case 'demolimit': renderDemoLimit(ctx, state); break;
        case 'howto': renderPages(ctx, state, HOWTO, 'How to Play'); break;
        case 'about': renderPages(ctx, state, ABOUT, 'About'); break;
        case 'rules': renderPages(ctx, state, RULES, 'Rules'); break;
        case 'play':
          if (state.run) renderPlay(ctx, state);
          if (state.pauseMenu) renderPause(ctx, state);
          break;
        default: break;
      }
    },
    getState: () => state,
    lockupZone: () => lockupZone(),
    shotScene,
  };
  return api;
}

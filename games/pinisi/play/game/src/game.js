// Pinisi: state and flow. Drawing is in view.js / docview.js; the rules engine is engine.js (pure, seeded by hashing).
//
// Time model: everything runs on the dt handed to update() (deterministic, pausable). The game is turn based: the only
// animated clocks are the shipyard marker, the one-second sea day, and the Watch and Learn think/reveal timers.
import {
  TUNE, GOODS, PORTS, SIZES, TIMBERS, RIGS, MODES, SETTINGS, SET_NAME, CLASS_NAME,
  newVoyage, buy, sell, sellAll, repair, upgradeHold, upgradeSail, waitDay, depart, sailDay, finalSale, rankIndex,
  routeDist, windAt, windClass, planTrip, bestSetting, holdFree, pointName, hash,
  newTask, stepTask, tapTask, taskQuality, buildCost, dayRun, sellValue,
} from './engine.js';
import { layoutFor, inRect, TEXT_SCALES, menuRects, portPanel, seaPanel, mapXform } from './layout.js';
import { burst, stepParticles } from './art.js';
import { ui, docMetrics } from './docview.js';
import { press } from './ui.js';
import { render } from './view.js';
import { RULES } from './content.js';

export const meta = { width: 720, height: 1560, fluid: { short: 720 }, previewBadge: null };
const DEMO_RUNS = 2;
const DAY_ANIM = 0.9;                  // seconds a sea day takes on screen
const AUTO_LEGS = 3;                   // the Watch and Learn lesson ends after this many arrivals
const AI_REVEAL = 2;
const LOTS = [1, 5, Infinity];
const seedOf = (rng) => rng.int(1000000000) + 1;

export function createGame(env) {
  const { rng, storage, config } = env;
  const state = {
    scene: 'title', sceneT: 0, t: 0, backTo: 'title',
    prefs: { sound: true, calm: false, thinkSec: 5, textIdx: 0 },
    best: { quick: 0, monsoon: 0, voyages: 0 }, demoRuns: 0, saved: null,
    setupSel: { mode: 'quick', month: 11 },
    yard: { size: 'pinisi', timber: 'teak', rig: 'balanced', phase: 'choose', task: null, bShown: 0, rigT: 0, flash: null },
    pl: null, result: null,
    rulesPage: 0, docScroll: 0, docFrac: 0, docRescale: false, docKey: 'about',
    restoreMsg: '', restoreBusy: false, toast: null, dev: config.dev === true, demo: config.demo === true,
  };
  let lastScene = state.scene, drag = null, vdrag = null;
  const later = [];                                            // tiny delayed callbacks counted in dt

  storage.get('prefs', null).then((v) => { if (v) { Object.assign(state.prefs, v); state.prefs.textIdx = Math.min(Math.max(state.prefs.textIdx | 0, 0), TEXT_SCALES.length - 1); state.prefs.thinkSec = Math.min(10, Math.max(1, state.prefs.thinkSec | 0)); applyPrefs(); } });
  storage.get('best', null).then((v) => { if (v) Object.assign(state.best, v); });
  storage.get('demoRuns', 0).then((v) => { state.demoRuns = Math.max(state.demoRuns, v); });
  storage.get('voy', null).then((v) => { if (v && v.v && !v.v.over) state.saved = { v: v.v, line: v.line || 'Voyage in progress' }; });
  const savePrefs = () => { storage.set('prefs', state.prefs); applyPrefs(); };
  function applyPrefs() { env.audio.setMuted?.(!state.prefs.sound); config.textScale = TEXT_SCALES[state.prefs.textIdx]; }
  applyPrefs();
  const lay = () => layoutFor(meta.width, meta.height);
  const tone = (o) => { if (state.prefs.sound) env.audio.tone(o); };
  const go = (scene) => { state.scene = scene; if (scene !== 'voyage' && scene !== 'result' && !(state.pl && state.pl.paused && scene === 'rules')) state.pl = null; };
  const toast = (text, hold = 1.8) => { state.toast = { text, t: 0, hold }; };

  // ---- the yard ------------------------------------------------------------------------------------------------------------------
  function openYard() {
    const y = state.yard; y.phase = 'choose'; y.task = null; y.bShown = 0; y.rigT = 0; y.flash = null;
    state.scene = 'yard'; state.sceneT = 0;
  }
  function startFitting() {
    const y = state.yard, M = MODES[state.setupSel.mode];
    if (M.coins - buildCost(y) < 150) { toast('Choose cheaper parts: you need coins left for cargo.'); return; }
    y.phase = 'fit'; y.task = newTask(seedOf(rng)); y.bShown = 0; y.rigT = 0; y.flash = null;
    tone({ freq: 180, to: 130, dur: 0.14, type: 'triangle', vol: 0.2 });
  }
  function tapPlank() {
    const y = state.yard; if (y.phase !== 'fit' || !y.task) return;
    const r = tapTask(y.task); if (!r) return;
    const col = r.grade === 'perfect' ? '#ffe9a0' : r.grade === 'good' ? '#9fe3d8' : '#ff9a82';
    y.flash = { text: r.grade === 'perfect' ? 'PERFECT FIT' : r.grade === 'good' ? 'GOOD FIT' : 'ROUGH FIT', col, t: 0 };
    tone({ freq: r.grade === 'rough' ? 150 : 240, to: r.grade === 'rough' ? 100 : 160, dur: 0.12, type: 'triangle', vol: 0.25 });
    if (r.grade === 'perfect') later.push({ t: 0.08, fn: () => tone({ freq: 880, dur: 0.2, type: 'sine', vol: 0.1 }) });
    if (y.task.done) y.phase = 'done';
  }
  function updateYard(dt, tap, input) {
    const Y = lay().yard, y = state.yard;
    if (y.flash) { y.flash.t += dt; if (y.flash.t > 1.1) y.flash = null; }
    if (y.phase === 'fit' || y.phase === 'done') {
      if (y.task) { stepTask(y.task, dt); const target = y.task.res.length; if (y.bShown < target) y.bShown = Math.min(target, y.bShown + dt * 4); }
      if (y.phase === 'done' && y.bShown >= TUNE.planks) y.rigT = Math.min(1, y.rigT + dt * 0.9);
    }
    if (input.keys.pressed.has('Escape')) { if (y.phase === 'choose') go('setup'); else { y.phase = 'choose'; y.task = null; y.bShown = 0; } return; }
    if (y.phase === 'fit' && (input.keys.pressed.has('Space') || input.keys.pressed.has('Enter'))) { tapPlank(); return; }
    if (!tap) return;
    if (inRect(Y.back, tap.x, tap.y)) { if (y.phase === 'choose') go('setup'); else { y.phase = 'choose'; y.task = null; y.bShown = 0; } return; }
    if (y.phase === 'choose') {
      const keys = [['size', SIZES], ['timber', TIMBERS], ['rig', RIGS]];
      keys.forEach(([k, data], gi) => Y.groups[gi].cards.forEach((r, j) => { if (inRect(r, tap.x, tap.y)) { y[k] = Object.keys(data)[j]; tone({ freq: 420, dur: 0.06, type: 'triangle', vol: 0.12 }); } }));
      if (inRect(Y.go, tap.x, tap.y)) startFitting();
    } else if (y.phase === 'fit') {
      if (inRect(Y.task.tap, tap.x, tap.y) || inRect(Y.task.bar, tap.x, tap.y)) tapPlank();
    } else if (y.phase === 'done' && y.rigT >= 1 && inRect(Y.go, tap.x, tap.y)) launch();
  }
  function launch() {
    const y = state.yard, S = state.setupSel;
    if (config.demo && state.demoRuns >= DEMO_RUNS) { go('demo-limit'); return; }
    if (config.demo) { state.demoRuns += 1; storage.set('demoRuns', state.demoRuns); }
    const v = newVoyage({ seed: y.task.seed, mode: S.mode, startMonth: S.mode === 'quick' ? 11 : S.month, build: { size: y.size, timber: y.timber, rig: y.rig }, quality: taskQuality(y.task) });
    startPlay('play', v);
  }

  // ---- a play session -------------------------------------------------------------------------------------------------------------
  function newPlay(mode, v) {
    const leg = v.sea ? { from: v.sea.from, to: v.sea.to, dist: v.sea.dist } : null;
    return {
      mode, v, paused: false, over: false, parts: [], pops: [], banner: null, sel: null, lot: 0, scroll: 0, listMax: 0, yardOpen: false, yardRects: [],
      hold: true, lastSetting: 'full', holdClass: '', leg, dispProg: v.sea ? v.sea.progress : 0, anim: null, hint: null, hintT: 0, legsDone: 0, autoDone: false,
      ai: mode === 'auto' ? { phase: 'run', t: 0, text: '', think: '', reveal: '', plan: null, lastClass: '', waited: 0 } : null,
    };
  }
  function startPlay(mode, v) {
    state.pl = newPlay(mode, v); state.result = null;
    state.scene = 'voyage'; state.sceneT = 0;
    state.pl.banner = { text: mode === 'auto' ? 'WATCH AND LEARN' : v.sea ? 'WELCOME BACK' : MODES[v.mode].name.toUpperCase(), sub: `${PORTS[v.loc].name}, day ${v.day + 1}`, t: 0 };
    env.monetization.track?.('voyage_start', { mode: v.mode, auto: mode === 'auto' });
    if (mode === 'play') saveVoyage();
  }
  function startAuto() {
    const v = newVoyage({ seed: seedOf(rng), mode: 'quick', startMonth: 11, build: { size: 'pinisi', timber: 'teak', rig: 'balanced' }, quality: 0.8 });
    startPlay('auto', v);
  }
  function continueSaved() {
    if (!state.saved) return;
    startPlay('play', JSON.parse(JSON.stringify(state.saved.v)));
  }
  function saveVoyage() {
    const pl = state.pl; if (!pl || pl.mode !== 'play' || pl.v.over) return;
    const v = pl.v, where = v.at === 'port' ? PORTS[v.loc].name : `at sea to ${PORTS[v.sea.to].name}`;
    const line = `Day ${Math.min(v.day + 1, v.endDay)} of ${v.endDay}, ${where}`;
    state.saved = { v, line };
    storage.set('voy', { v, line });
  }
  const pausePlay = () => { const pl = state.pl; if (pl && !pl.paused && !pl.over && state.scene === 'voyage') pl.paused = true; };
  const resumePlay = () => { if (state.pl) state.pl.paused = false; };
  const pop = (pl, text, col, x, y, size = 30) => { pl.pops.push({ text, col, x, y, size, age: 0 }); if (pl.pops.length > 6) pl.pops.shift(); };

  function finishRun(demoDone) {
    const pl = state.pl, v = pl.v, f = finalSale(v), rank = rankIndex(v, f.score), old = state.best;
    const res = {
      mode: pl.mode, voyageMode: v.mode, score: f.score, coins: f.coins, cargo: f.cargo, hull: f.hull, net: f.net, days: v.day, legs: v.stats.legs, damage: v.stats.damage,
      rank, newBest: false, sunk: v.reason === 'sunk', demoDone: !!demoDone,
      build: `${SIZES[v.ship.size].name}, ${TIMBERS[v.ship.timber].name}, ${RIGS[v.ship.rig].name}`, q: v.ship.q,
    };
    if (pl.mode === 'play') {
      res.newBest = f.score > (old[v.mode] || 0);
      state.best = { ...old, [v.mode]: Math.max(old[v.mode] || 0, f.score), voyages: old.voyages + 1 };
      storage.set('best', state.best);
      state.saved = null; storage.set('voy', null);
    }
    env.monetization.track?.('voyage_end', { mode: v.mode, score: f.score, rank });
    pl.over = true; state.result = res; state.scene = 'result'; state.sceneT = 0;
    [523, 659, 784, 1046].forEach((fq, i) => later.push({ t: i * 0.12, fn: () => tone({ freq: fq, dur: 0.3, type: 'triangle', vol: 0.14 }) }));
  }

  // ---- geometry helpers for hit tests -----------------------------------------------------------------------------------------------
  const pauseRect = (L) => { const H = L.voy.hud, pw = H.h - 12; return { x: H.x + H.w - pw - 6, y: H.y + 6, w: pw, h: H.h - 12 }; };
  function portAt(x, y) {
    const L = lay(), X = mapXform(L.voy.map, 0.07);
    let best = -1, bd = 1e9;
    PORTS.forEach((p, i) => { const q = X.to(p.x, p.y), d = Math.hypot(q.x - x, q.y - y), rad = Math.max(44, p.r * X.s * 1.6); if (d < rad && d < bd) { bd = d; best = i; } });
    return best;
  }
  const lotN = (pl) => LOTS[pl.lot];

  // ---- port actions (player) ----------------------------------------------------------------------------------------------------------
  function doBuy(pl, g) {
    const v = pl.v, r = buy(v, g, lotN(pl)), L = lay(), P = L.voy.panel;
    if (!r.n) { pop(pl, holdFree(v) <= 0 ? 'Hold full' : 'Not enough coins', '#ff9a82', P.x + P.w / 2, P.y + 140, 28); return; }
    tone({ freq: 640, to: 520, dur: 0.1, type: 'triangle', vol: 0.15 });
    const M = L.voy.map;
    burst(pl.parts, rng, M.x + M.w * 0.5, M.y + M.h * 0.5, 'coin', Math.min(6, r.n + 1), 0.5, '#f2c65a', 11);
    pop(pl, `-${r.cost}`, '#ffb199', P.x + P.w * 0.4, P.y + 90, 30);
    pl.hint = null; saveVoyage();
  }
  function doSell(pl, g) {
    const v = pl.v, r = sell(v, g, lotN(pl));
    if (!r.n) return;
    tone({ freq: 880, to: 1175, dur: 0.14, type: 'triangle', vol: 0.18 });
    const L = lay(), P = L.voy.panel;
    burst(pl.parts, rng, L.voy.hud.x + 120, L.voy.hud.y + 30, 'coin', Math.min(8, r.n + 2), 0.7, '#ffe27a', 12);
    pop(pl, `+${r.cost}`, '#ffe27a', P.x + P.w * 0.7, P.y + 90, 32);
    pl.hint = null; saveVoyage();
  }
  function setSail(pl) {
    const v = pl.v;
    if (pl.sel === null || !depart(v, pl.sel)) return;
    pl.leg = { from: v.sea.from, to: v.sea.to, dist: v.sea.dist }; pl.dispProg = 0; pl.anim = null; pl.hint = null; pl.lastSetting = 'full'; pl.holdClass = ''; pl.yardOpen = false;
    pl.banner = { text: `To ${PORTS[v.sea.to].name}`, sub: `${v.sea.dist} nm`, t: 0 };
    tone({ freq: 196, to: 262, dur: 0.4, type: 'sine', vol: 0.14 });
    saveVoyage();
  }
  function think(pl) {
    const v = pl.v; if (pl.mode === 'auto' || pl.over) return;
    if (v.at === 'port') {
      const opts = planTrip(v), o = opts[0];
      if (!o) { pl.hint = { kind: 'route', text: 'No route from here.' }; return; }
      const goods = o.load.map((n, g) => (n ? `${n} ${GOODS[g].name.toLowerCase()}` : '')).filter(Boolean).slice(0, 3).join(', ');
      pl.sel = o.to; pl.hint = { kind: 'route', to: o.to, text: `${PORTS[o.to].name}: carry ${goods || 'nothing worth the trip'}. About ${o.days} ${o.days === 1 ? 'day' : 'days'}, +${Math.max(0, o.net)} coins.` };
    } else {
      const b = bestSetting(v); pl.hint = { kind: 'setting', setting: b.setting, text: `${SET_NAME[b.setting]}. ${b.why}` };
    }
    pl.hintT = 0;
    tone({ freq: 330, to: 440, dur: 0.25, type: 'sine', vol: 0.1 });
  }

  // ---- sea days ----------------------------------------------------------------------------------------------------------------------
  function doDay(pl, setting) {
    const v = pl.v; if (!v.sea || pl.anim || v.over) return;
    const w = windAt(v), p0 = v.sea.progress;
    pl.lastSetting = setting; pl.holdClass = windClass(w.str); pl.hint = null;
    const ev = sailDay(v, setting);
    if (!ev) return;
    pl.anim = { p0, p1: ev.arrived ? pl.leg.dist : v.sea ? v.sea.progress : pl.leg.dist, t: 0, ev };
    tone(setting === 'anchor' ? { freq: 120, to: 100, dur: 0.2, type: 'sine', vol: 0.1 } : { freq: 170, to: 230, dur: 0.5, type: 'sine', vol: 0.09 });
    if (ev.dmg > 0) {
      tone({ freq: 140, to: 70, dur: 0.3, type: 'sawtooth', vol: 0.14 });
      const M = lay().voy.map; pop(pl, `Hull -${ev.dmg}`, '#ff9a82', M.x + M.w * 0.5, M.y + M.h * 0.55, 34);
      if (!state.prefs.calm) burst(pl.parts, rng, M.x + M.w * 0.5, M.y + M.h * 0.5, 'puff', 8, 0.5, '#e8f6f2', 10);
    }
    saveVoyage();
  }
  function stepAnim(pl, dt) {
    const a = pl.anim; if (!a) return;
    a.t += dt / DAY_ANIM;
    const u = Math.min(1, a.t), e = u * u * (3 - 2 * u);
    pl.dispProg = a.p0 + (a.p1 - a.p0) * e;
    if (a.t < 1) return;
    pl.anim = null; pl.dispProg = a.p1;
    const ev = a.ev;
    if (ev.sunk) { finishRun(false); return; }
    if (ev.arrived) { onArrive(pl); return; }
    // hold: keep the setting while the weather class is unchanged and no squall is due
    const v = pl.v, wnow = windAt(v);
    if (pl.mode === 'play' && pl.hold && windClass(wnow.str) === pl.holdClass && !wnow.squall && v.ship.hp > v.ship.maxHp * TUNE.leakBelow) {
      doDay(pl, pl.lastSetting);
    } else if (pl.mode === 'play' && pl.hold) {
      const M = lay().voy.map; pop(pl, 'Weather changes', '#9fe3d8', M.x + M.w * 0.5, M.y + M.h * 0.3, 28);
    }
  }
  function onArrive(pl) {
    const v = pl.v, port = PORTS[v.loc];
    pl.leg = null; pl.sel = null; pl.dispProg = 0; pl.scroll = 0; pl.legsDone += 1;
    pl.banner = { text: `Arrived at ${port.name}`, sub: `Day ${Math.min(v.day + 1, v.endDay)} of ${v.endDay}`, t: 0 };
    [392, 523, 659].forEach((fq, i) => later.push({ t: i * 0.1, fn: () => tone({ freq: fq, dur: 0.22, type: 'triangle', vol: 0.12 }) }));
    const M = lay().voy.map;
    if (!state.prefs.calm) burst(pl.parts, rng, M.x + M.w * 0.5, M.y + M.h * 0.45, 'spark', 10, 0.8, '#ffe9a0', 9);
    env.monetization.track?.('arrive', { port: port.id, day: v.day });
    saveVoyage();
    if (v.over) finishRun(false);
    else if (pl.mode === 'auto' && pl.legsDone >= AUTO_LEGS) pl.autoDone = true;
  }

  // ---- the computer captain (Watch and Learn) -----------------------------------------------------------------------------------------
  const listGoods = (load) => load.map((n, g) => (n ? `${n} ${GOODS[g].name.toLowerCase()}` : '')).filter(Boolean).join(', ');
  // Port step: THINK compares routes, REVEAL names the choice and cargo, ACT sells, buys and sails.
  function aiPortPlan(pl) {
    const v = pl.v, ai = pl.ai;
    const here = Math.round(sellValue(v)), opts = planTrip(v);
    ai.plan = { opts, best: opts[0] };
    const top = opts.slice(0, 3).map((o) => `${PORTS[o.to].name} ${o.days} d, +${Math.max(0, o.net)}`).join('; ');
    ai.think = `${PORTS[v.loc].name}, day ${v.day + 1}. ${here > 0 ? `First I sell my cargo here for about ${here} coins. ` : ''}Then I compare routes by profit, after ${TUNE.upkeep} coins a day upkeep: ${top}.`;
  }
  function aiReveal(pl) {
    const ai = pl.ai, o = ai.plan.best;
    if (!o || o.net <= 0) { ai.text = 'Nothing pays well after upkeep. I will wait a day for the prices and wind to move, then go.'; return; }
    pl.sel = o.to;
    ai.text = `I choose ${PORTS[o.to].name}: carry ${listGoods(o.load) || 'nothing'}, about ${o.days} ${o.days === 1 ? 'day' : 'days'}, +${Math.max(0, o.net)} coins. Cheap here, dear there.`;
  }
  function aiPortAct(pl) {
    const v = pl.v, ai = pl.ai, o = ai.plan.best;
    sellAll(v);
    if (v.ship.hp < v.ship.maxHp * 0.6) repair(v);
    if (!o || (o.net <= 0 && ai.waited < 2)) { waitDay(v); ai.waited += 1; ai.plan = null; if (v.over) finishRun(false); return; }
    ai.waited = 0;
    const fresh = planTrip(v).find((q) => q.to === o.to) || o;       // prices slipped when selling: load again
    for (let g = 0; g < GOODS.length; g++) if (fresh.load[g]) buy(v, g, fresh.load[g]);
    pl.sel = o.to; setSail(pl); ai.plan = null;
    tone({ freq: 880, to: 1175, dur: 0.14, type: 'triangle', vol: 0.15 });
  }
  function aiSeaPlan(pl) {
    const v = pl.v, ai = pl.ai, b = bestSetting(v), w = windAt(v), cls = CLASS_NAME[windClass(w.str)];
    const a = dayRun(v, 'full'), r = dayRun(v, 'reef');
    ai.plan = { setting: b.setting };
    ai.think = `${w.squall ? 'A squall' : cls}, ${pointName(a.ang)}. Full sail would run ${Math.round(a.dist)} nm and cost ${Math.round(a.dmg)} hull; reefed runs ${Math.round(r.dist)} nm and costs ${Math.round(r.dmg)}.`;
    ai.reveal = `${SET_NAME[b.setting]}. ${b.why}`;
  }
  // Returns true when the sea clock (the ship animation) may run this tick.
  function aiStep(pl, dt, tap) {
    const ai = pl.ai, v = pl.v;
    if (ai.phase === 'think' || ai.phase === 'reveal') {
      ai.t += dt;
      const lim = ai.phase === 'think' ? state.prefs.thinkSec : AI_REVEAL;
      const R = lay().voy.panel, coach = (v.at === 'port' ? portPanel(R, true) : seaPanel(R, true)).coach;
      const skip = tap && coach && inRect({ x: coach.x + coach.w - 130, y: coach.y + 6, w: 118, h: 48 }, tap.x, tap.y);
      if (ai.t >= lim || skip) {
        if (ai.phase === 'think') { ai.phase = 'reveal'; ai.t = skip ? AI_REVEAL * 0.35 : 0; if (v.at === 'port') aiReveal(pl); else ai.text = ai.reveal; }
        else { ai.phase = 'act'; ai.t = 0; }
      }
      return false;
    }
    if (ai.phase === 'act') {
      if (v.at === 'port') aiPortAct(pl);
      else if (v.sea && !pl.anim) { pl.hold = false; doDay(pl, ai.plan.setting); }
      ai.phase = 'run'; ai.t = 0; ai.text = '';
      return true;
    }
    return true;
  }
  function aiDecide(pl) {
    const ai = pl.ai, v = pl.v;
    if (ai.phase !== 'run' || pl.anim || v.over) return;
    if (pl.autoDone) { finishRun(true); return; }
    if (v.at === 'port') { aiPortPlan(pl); ai.phase = 'think'; ai.t = 0; ai.text = ai.think; return; }
    if (v.sea) {
      const w = windAt(v), cls = windClass(w.str) + (w.squall ? '!' : '');
      aiSeaPlan(pl);
      const interesting = cls !== ai.lastClass || v.sea.days === 0;
      ai.lastClass = cls;
      if (interesting) { ai.phase = 'think'; ai.t = 0; ai.text = ai.think; }
      else { pl.hold = false; doDay(pl, ai.plan.setting); }
    }
  }

  // ---- per-tick voyage update ---------------------------------------------------------------------------------------------------------
  function stepFx(pl, dt) {
    stepParticles(pl.parts, dt);
    for (const p of pl.pops) p.age += dt;
    pl.pops = pl.pops.filter((p) => p.age < 1.1);
    if (pl.banner) { pl.banner.t += dt; if (pl.banner.t > 2.2) pl.banner = null; }
    if (pl.hint) { pl.hintT += dt; if (pl.hintT > 9) pl.hint = null; }
  }
  function updateVoyage(dt, tap, input) {
    const pl = state.pl, L = lay();
    if (pl.paused || pl.over) { updatePauseMenu(tap, input); return; }
    if (input.keys.pressed.has('Escape') || input.keys.pressed.has('Space')) { pausePlay(); return; }
    const p = input.pointer;
    if (pl.mode === 'auto') {
      if (tap && inRect(pauseRect(L), tap.x, tap.y)) { pausePlay(); return; }
      if (aiStep(pl, dt, tap)) { stepAnim(pl, dt); aiDecide(pl); }
      if (pl.ai.phase === 'think' && pl.ai.t === 0 && !pl.ai.text) pl.ai.text = pl.ai.think;
    } else {
      if (pl.v.at === 'port') { const R0 = portPanel(L.voy.panel, false); pl.listMax = Math.max(0, GOODS.length * R0.rowH - R0.list.h); pl.scroll = Math.max(0, Math.min(pl.listMax, pl.scroll)); }
      // release-based taps so a drag can scroll the market list
      if (p.pressed) {
        const R = pl.v.at === 'port' ? portPanel(L.voy.panel, false) : null;
        vdrag = { x0: p.x, y0: p.y, s0: pl.scroll, moved: false, inList: !!R && !pl.yardOpen && inRect(R.list, p.x, p.y) };
      }
      const wy = input.wheel?.dy || 0;
      if (wy && pl.v.at === 'port') pl.scroll = Math.max(0, Math.min(pl.listMax, pl.scroll + wy));
      if (vdrag && p.down) {
        if (Math.abs(p.y - vdrag.y0) > 14) vdrag.moved = true;
        if (vdrag.moved && vdrag.inList) pl.scroll = Math.max(0, Math.min(pl.listMax, vdrag.s0 - (p.y - vdrag.y0)));
      }
      if (vdrag && p.released) { const d = vdrag; vdrag = null; if (!d.moved) voyageTap(pl, d.x0, d.y0, L); }
      const k = input.keys.pressed;
      if (pl.leg && !pl.anim) { if (k.has('Digit1')) doDay(pl, 'full'); else if (k.has('Digit2')) doDay(pl, 'reef'); else if (k.has('Digit3')) doDay(pl, 'anchor'); }
      if (k.has('KeyH')) think(pl);
      stepAnim(pl, dt);
    }
    stepFx(pl, dt);
  }
  function voyageTap(pl, x, y, L) {
    const v = pl.v;
    if (inRect(pauseRect(L), x, y)) { pausePlay(); return; }
    if (v.at === 'port' && !pl.anim) {
      const R = portPanel(L.voy.panel, false);
      if (pl.yardOpen) {
        for (const h of pl.yardRects) if (inRect(h.r, x, y)) {
          if (h.id === 'close') pl.yardOpen = false;
          else if (h.id === 'repair') { if (repair(v)) { tone({ freq: 300, to: 360, dur: 0.15, type: 'triangle', vol: 0.15 }); saveVoyage(); } }
          else if (h.id === 'hold') { if (upgradeHold(v)) { tone({ freq: 523, dur: 0.2, type: 'triangle', vol: 0.15 }); saveVoyage(); } }
          else if (h.id === 'sail') { if (upgradeSail(v)) { tone({ freq: 659, dur: 0.2, type: 'triangle', vol: 0.15 }); saveVoyage(); } }
        }
        return;
      }
      R.lots.forEach((r, i) => { if (inRect(r, x, y)) pl.lot = i; });
      if (inRect(R.yard, x, y)) { pl.yardOpen = true; return; }
      if (inRect(R.wait, x, y)) { waitDay(v); pop(pl, 'A day passes', '#9fe3d8', L.voy.map.x + L.voy.map.w / 2, L.voy.map.y + L.voy.map.h * 0.4, 28); saveVoyage(); if (v.over) finishRun(false); return; }
      if (inRect(R.think, x, y)) { think(pl); return; }
      if (inRect(R.go, x, y)) { setSail(pl); return; }
      if (inRect(R.list, x, y)) {
        const g = Math.floor((y - R.list.y + pl.scroll) / R.rowH);
        if (g >= 0 && g < GOODS.length) {
          const rw = R.list.w - (pl.listMax > 0 ? 12 : 0), bw = Math.max(118, Math.min(170, rw * 0.24));
          const sellX = R.list.x + rw - bw - 8, buyX = sellX - bw - 8;
          if (x >= sellX && x <= sellX + bw) doSell(pl, g);
          else if (x >= buyX && x <= buyX + bw) doBuy(pl, g);
        }
        return;
      }
      if (inRect(L.voy.map, x, y)) {
        const i = portAt(x, y);
        if (i >= 0 && routeDist(v.loc, i) > 0) { pl.sel = i; pl.hint = null; tone({ freq: 500, dur: 0.07, type: 'triangle', vol: 0.12 }); }
        else if (i >= 0 && i !== v.loc) toast(`No sea route from ${PORTS[v.loc].name} to ${PORTS[i].name}.`);
      }
    } else if (v.sea && !pl.anim) {
      const R = seaPanel(L.voy.panel, false);
      SETTINGS.forEach((s, i) => { if (inRect(R.set[i], x, y)) doDay(pl, s); });
      if (inRect(R.hold, x, y)) pl.hold = !pl.hold;
      if (inRect(R.think, x, y)) think(pl);
    }
  }
  function updatePauseMenu(tap, input) {
    const pl = state.pl, items = pauseItems();
    const M = menuRects(lay(), items.length);
    if (input.keys.pressed.has('Escape') && !pl.over) { resumePlay(); return; }
    if (!tap) return;
    items.forEach((it, i) => {
      if (!inRect(M.btns[i], tap.x, tap.y)) return;
      if (it === 'resume') resumePlay();
      else if (it === 'restart') { state.pl = null; state.scene = 'setup'; state.sceneT = 0; }
      else if (it === 'rules') openDoc('rules', 'voyage');
      else { saveVoyage(); go('title'); }
    });
  }
  const pauseItems = () => ['resume', 'restart', 'rules', 'quit'];

  // ---- menus and documents ------------------------------------------------------------------------------------------------------------
  function openDoc(key, backTo) { state.docKey = key; state.backTo = backTo; state.docScroll = 0; state.rulesPage = 0; go(key); }
  function settingsAction(id) {
    const p = state.prefs;
    if (id === 'sound') p.sound = !p.sound;
    else if (id === 'calm') p.calm = !p.calm;
    else if (id === 'thinkDec') p.thinkSec = Math.max(1, p.thinkSec - 1);
    else if (id === 'thinkInc') p.thinkSec = Math.min(10, p.thinkSec + 1);
    else if (id === 'rules') { openDoc('rules', 'settings'); return; }
    else if (id === 'restore') { restorePurchase(); return; }
    savePrefs();
  }
  // Settings > Restore purchase: asks the store again; clear busy / found / not found / failed messages.
  function restorePurchase() {
    const m = env.monetization;
    if (!m || m.mode === 'demo' || state.restoreBusy || m.owns('unlock_game')) return;
    state.restoreBusy = true; state.restoreMsg = 'Checking with the store...';
    Promise.resolve().then(() => m.restore()).then(() => {
      state.restoreMsg = m.owns('unlock_game') ? 'Purchase restored. Full game unlocked.' : 'No earlier purchase found for this account.';
    }).catch(() => { state.restoreMsg = 'Could not reach the store. Try again later.'; }).finally(() => { state.restoreBusy = false; });
  }
  function leaveDoc() {
    if (state.backTo === 'voyage') { if (state.pl) { state.scene = 'voyage'; state.sceneT = 0; } else go('title'); return; }
    go(state.backTo);
  }
  function updateDoc(input) {
    const p = input.pointer, max = docMetrics.max, view = ui.view;
    const setScroll = (v) => { state.docScroll = Math.max(0, Math.min(v, max)); };
    const wy = input.wheel?.dy || 0;
    if (wy) setScroll(state.docScroll + wy);
    const k = input.keys.pressed;
    if (k.has('ArrowDown')) setScroll(state.docScroll + 70);
    if (k.has('ArrowUp')) setScroll(state.docScroll - 70);
    if (k.has('PageDown')) setScroll(state.docScroll + docMetrics.view * 0.9);
    if (k.has('PageUp')) setScroll(state.docScroll - docMetrics.view * 0.9);
    if (k.has('Escape')) { leaveDoc(); return; }
    if (p.pressed) drag = { x0: p.x, y0: p.y, s0: state.docScroll, moved: false, inView: inRect(view, p.x, p.y) };
    if (drag && p.down) {
      if (Math.abs(p.y - drag.y0) > 14) drag.moved = true;
      if (drag.moved && drag.inView) setScroll(drag.s0 - (p.y - drag.y0));
    }
    if (drag && p.released) {
      const d = drag; drag = null;
      if (d.moved) return;
      for (const h of ui.hits) {
        if (!inRect(h.r, d.x0, d.y0)) continue;
        if (h.clip && !inRect(h.clip, d.x0, d.y0)) continue;
        docAction(h.id); return;
      }
    }
  }
  function docAction(id) {
    if (id === 'back') { leaveDoc(); return; }
    if (id === 'textDec' || id === 'textInc') {
      const n = state.prefs.textIdx + (id === 'textInc' ? 1 : -1);
      if (n < 0 || n >= TEXT_SCALES.length) return;
      state.docFrac = docMetrics.max > 0 ? state.docScroll / docMetrics.max : 0; state.docRescale = true;
      state.prefs.textIdx = n; savePrefs(); return;
    }
    if (id === 'prev') { if (state.rulesPage > 0) { state.rulesPage -= 1; state.docScroll = 0; } return; }
    if (id === 'next') { if (state.rulesPage < RULES.length - 1) { state.rulesPage += 1; state.docScroll = 0; } else leaveDoc(); return; }
    if (id.startsWith('set:')) settingsAction(id.slice(4));
  }

  function updateTitle(tap) {
    if (!tap) return;
    const T = lay().title, hit = (r) => inRect(r, tap.x, tap.y);
    if (hit(T.play)) { state.scene = 'setup'; state.sceneT = 0; }
    else if (hit(T.cont) && state.saved) continueSaved();
    else if (hit(T.auto)) startAuto();
    else if (hit(T.how)) openDoc('howto', 'title');
    else if (hit(T.rules)) openDoc('rules', 'title');
    else if (hit(T.about)) openDoc('about', 'title');
    else if (hit(T.settings)) openDoc('settings', 'title');
    else if (tap.y > T.credit.y - 90 && Math.abs(tap.x - T.credit.x) < 190) env.openArcforgeHome?.();
  }
  function updateSetup(tap, input) {
    if (input.keys.pressed.has('Escape')) { go('title'); return; }
    if (!tap) return;
    const U = lay().setup, s = state.setupSel;
    if (inRect(U.back, tap.x, tap.y)) go('title');
    else if (inRect(U.quick, tap.x, tap.y)) s.mode = 'quick';
    else if (inRect(U.monsoon, tap.x, tap.y)) s.mode = 'monsoon';
    else if (s.mode === 'monsoon' && inRect(U.west, tap.x, tap.y)) s.month = 11;
    else if (s.mode === 'monsoon' && inRect(U.east, tap.x, tap.y)) s.month = 5;
    else if (inRect(U.next, tap.x, tap.y)) openYard();
  }
  function updateResult(tap) {
    if (!tap) return;
    const Rr = lay().result;
    if (inRect(Rr.again, tap.x, tap.y)) { if (state.result.mode === 'auto') startAuto(); else { state.pl = null; state.scene = 'setup'; state.sceneT = 0; } }
    else if (inRect(Rr.menu, tap.x, tap.y)) go('title');
    else if (tap.y > Rr.more.y - 30 && tap.y < Rr.more.y + 14) env.openArcforgeHome?.();
  }

  // Dev helper: one whole leg without lessons or animation (used by shots).
  function instantLeg(pl) {
    const v = pl.v; if (v.over) return;
    if (v.at === 'port') {
      sellAll(v); if (v.ship.hp < v.ship.maxHp * 0.6) repair(v);
      const o = planTrip(v)[0];
      if (!o) { waitDay(v); return; }
      for (let g = 0; g < GOODS.length; g++) if (o.load[g]) buy(v, g, o.load[g]);
      depart(v, o.to);
    }
    let guard = 0;
    while (v.sea && guard++ < 60) sailDay(v, bestSetting(v).setting);
    pl.leg = null; pl.sel = null; pl.dispProg = 0;
  }

  // ---- the object the kit and main.js see --------------------------------------------------------------------------------------------
  const api = {
    update(dt, input) {
      state.t += dt;
      if (state.scene !== lastScene) { lastScene = state.scene; state.sceneT = 0; } else state.sceneT += dt;
      if (state.toast) { state.toast.t += dt; if (state.toast.t > state.toast.hold) state.toast = null; }
      for (let i = later.length - 1; i >= 0; i--) { later[i].t -= dt; if (later[i].t <= 0) { later[i].fn(); later.splice(i, 1); } }
      const p = input.pointer, tap = p.pressed ? { x: p.x, y: p.y } : null, sc = state.scene;
      press.down = !!p.down; press.x = p.x; press.y = p.y;
      if (sc === 'title') updateTitle(tap);
      else if (sc === 'setup') updateSetup(tap, input);
      else if (sc === 'yard') updateYard(dt, tap, input);
      else if (sc === 'voyage') updateVoyage(dt, tap, input);
      else if (sc === 'result') updateResult(tap);
      else if (sc === 'rules' || sc === 'about' || sc === 'howto' || sc === 'settings') updateDoc(input);
      else if (sc === 'demo-limit' && tap) go('title');
    },
    render(ctx, view) { state.restore = api.restoreInfo(); render(ctx, state, layoutFor(view?.width ?? meta.width, view?.height ?? meta.height), view, meta, pauseItems); },
    getState: () => state,
    // Used by the Settings screen: what the Restore row shows.
    restoreInfo() {
      const m = env.monetization;
      if (!m || m.mode === 'demo') return null;
      const owned = m.owns('unlock_game');
      return { owned, busy: state.restoreBusy, msg: state.restoreMsg };
    },
    // Called by main.js when the app goes to the background.
    autoPause() { if (state.scene === 'voyage') pausePlay(); },
    // Everything except real sailing is free: menus, shipyard, Rules, Watch and Learn, results, pause.
    isPreviewExempt() {
      const pl = state.pl;
      return !(state.scene === 'voyage' && pl && pl.mode !== 'auto' && !pl.paused && !pl.over);
    },
    // Tester tools (?dev=1 and store shots): jump to a screen and fast-forward.
    dev: {
      jump(o = {}) {
        if (o.pref) Object.assign(state.prefs, o.pref);
        if (o.setup) Object.assign(state.setupSel, o.setup);
        const sc = o.scene ?? 'title';
        const quickPlay = (mode = 'play') => {
          const S = state.setupSel;
          const v = newVoyage({ seed: o.seed ?? 1234, mode: S.mode, startMonth: S.mode === 'quick' ? 11 : S.month, build: { size: o.size ?? 'pinisi', timber: o.timber ?? 'teak', rig: o.rig ?? 'balanced' }, quality: 0.85 });
          startPlay(mode, v); state.pl.banner = null;
          return state.pl;
        };
        if (sc === 'voyage') {
          const pl = quickPlay(o.mode ?? 'play');
          for (let n = 0; n < (o.sailed ?? 0); n++) instantLeg(pl);
          if (o.sea && pl.v.at === 'port') {
            const opts = planTrip(pl.v); sellAll(pl.v);
            for (let g = 0; g < GOODS.length; g++) if (opts[0].load[g]) buy(pl.v, g, opts[0].load[g]);
            pl.sel = opts[0].to; setSail(pl); pl.banner = null;
            for (let n = 0; n < (o.seaDays ?? 1); n++) if (pl.v.sea) sailDay(pl.v, bestSetting(pl.v).setting);
            if (pl.v.sea) pl.dispProg = pl.v.sea.progress;
          }
          if (o.sel !== undefined && pl.v.at === 'port') pl.sel = o.sel;
          if (o.buy && pl.v.at === 'port') for (const [g, n] of o.buy) buy(pl.v, g, n);
          if (o.pause) pausePlay();
          if (o.hint) think(pl);
          if (o.yardOpen) pl.yardOpen = true;
        } else if (sc === 'yard') {
          Object.assign(state.yard, { size: o.size ?? 'pinisi', timber: o.timber ?? 'teak', rig: o.rig ?? 'balanced' });
          openYard();
          if (o.phase === 'fit' || o.phase === 'done') {
            startFitting(); const y = state.yard;
            const n = o.phase === 'done' ? TUNE.planks : (o.planks ?? 3);
            for (let i = 0; i < n; i++) { y.task.res.push({ q: 0.6 + 0.4 * hash(5, i), grade: i % 3 === 0 ? 'perfect' : 'good' }); y.task.i += 1; }
            if (n >= TUNE.planks) { y.task.done = true; y.phase = 'done'; y.rigT = 1; }
            y.bShown = y.task.res.length; y.task.t = 0.9;
          }
        } else if (sc === 'rules') { openDoc('rules', 'title'); state.rulesPage = o.page ?? 0; }
        else if (sc === 'about' || sc === 'howto' || sc === 'settings') openDoc(sc, 'title');
        else if (sc === 'result') {
          const pl = quickPlay();
          const v = pl.v; Object.assign(v, { coins: 1480, day: 45 }); v.stats = { legs: 10, bestProfit: 0, damage: 62, bought: 120, sold: 118 }; v.hold[0] = 6; v.over = true; v.reason = 'time'; v.ship.hp = 71;
          finishRun(false);
        } else { state.scene = sc; state.sceneT = 0; }
        if (o.advance && state.pl && state.scene === 'voyage') {
          const idle = { pointer: { x: 0, y: 0, down: false, pressed: false, released: false }, keys: { down: new Set(), pressed: new Set() } };
          for (let i = 0; i < o.advance * 60; i++) api.update(1 / 60, idle);
        }
      },
    },
  };
  return api;
}

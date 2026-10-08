// Silk Road Trader: state and flow. Rules are in engine.js, data in data.js / events.js, the advisor in advisor.js; drawing is in view.js and scenes.js.
// Pure and deterministic: time only from dt, randomness only from env.rng (and the fixed seeds of the Watch and Learn demonstration).
import { createRng } from '../kit/rng.js';
import * as E from './engine.js';
import * as A from './advisor.js';
import { LIMIT_DAYS, CITIES, LEGS } from './data.js';
import { EVENT_BY_ID } from './events.js';
import { RULES, ABOUT, HOWTO, journalBlocks } from './content.js';
import { layoutFor, hitTest, inRect, TEXT_SCALES } from './layout.js';
import { ui, renderDoc, docMetrics } from './docview.js';
import { button, panel, txt, wrap, chip, PAL, UI, DISPLAY, rrect, bar } from './ui.js';
import * as V from './view.js';
import { paintScene, miniCity } from './scenes.js';

export const meta = { width: 720, height: 1560, fluid: { short: 720 }, previewBadge: null };
const DEMO_LEGS = 2, THINK_MIN = 1, THINK_MAX = 10, REVEAL_SEC = 2;
const FIG = { city: miniCity };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const HINT_TARGET = {
  sell: (s) => ({ tab: 'trade', good: s.good }), buy: (s) => ({ tab: 'trade', good: s.good }),
  camel: () => ({ tab: 'caravan', id: 'camel+' }), guard: () => ({ tab: 'caravan', id: 'guard+' }), dismiss: () => ({ tab: 'caravan', id: 'guard-' }),
  water: () => ({ tab: 'caravan', id: 'water+' }), food: () => ({ tab: 'caravan', id: 'food+' }), rest: () => ({ tab: 'caravan', id: 'rest' }),
  phrases: () => ({ tab: 'caravan', id: 'phrases' }), news: () => ({ tab: 'caravan', id: 'news' }), depart: () => ({ tab: 'road', id: 'depart' }), settle: () => ({ tab: 'road', id: 'settle' }),
};

export function createGame(env) {
  const { rng, storage, config } = env;
  const m = env.monetization;
  const rj = rng.fork();
  let lessonRng = createRng(23);
  const st = {
    scene: 'title', sceneT: 0, t: 0, backTo: 'title', mapBack: 'journey',
    prefs: { sound: true, textIdx: 0, think: 5 }, best: { score: 0, rank: '', journeys: 0 }, meta: { cities: [], people: [], goods: {} }, hasSave: false, owned: false,
    S: null, realS: null, realPh: 'city', ph: 'city', tab: 'trade', step: 1, roadTo: null, roadAlt: false, pace: 'steady', roadNeed: { water: 0, food: 0 },
    psc: 0, pmax: 0, tv: { scroll: 0, dayT: 0, speed: 1, paused: false },
    ev: null, arr: null, hint: null, toast: null, menu: false, auto: null, result: null, lessonH: 0,
    docScroll: 0, docFrac: 0, docRescale: false, page: 0, journalTab: 'cities', confirmReset: false,
    demoLegs: 0, dev: config.dev === true, demo: config.demo === true,
  };
  const R = () => (st.auto ? lessonRng : rj);

  // ---- persistence ---------------------------------------------------------------------------------------------------------------------------------------
  storage.get('prefs', null).then((v) => { if (v) { Object.assign(st.prefs, v); applyPrefs(); } });
  storage.get('best', null).then((v) => { if (v) st.best = { ...st.best, ...v }; });
  storage.get('meta', null).then((v) => { if (v) st.meta = { cities: v.cities ?? [], people: v.people ?? [], goods: v.goods ?? {} }; });
  storage.get('save', null).then((v) => { if (v && v.S && !st.S) st.hasSave = true; });
  storage.get('demoLegs', 0).then((v) => { st.demoLegs = Math.max(st.demoLegs, v); });
  const saveJourney = () => { if (st.auto || !st.S || st.S.over) return; storage.set('save', { S: { ...st.S, trip: null }, tab: st.tab }); st.hasSave = true; };
  const savePrefs = () => storage.set('prefs', st.prefs);
  const saveMeta = () => storage.set('meta', st.meta);
  function applyPrefs() { env.audio.setMuted?.(!st.prefs.sound); config.textScale = TEXT_SCALES[st.prefs.textIdx]; }
  applyPrefs();
  function refreshOwned() { try { st.owned = !!m.owns?.('unlock_game'); } catch { st.owned = false; } }
  refreshOwned(); m.onChange?.(refreshOwned);

  // ---- helpers -------------------------------------------------------------------------------------------------------------------------------------------
  const go = (scene, back) => { st.scene = scene; st.sceneT = 0; st.docScroll = 0; st.psc = 0; st.pmax = 0; st.hint = null; if (back) st.backTo = back; };
  const toast = (msg, kind = 'info') => { st.toast = { msg, kind, t: 2.4 }; };
  const snd = (kind) => {
    if (!st.prefs.sound) return; const a = env.audio;
    if (kind === 'coin') { a.tone({ freq: 880, to: 1320, dur: 0.07, type: 'triangle', vol: 0.25 }); a.tone({ freq: 1320, to: 1760, dur: 0.09, type: 'triangle', vol: 0.18 }); }
    else if (kind === 'tap') a.tone({ freq: 520, dur: 0.04, type: 'sine', vol: 0.18 });
    else if (kind === 'bad') a.tone({ freq: 180, to: 120, dur: 0.18, type: 'sawtooth', vol: 0.18 });
    else if (kind === 'good') { a.tone({ freq: 523, dur: 0.1, type: 'triangle', vol: 0.22 }); a.tone({ freq: 784, dur: 0.16, type: 'triangle', vol: 0.22 }); }
    else if (kind === 'bell') { a.tone({ freq: 1320, to: 1250, dur: 0.35, type: 'sine', vol: 0.18 }); a.tone({ freq: 1980, to: 1900, dur: 0.25, type: 'sine', vol: 0.1 }); }
    else if (kind === 'arrive') { a.tone({ freq: 392, dur: 0.18, type: 'triangle', vol: 0.25 }); a.tone({ freq: 523, dur: 0.18, type: 'triangle', vol: 0.25 }); a.tone({ freq: 659, dur: 0.3, type: 'triangle', vol: 0.25 }); }
  };
  const noteMeta = () => {
    const S = st.S; if (!S || st.auto) return; let ch = false;
    for (const c of S.j.cities) if (!st.meta.cities.includes(c)) { st.meta.cities.push(c); ch = true; }
    for (const p of S.j.people) if (!st.meta.people.includes(p)) { st.meta.people.push(p); ch = true; }
    for (const g of Object.keys(S.j.goods)) { if (S.j.goods[g].sold > 0 && !st.meta.goods[g]) { st.meta.goods[g] = { sold: 1 }; ch = true; } }
    if (ch) saveMeta();
  };
  const clearHint = () => { st.hint = null; };
  const setTab = (t) => { st.tab = t; st.psc = 0; st.pmax = 0; clearHint(); };

  // ---- journey flow ---------------------------------------------------------------------------------------------------------------------------------------
  function newJourney() {
    st.auto = null; st.S = E.newJourney(rj); st.ph = 'city'; st.tab = 'trade'; st.step = 1; st.roadTo = null; st.roadAlt = false; st.pace = 'steady'; st.result = null; st.menu = false;
    go('journey'); noteMeta(); saveJourney(); env.monetization.track?.('journey_start', {});
  }
  async function continueJourney() {
    const v = await storage.get('save', null); if (!v?.S) { newJourney(); return; }
    st.auto = null; st.S = v.S; st.ph = 'city'; st.tab = v.tab ?? 'trade'; st.roadTo = null; st.menu = false; go('journey');
  }
  function depart() {
    const S = st.S, to = st.roadTo, route = LEGS[Math.min(S.city, to)].alt && st.roadAlt ? 'alt' : 'main';
    if (st.demo && !st.auto && st.demoLegs >= DEMO_LEGS) { go('demo-limit'); return; }
    S.dir = to > S.city ? 1 : -1;
    const r = E.depart(S, R(), to, route, st.pace); if (!r.ok) { toast(r.msg, 'bad'); return; }
    if (st.demo && !st.auto) { st.demoLegs += 1; storage.set('demoLegs', st.demoLegs); }
    st.ph = 'travel'; st.tv = { scroll: 0, dayT: 0, speed: st.auto ? 1 : st.tv.speed, paused: false }; st.psc = 0; clearHint(); snd('bell');
    saveJourney();
  }
  function stepTravel() {
    const S = st.S, r = E.stepDay(S, R());
    if (r.over) { finish('stranded'); return; }
    if (r.event) { st.ev = { id: r.event.id, res: null }; st.ph = 'event'; st.psc = 0; st.pmax = 0; clearHint(); snd('bell'); if (st.auto) st.auto.step = null; return; }
    if (r.arrived) arriveNow();
  }
  function arriveNow() {
    const S = st.S, to = S.trip.to;
    const info = E.arrive(S, R(), to);
    st.arr = info; noteMeta();
    if (S.camels <= 0) { finish('stranded'); return; }
    if (S.day >= LIMIT_DAYS) { finish('snow'); return; }
    st.ph = 'arrive'; st.psc = 0; st.pmax = 0; st.tab = 'trade'; st.roadTo = null; clearHint(); snd('arrive'); saveJourney();
    if (st.auto) { st.auto.out = 0; st.auto.step = null; }
  }
  function chooseEvent(i) {
    const ev = EVENT_BY_ID[st.ev.id], res = E.resolveChoice(st.S, R(), ev, i);
    if (!res) return;
    st.ev.res = res; st.ev.i = i; st.ph = 'outcome'; st.psc = 0; st.pmax = 0; clearHint(); noteMeta();
    snd(res.win === false ? 'bad' : 'good');
  }
  function afterEvent() {
    const S = st.S; st.ev = null;
    if (S.camels <= 0) { finish('stranded'); return; }
    st.ph = 'travel'; st.psc = 0; st.pmax = 0; clearHint();
    if (S.trip && S.trip.day >= S.trip.days) arriveNow();
  }
  function finish(reason) {
    const S = st.S; if (!S.over) E.endJourney(S, reason); S.trip = null;
    const sc = E.score(S);
    if (st.auto) { st.auto.done = true; st.auto.result = sc; go('lesson-end'); return; }
    st.result = { ...sc, reason: S.over }; st.result.newBest = sc.total > st.best.score;
    if (st.result.newBest) st.best.score = sc.total; st.best.rank = sc.rank; st.best.journeys += 1; storage.set('best', st.best);
    storage.remove('save'); st.hasSave = false; noteMeta();
    env.monetization.track?.('journey_end', { score: sc.total, day: S.day });
    go('result'); snd('good');
  }

  // ---- city actions ---------------------------------------------------------------------------------------------------------------------------------------
  function doAct(res, sound) { if (!res.ok) { toast(res.msg, 'bad'); snd('bad'); return false; } if (res.msg) toast(res.msg); snd(sound ?? 'tap'); noteMeta(); saveJourney(); clearHint(); return true; }
  function cityHit(id) {
    const S = st.S;
    if (id.startsWith('tab:')) { setTab(id.slice(4)); snd('tap'); return; }
    if (id.startsWith('step:')) { st.step = Number(id.slice(5)); snd('tap'); return; }
    if (id.startsWith('buy:')) { doAct(E.buy(S, id.slice(4), st.step), 'coin'); return; }
    if (id.startsWith('sell:')) { doAct(E.sell(S, id.slice(5), st.step), 'coin'); return; }
    if (id === 'camel+') doAct(E.buyCamel(S), 'coin'); else if (id === 'camel-') doAct(E.sellCamel(S), 'coin');
    else if (id === 'guard+') doAct(E.hireGuard(S), 'tap'); else if (id === 'guard-') doAct(E.dismissGuard(S), 'tap');
    else if (id === 'water+10') doAct(E.buySupply(S, 'water', 10)); else if (id === 'food+10') doAct(E.buySupply(S, 'food', 10));
    else if (id === 'water+need') doAct(E.buySupply(S, 'water', Math.ceil(st.roadNeed.water - S.water))); else if (id === 'food+need') doAct(E.buySupply(S, 'food', Math.ceil(st.roadNeed.food - S.food)));
    else if (id === 'rest') doAct(E.restDay(S, R()), 'tap'); else if (id === 'phrases') doAct(E.learnPhrases(S), 'good'); else if (id === 'news') doAct(E.askNews(S, R()), 'good');
    else if (id.startsWith('road:')) { st.roadTo = Number(id.slice(5)); st.roadAlt = false; snd('tap'); }
    else if (id.startsWith('route:')) { st.roadAlt = id === 'route:alt'; snd('tap'); }
    else if (id.startsWith('pace:')) { st.pace = id.slice(5); snd('tap'); }
    else if (id === 'buyNeed') {
      const pl = E.plan(S, st.roadTo, st.roadAlt ? 'alt' : 'main', st.pace);
      if (S.water < pl.water) E.buySupply(S, 'water', Math.ceil(pl.water - S.water)); if (S.food < pl.food) E.buySupply(S, 'food', Math.ceil(pl.food - S.food));
      if (S.water < pl.water || S.food < pl.food) toast('Not enough room or silver for everything.', 'bad'); else toast('Supplies bought.');
      snd('coin'); noteMeta(); saveJourney();
    }
    else if (id === 'depart') depart();
    else if (id === 'settle') finish('settled');
    else if (id === 'think') think();
    else if (id === 'hintClose') clearHint();
  }
  function think() {
    if (st.hint) { clearHint(); return; }
    const S = st.S;
    if (st.ph === 'event' && st.ev && !st.ev.res) { const a = A.adviseChoice(S, EVENT_BY_ID[st.ev.id]); st.hint = { act: 'choice', i: a.i, label: a.label, why: a.why }; return; }
    if (st.ph !== 'city') return;
    const a = A.advise(S, {}); const tg = (HINT_TARGET[a.act] ?? (() => ({})))(a);
    st.hint = { act: a.act, label: a.label, why: a.why, ...tg };
  }

  // ---- Watch and Learn ---------------------------------------------------------------------------------------------------------------------------------------
  function startLesson() {
    st.realS = st.S; st.realPh = st.ph; lessonRng = createRng(23);
    st.S = E.newJourney(createRng(11)); st.ph = 'city'; st.tab = 'trade'; st.roadTo = null; st.roadAlt = false; st.pace = 'steady'; st.menu = false; st.tv = { scroll: 0, dayT: 0, speed: 1, paused: false };
    st.auto = { goal: 5, stage: 'think', t: 0, step: null, paused: false, n: 0, done: false, out: 0 };
    go('journey', 'title');
  }
  function endLesson(toScene = 'title') {
    st.S = st.realS ?? null; st.realS = null; st.auto = null; st.ph = st.realPh ?? 'city'; st.ev = null; st.hint = null; st.tv.paused = false;
    if (st.S && st.S.trip) st.S.trip = null;
    go(toScene);
  }
  const thinkSecs = () => clamp(st.prefs.think, THINK_MIN, THINK_MAX);
  const contextLine = (S) => `Day ${S.day} of ${LIMIT_DAYS}, ${S.silver} silver, ${S.camels} camels, strength ${Math.round(S.str)}, water ${Math.round(S.water)}, provisions ${Math.round(S.food)}.`;
  function autoPrepare() {
    const A_ = st.auto, S = st.S;
    if (st.ph === 'city') { A_.step = A.advise(S, { goal: A_.goal, phrases: true }); A_.stage = 'think'; A_.t = 0; st.hint = { act: 'think', label: 'Thinking...', why: contextLine(S) }; }
    else if (st.ph === 'event') { A_.step = A.adviseChoice(S, EVENT_BY_ID[st.ev.id]); A_.stage = 'think'; A_.t = 0; st.hint = { act: 'think', label: 'Thinking...', why: 'Weigh the odds, the costs and what each choice could change. ' + contextLine(S) }; }
  }
  function autoReveal() {
    const A_ = st.auto, a = A_.step; A_.stage = 'reveal'; A_.t = 0;
    if (st.ph === 'city') {
      const tg = (HINT_TARGET[a.act] ?? (() => ({})))(a); if (tg.tab && tg.tab !== st.tab) { st.tab = tg.tab; st.psc = 0; st.pmax = 0; }
      if (a.act === 'depart') { st.roadTo = a.to; st.pace = a.pace; st.roadAlt = false; }
      st.hint = { act: a.act, label: a.label, why: a.why, ...tg };
    } else st.hint = { act: 'choice', i: a.i, label: a.label, why: a.why };
  }
  function autoAct() {
    const A_ = st.auto, a = A_.step, S = st.S; A_.n += 1; A_.stage = 'think'; A_.t = 0;
    if (st.ph === 'city') {
      if (a.act === 'settle') { finish('settled'); return; }
      if (a.act === 'depart') { st.roadTo = a.to; st.pace = a.pace; st.roadAlt = false; depart(); A_.step = null; return; }
      const r = A.applyStep(S, R(), a); if (r.msg) toast(r.msg); noteMeta(); snd(a.act === 'buy' || a.act === 'sell' ? 'coin' : 'tap'); clearHint(); A_.step = null;
    } else if (st.ph === 'event') { chooseEvent(a.i); A_.step = null; A_.out = 0; }
  }
  function autoTick(dt) {
    const A_ = st.auto; if (!A_ || A_.paused || st.menu) return;
    if (st.ph === 'travel') return;
    if (st.ph === 'arrive') { A_.out += dt; if (A_.out > 3.2) { A_.out = 0; st.ph = 'city'; st.tab = 'trade'; st.psc = 0; st.hint = null; A_.step = null; } return; }
    if (st.ph === 'outcome') { A_.out += dt; if (A_.out > 3.6) { A_.out = 0; A_.step = null; afterEvent(); } return; }
    if (!A_.step) autoPrepare();
    A_.t += dt;
    if (A_.stage === 'think' && A_.t >= thinkSecs()) autoReveal();
    else if (A_.stage === 'reveal' && A_.t >= REVEAL_SEC) autoAct();
  }
  const lessonSkip = () => {
    const A_ = st.auto; if (!A_) return;
    if (st.ph === 'arrive' || st.ph === 'outcome') { A_.out = 99; return; }
    if (st.ph === 'travel') { st.tv.speed = 3; return; }
    if (!A_.step) autoPrepare(); if (A_.stage === 'think') autoReveal(); A_.t = REVEAL_SEC;
  };

  // ---- documents ---------------------------------------------------------------------------------------------------------------------------------------------
  function docFor() {
    const sc = st.scene;
    if (sc === 'rules') { const pg = RULES[clamp(st.page, 0, RULES.length - 1)]; return { key: 'rules' + st.page, title: pg.title, blocks: pg.blocks, nav: true, page: st.page, pages: RULES.length }; }
    if (sc === 'about') {
      const blocks = [...ABOUT, { h: 'Full game' }, { p: st.owned ? 'The full game is unlocked on this device. Thank you!' : 'The first 90 seconds of real play are free. The full game is a single purchase: no ads, no subscription.' },
        ...(st.owned || st.demo ? [] : [{ row: 'unlock', label: 'Unlock full game', hint: 'One purchase', kind: 'button', btn: 'Unlock' }]), ...(st.demo ? [] : [{ row: 'restore', label: 'Restore purchase', hint: 'If you bought it before', kind: 'button', btn: 'Restore' }])];
      return { key: 'about' + st.owned + st.demo, title: 'About', blocks };
    }
    if (sc === 'howto') return { key: 'howto', title: 'How to Play', blocks: HOWTO };
    if (sc === 'settings') {
      const rows = [
        { row: 'sound', label: 'Sound', kind: 'toggle', val: () => st.prefs.sound },
        { row: 'think', label: 'Watch and Learn pause', hint: 'Seconds to think before each decision', kind: 'stepper', val: () => st.prefs.think + ' s' },
        { row: 'zoomRow', label: 'Text size', hint: 'Tap, or use A- and A+ above', kind: 'cycle', val: () => Math.round(TEXT_SCALES[st.prefs.textIdx] * 100) + '%' },
        ...(st.demo ? [] : [{ row: 'restore', label: 'Restore purchase', kind: 'button', btn: 'Restore' }]),
        { row: 'reset', label: 'Reset journal and best score', hint: st.confirmReset ? 'Tap again to confirm' : 'Starts everything fresh', kind: 'button', btn: st.confirmReset ? 'Confirm' : 'Reset', danger: true },
      ];
      if (st.dev) rows.push({ row: 'devSilver', label: 'Dev: add 1000 silver', kind: 'button', btn: 'Add' }, { row: 'devDays', label: 'Dev: skip 10 days', kind: 'button', btn: 'Skip' });
      return { key: 'settings' + st.confirmReset + st.demo + st.dev, title: 'Settings', blocks: [{ p: 'Preferences are saved on this device.' }, ...rows] };
    }
    if (sc === 'journal') return { key: 'journal' + st.journalTab, rev: (st.S?.day ?? 0) + st.meta.cities.length * 31 + st.meta.people.length * 7 + (st.S?.j.cities.length ?? 0) * 3 + (st.S?.j.people.length ?? 0) * 5, title: 'Journal',
      tabs: [{ id: 'cities', label: 'Cities' }, { id: 'goods', label: 'Goods' }, { id: 'people', label: 'People' }, { id: 'ledger', label: 'Ledger' }], tab: st.journalTab, blocks: journalBlocks(st.journalTab, st.S, st.meta) };
    return null;
  }
  const isDoc = (sc) => sc === 'rules' || sc === 'about' || sc === 'howto' || sc === 'settings' || sc === 'journal';
  const setText = (i) => { const max = docMetrics.max || 1; st.docFrac = max > 0 ? st.docScroll / max : 0; st.prefs.textIdx = clamp(i, 0, TEXT_SCALES.length - 1); applyPrefs(); st.docRescale = true; savePrefs(); };
  async function buyFull() { const r = await m.purchase('unlock_game'); if (r?.ok) toast('Unlocked. Thank you!'); else if (r?.reason === 'demo') toast('Get the full game on iPhone and Android.'); else toast('The purchase did not go through.', 'bad'); refreshOwned(); }
  async function restoreBuy() { await m.restore?.(); refreshOwned(); toast(st.owned ? 'Purchase restored.' : 'Nothing to restore.'); }
  function docHit(id) {
    if (id === 'back') { snd('tap'); const to = st.backTo ?? 'title'; st.backTo = 'title'; go(to); return; }
    if (id === 'textDec') { setText(st.prefs.textIdx - 1); return; } if (id === 'textInc') { setText(st.prefs.textIdx + 1); return; }
    if (id === 'prev') { st.page = Math.max(0, st.page - 1); st.docScroll = 0; snd('tap'); return; }
    if (id === 'next') { if (st.page < RULES.length - 1) { st.page += 1; st.docScroll = 0; snd('tap'); } else docHit('back'); return; }
    if (id.startsWith('tab:')) { st.journalTab = id.slice(4); st.docScroll = 0; snd('tap'); return; }
    if (id === 'set:sound') { st.prefs.sound = !st.prefs.sound; applyPrefs(); savePrefs(); return; }
    if (id === 'set:thinkDec') { st.prefs.think = clamp(st.prefs.think - 1, THINK_MIN, THINK_MAX); savePrefs(); return; }
    if (id === 'set:thinkInc') { st.prefs.think = clamp(st.prefs.think + 1, THINK_MIN, THINK_MAX); savePrefs(); return; }
    if (id === 'set:zoomRow') { setText((st.prefs.textIdx + 1) % TEXT_SCALES.length); return; }
    if (id === 'set:unlock') { buyFull(); return; } if (id === 'set:restore') { restoreBuy(); return; }
    if (id === 'set:reset') { if (!st.confirmReset) { st.confirmReset = true; return; } st.confirmReset = false; st.meta = { cities: [], people: [], goods: {} }; st.best = { score: 0, rank: '', journeys: 0 }; storage.set('meta', st.meta); storage.set('best', st.best); storage.remove('save'); st.hasSave = false; toast('Progress reset.'); return; }
    if (id === 'set:devSilver' && st.dev && st.S) st.S.silver += 1000;
    if (id === 'set:devDays' && st.dev && st.S && !st.S.trip) { st.S.day += 10; E.passDays(st.S, 10); }
  }

  // ---- title / menu ---------------------------------------------------------------------------------------------------------------------------------------------
  const menuItems = () => {
    const a = [{ id: 'new', label: st.hasSave ? 'New Journey' : 'Begin Journey', kind: st.hasSave ? 'quiet' : 'primary', icon: 'east' }];
    if (st.hasSave) a.unshift({ id: 'continue', label: 'Continue Journey', kind: 'primary', icon: 'play' });
    a.push({ id: 'learn', label: 'Watch and Learn', kind: 'quiet', icon: 'bulb' }, { id: 'journal', label: 'Journal', kind: 'quiet', icon: 'book' }, { id: 'howto', label: 'How to Play', kind: 'quiet' }, { id: 'rules', label: 'Rules', kind: 'quiet' }, { id: 'about', label: 'About', kind: 'quiet' }, { id: 'settings', label: 'Settings', kind: 'quiet', icon: 'gear' });
    return a;
  };
  function menuHit(id) {
    snd('tap');
    if (id === 'new') newJourney(); else if (id === 'continue') continueJourney(); else if (id === 'learn') startLesson();
    else if (id === 'journal') go('journal', 'title'); else if (id === 'howto') go('howto', 'title'); else if (id === 'rules') { st.page = 0; go('rules', 'title'); }
    else if (id === 'about') go('about', 'title'); else if (id === 'settings') go('settings', 'title');
  }

  // ---- input ----------------------------------------------------------------------------------------------------------------------------------------------------
  let drag = null;
  function scrollBy(dy) { if (isDoc(st.scene)) st.docScroll = clamp(st.docScroll + dy, 0, docMetrics.max); else if (ui.scrollRect) st.psc = clamp((st.psc ?? 0) + dy, 0, st.pmax ?? 0); }
  function menuOverlayHit(id) {
    if (id === 'mResume') st.menu = false;
    else if (id === 'mSettings') { st.menu = false; go('settings', 'journey'); } else if (id === 'mRules') { st.menu = false; st.page = 0; go('rules', 'journey'); }
    else if (id === 'mQuit') { st.menu = false; if (st.auto) endLesson('title'); else { saveJourney(); go('title'); } }
    else if (id === 'mEnd') { st.menu = false; finish('settled'); }
  }
  function onHit(h) {
    const id = h.id, sc = st.scene;
    if (id === 'noop') return;
    if (sc === 'title') { if (id.startsWith('menu:')) menuHit(id.slice(5)); else if (id === 'credit') env.openArcforgeHome?.(); return; }
    if (isDoc(sc)) { docHit(id); return; }
    if (sc === 'map') { if (id === 'back') go(st.mapBack ?? 'journey'); return; }
    if (sc === 'result') { if (id === 'resNew') newJourney(); else if (id === 'resJournal') go('journal', 'result'); else if (id === 'resMenu') go('title'); return; }
    if (sc === 'demo-limit') { if (id === 'demoBack') { if (st.auto) endLesson(); else go('title'); } return; }
    if (sc === 'lesson-end') { if (id === 'leStart') { endLesson('title'); newJourney(); } else if (id === 'leAgain') { endLesson('title'); startLesson(); } else if (id === 'leMenu') endLesson('title'); return; }
    if (sc !== 'journey') return;
    if (id.startsWith('hud:')) { const k = id.slice(4); if (k === 'menu') st.menu = true; else if (k === 'map') { st.mapBack = 'journey'; go('map'); } else if (k === 'journal') go('journal', 'journey'); snd('tap'); return; }
    if (st.menu) { menuOverlayHit(id); return; }
    if (id === 'lessonPause') { st.auto.paused = !st.auto.paused; return; } if (id === 'lessonSkip') { lessonSkip(); return; } if (id === 'lessonExit') { endLesson('title'); return; }
    if (id === 'pause') { st.tv.paused = !st.tv.paused; return; } if (id === 'speed1') { st.tv.speed = 1; return; } if (id === 'speed3') { st.tv.speed = 3; return; }
    if (st.auto) return;
    if (st.ph === 'city') cityHit(id);
    else if (st.ph === 'event') { if (id.startsWith('choice:')) chooseEvent(Number(id.slice(7))); else if (id === 'think') think(); else if (id === 'hintClose') clearHint(); }
    else if (st.ph === 'outcome') { if (id === 'evContinue') afterEvent(); }
    else if (st.ph === 'arrive') { if (id === 'arrContinue') { st.ph = 'city'; st.tab = 'trade'; st.psc = 0; snd('tap'); } }
  }
  function onKey(keys) {
    const sc = st.scene;
    if (keys.pressed.has('Escape')) { if (isDoc(sc)) docHit('back'); else if (sc === 'journey') st.menu = !st.menu; else if (sc === 'map') go(st.mapBack ?? 'journey'); else if (sc === 'result') go('title'); }
    if (keys.pressed.has('KeyP') && st.auto) st.auto.paused = !st.auto.paused;
    if (keys.pressed.has('KeyH') && sc === 'journey' && !st.auto && !st.menu) think();
    if ((keys.pressed.has('Enter') || keys.pressed.has('Space')) && sc === 'journey' && !st.auto && !st.menu) { if (st.ph === 'outcome') afterEvent(); else if (st.ph === 'arrive') { st.ph = 'city'; st.tab = 'trade'; } }
    if (keys.pressed.has('ArrowDown')) scrollBy(80); if (keys.pressed.has('ArrowUp')) scrollBy(-80);
    if (sc === 'rules') { if (keys.pressed.has('ArrowRight')) docHit('next'); if (keys.pressed.has('ArrowLeft')) docHit('prev'); }
  }

  // ---- the frame ---------------------------------------------------------------------------------------------------------------------------------------------
  function update(dt, input) {
    st.t += dt; st.sceneT += dt;
    if (st.toast) { st.toast.t -= dt; if (st.toast.t <= 0) st.toast = null; }
    const p = input.pointer;
    if (p.pressed) drag = { x: p.x, y: p.y, s0: isDoc(st.scene) ? st.docScroll : st.psc ?? 0, moved: false, scrollable: isDoc(st.scene) ? !!(ui.view && inRect(ui.view, p.x, p.y)) : !!(ui.scrollRect && inRect(ui.scrollRect, p.x, p.y)) };
    let tap = null;
    if (drag && p.down && !p.released) { const dy = p.y - drag.y; if (Math.abs(dy) > 16) drag.moved = true; if (drag.moved && drag.scrollable) { if (isDoc(st.scene)) st.docScroll = clamp(drag.s0 - dy, 0, docMetrics.max); else st.psc = clamp(drag.s0 - dy, 0, st.pmax ?? 0); } }
    if (p.released && drag) { if (!drag.moved) tap = { x: drag.x, y: drag.y }; drag = null; }
    if (input.wheel && input.wheel.dy) scrollBy(input.wheel.dy);
    if (input.keys) onKey(input.keys);
    if (tap) { const h = hitTest(ui.hits, tap.x, tap.y); if (h) onHit(h); }
    if (st.scene === 'journey' && !st.menu) {
      if (st.auto) autoTick(dt);
      if (st.ph === 'travel' && st.S?.trip && !st.tv.paused && !(st.auto?.paused)) {
        st.tv.scroll += dt * 120 * st.tv.speed; st.tv.dayT += dt;
        const len = V.dayLen(st);
        while (st.tv.dayT >= len && st.ph === 'travel' && st.scene === 'journey') { st.tv.dayT -= len; stepTravel(); }
      }
    }
  }

  function renderMenuOverlay(ctx, L) {
    ui.hits.push({ id: 'noop', r: { x: 0, y: 0, w: L.w, h: L.h } });
    ctx.fillStyle = 'rgba(10,6,3,0.72)'; ctx.fillRect(0, 0, L.w, L.h);
    const w = Math.min(L.S.w - 40, 520), items = [['mResume', 'Resume', 'primary'], ['mRules', 'Rules', 'quiet'], ['mSettings', 'Settings', 'quiet'], ...(st.auto ? [] : [['mEnd', 'Settle here and end the journey', 'ghost']]), ['mQuit', st.auto ? 'Leave Watch and Learn' : 'Save and go to the main menu', 'quiet']];
    const bh = Math.max(76, L.mb), total = items.length * (bh + 12) + 28, r = { x: L.S.x + (L.S.w - w) / 2, y: L.S.y + Math.max(20, (L.S.h - total) / 2), w, h: total };
    panel(ctx, r, { fill: 'rgba(24,16,11,0.96)' });
    items.forEach(([id, label, kind], i) => { const b = { x: r.x + 20, y: r.y + 20 + i * (bh + 12), w: w - 40, h: bh }; button(ctx, b, label, { kind, size: 28 }); ui.hits.push({ id, r: b }); });
  }
  function lessonBar(ctx, L, rect) {
    const A_ = st.auto, h = Math.max(78, L.mb + 12), stage = A_.stage;
    ctx.fillStyle = 'rgba(40,26,14,0.96)'; rrect(ctx, { x: rect.x, y: rect.y, w: rect.w, h }, 16); ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(224,160,48,0.7)'; rrect(ctx, { x: rect.x, y: rect.y, w: rect.w, h }, 16); ctx.stroke();
    const bs = h - 10, ex = { x: rect.x + rect.w - bs - 8, y: rect.y + 5, w: bs, h: bs }, sk = { x: ex.x - bs - 8, y: ex.y, w: bs, h: bs }, pa = { x: sk.x - bs - 8, y: ex.y, w: bs, h: bs };
    button(ctx, pa, '', { icon: A_.paused ? 'play' : 'pause', kind: A_.paused ? 'primary' : 'quiet', noShadow: true }); button(ctx, sk, '', { icon: 'skip', kind: 'quiet', noShadow: true }); button(ctx, ex, '', { icon: 'back', kind: 'quiet', noShadow: true });
    ui.hits.push({ id: 'lessonPause', r: pa }, { id: 'lessonSkip', r: sk }, { id: 'lessonExit', r: ex });
    txt(ctx, 'WATCH AND LEARN', rect.x + 16, rect.y + h * 0.28, 21, PAL.gold, { weight: 800 });
    let x = rect.x + 16; const y = rect.y + h * 0.72;
    [['think', 'Think'], ['reveal', 'Reveal'], ['act', 'Act']].forEach(([id, label]) => { const on = (id === stage && st.ph !== 'outcome') || (id === 'act' && st.ph === 'outcome'); const r = chip(ctx, x, y, label, 21, { fill: on ? PAL.amber : 'rgba(255,240,215,0.08)', color: on ? '#1d1209' : PAL.dim }); x += r.w + 6; });
    const bw = pa.x - x - 16;
    if (A_.paused) txt(ctx, 'Paused', x + 4, y, 22, PAL.warn, { weight: 800 });
    else if (bw > 40 && (st.ph === 'city' || st.ph === 'event')) bar(ctx, { x, y: y - 6, w: bw, h: 12 }, A_.t / (stage === 'think' ? thinkSecs() : REVEAL_SEC), PAL.amber);
    return h + 8;
  }
  function renderLessonEnd(ctx, L, t) {
    ui.hits = []; const A_ = st.auto, S = st.S, C = CITIES[S.city];
    paintScene(ctx, { x: 0, y: 0, w: L.w, h: L.h }, { biome: C.biome, time: 'dusk', city: C.skyline, caravan: { n: 4, dir: -1, still: true, x: 0.5, loads: [['silk']], kind: C.camel }, zoom: 0.8 }, t);
    ctx.fillStyle = 'rgba(14,8,4,0.55)'; ctx.fillRect(0, 0, L.w, L.h);
    const w = Math.min(L.S.w - 32, 640), bh = Math.max(76, L.mb), r = { x: L.S.x + (L.S.w - w) / 2, y: L.S.y + Math.max(16, L.S.h * 0.08), w, h: Math.min(L.S.h - 32, 460 + bh * 3 + 40) };
    panel(ctx, r, { fill: 'rgba(24,16,11,0.95)' });
    txt(ctx, 'Lesson complete', r.x + w / 2, r.y + 54, 40, PAL.gold, { align: 'center', font: DISPLAY, weight: 800, maxW: w - 40 });
    ctx.font = `500 26px ${UI}`; ctx.fillStyle = PAL.text; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    const text = `The trader reached ${C.name} on day ${S.day} with ${S.silver} silver (from 800), after ${A_?.n ?? 0} decisions. Goods were bought where they are cheap and sold where they are dear, supplies were sized to each road, and every encounter was settled by weighing the odds against the costs.`;
    wrap(ctx, text, w - 60).forEach((ln, i) => ctx.fillText(ln, r.x + w / 2, r.y + 100 + i * 36));
    const b1 = { x: r.x + 30, y: r.y + r.h - bh * 3 - 40, w: w - 60, h: bh }, b2 = { x: r.x + 30, y: b1.y + bh + 10, w: w - 60, h: bh }, b3 = { x: r.x + 30, y: b2.y + bh + 10, w: w - 60, h: bh };
    button(ctx, b1, 'Start my own journey', { kind: 'primary', size: 29 }); button(ctx, b2, 'Watch again', { kind: 'quiet', size: 27 }); button(ctx, b3, 'Main menu', { kind: 'quiet', size: 27 });
    ui.hits.push({ id: 'leStart', r: b1 }, { id: 'leAgain', r: b2 }, { id: 'leMenu', r: b3 });
  }

  // The kit's "Preview 0:42" pill sits where it does not cover the day and silver chips: bottom right of the painting.
  function badge(L) {
    if (st.scene === 'journey') { const G = L.split(st.ph === 'travel' ? 'travel' : st.ph === 'event' || st.ph === 'outcome' ? 'event' : 'city'); meta.previewBadge = { x: G.art.x + G.art.w - 16, y: G.art.y + G.art.h - 30, align: 'right' }; }
    else meta.previewBadge = { x: L.w - 16, y: L.h - 30, align: 'right' };
  }

  function render(ctx) {
    const L = layoutFor(meta.width, meta.height, menuItems().length);
    ctx.clearRect?.(0, 0, meta.width, meta.height);
    const t = st.t, sc = st.scene;
    ui.hits = []; ui.scrollRect = null; ui.view = null;
    st.lessonH = st.auto ? Math.max(78, L.mb + 12) + 8 : 0;
    badge(L);
    if (sc === 'title') V.renderTitle(ctx, st, L, t, menuItems());
    else if (isDoc(sc)) { const g = ctx.createLinearGradient(0, 0, 0, L.h); g.addColorStop(0, '#2b1a10'); g.addColorStop(1, '#120a06'); ctx.fillStyle = g; ctx.fillRect(0, 0, L.w, L.h); renderDoc(ctx, st, L, docFor(), FIG); }
    else if (sc === 'map') V.renderMap(ctx, st, L, t);
    else if (sc === 'result') V.renderResult(ctx, st, L, t);
    else if (sc === 'demo-limit') V.renderDemoLimit(ctx, st, L, t);
    else if (sc === 'lesson-end') renderLessonEnd(ctx, L, t);
    else if (sc === 'journey') {
      if (st.ph === 'city') V.renderCity(ctx, st, L, t); else if (st.ph === 'travel') V.renderTravel(ctx, st, L, t); else if (st.ph === 'event' || st.ph === 'outcome') V.renderEvent(ctx, st, L, t); else V.renderArrive(ctx, st, L, t);
      if (st.auto) { const G = L.split(st.ph === 'travel' ? 'travel' : st.ph === 'event' || st.ph === 'outcome' ? 'event' : 'city'); lessonBar(ctx, L, { x: G.panel.x + 12, y: G.panel.y + 10, w: G.panel.w - 24 }); }
      if (st.menu) renderMenuOverlay(ctx, L);
    }
    if (st.toast) chip(ctx, L.w / 2, L.h - Math.max(120, L.S.y + L.S.h * 0.12), st.toast.msg, 25, { align: 'center', fill: st.toast.kind === 'bad' ? 'rgba(120,30,24,0.95)' : 'rgba(20,12,8,0.94)', color: st.toast.kind === 'bad' ? '#ffd0c8' : PAL.text, stroke: 'rgba(255,230,190,0.35)' });
  }

  // ---- dev tools (screenshots and tests) ---------------------------------------------------------------------------------------------------------------
  const dev = {
    jump(spec = {}) {
      const city = spec.city ?? 0;
      if (spec.scene === 'title' || !spec.scene) { go('title'); return; }
      if (isDoc(spec.scene)) { st.S ??= E.newJourney(createRng(5)); for (const p of ['lu', 'zhao', 'mahan', 'tamar', 'lian', 'vakhu']) if (!st.S.j.people.includes(p)) st.S.j.people.push(p); st.page = spec.page ?? 0; if (spec.tab) st.journalTab = spec.tab; if (spec.text !== undefined) { st.prefs.textIdx = spec.text; applyPrefs(); } go(spec.scene, 'title'); return; }
      const S = E.newJourney(createRng(spec.seed ?? 5)); st.S = S; st.auto = null;
      for (let c = 0; c <= city; c++) { if (!S.j.cities.includes(c)) S.j.cities.push(c); E.noteLedger(S, c); }
      S.city = city; S.day = spec.day ?? city * 10; E.noteLedger(S, city);
      S.silver = spec.silver ?? 640; S.camels = spec.camels ?? 4; S.guards = spec.guards ?? 1; S.str = spec.str ?? 78; S.water = spec.water ?? 36; S.food = spec.food ?? 30; S.rep = spec.rep ?? 34; S.customs = spec.customs ?? 3; S.tongues = spec.tongues ?? 2;
      S.goods.silk = spec.silk ?? 8; S.goods.paper = spec.paper ?? 3; S.goods.jade = spec.jade ?? 0;
      for (const p of ['lu', 'zhao', 'mahan', 'tamar']) if (!S.j.people.includes(p)) S.j.people.push(p);
      S.j.goods.silk.bought = 8; S.j.goods.silk.sold = 2;
      st.ph = spec.ph ?? 'city'; st.tab = spec.tab ?? 'trade'; st.psc = 0; st.hint = null; st.menu = !!spec.menu; st.step = spec.step ?? 1;
      if (spec.news) S.news[city] = { good: 'silk', mult: 1.25, until: S.day + 8, text: 'A wedding season: buyers are paying more for silk.' };
      if (st.ph === 'travel' || st.ph === 'event' || st.ph === 'outcome') {
        const to = spec.to ?? city + 1; S.dir = to > city ? 1 : -1; E.depart(S, rj, to, spec.alt ? 'alt' : 'main', spec.pace ?? 'steady');
        S.trip.day = spec.tday ?? Math.floor(S.trip.days * 0.4); st.tv = { scroll: spec.scroll ?? 900, dayT: 0, speed: 1, paused: !!spec.pause };
        if (st.ph !== 'travel') { st.ev = { id: spec.ev ?? 'bandits', res: null }; if (st.ph === 'outcome') st.ev.res = E.resolveChoice(S, createRng(3), EVENT_BY_ID[st.ev.id], spec.choice ?? 1) ?? { text: 'Done.', chips: [], win: null }; }
      }
      if (st.ph === 'arrive') st.arr = { first: true, custom: CITIES[city].custom, news: spec.news ? 'A wedding season: buyers are paying more for silk.' : null, city };
      if (spec.scene === 'map') { st.mapBack = 'journey'; go('map'); return; }
      if (spec.scene === 'result') { st.ph = 'city'; finish('settled'); return; }
      if (spec.scene === 'lesson') { startLesson(); st.S = S; st.auto.stage = spec.stage ?? 'think'; st.ph = spec.ph ?? 'city'; if (spec.stage === 'reveal') { st.auto.step = A.advise(S, { goal: 5 }); autoReveal(); } return; }
      if (spec.scene === 'lesson-end') { startLesson(); st.S = S; st.auto.done = true; go('lesson-end'); return; }
      go('journey');
      if (spec.hintEv && st.ev) { const a = A.adviseChoice(S, EVENT_BY_ID[st.ev.id]); st.hint = { act: 'choice', i: a.i, label: a.label, why: a.why }; }
      if (spec.hint) think();
    },
  };

  return {
    update, render,
    getState: () => st,
    // Everything except real play is free of the preview timer: menus, Rules, About, Journal, the map, Watch and Learn, results.
    isPreviewExempt() { return !(st.scene === 'journey' && !st.auto && !st.menu); },
    autoPause() { if (st.auto) st.auto.paused = true; if (st.tv) st.tv.paused = true; },
    touch() { return false; },
    dev,
  };
}

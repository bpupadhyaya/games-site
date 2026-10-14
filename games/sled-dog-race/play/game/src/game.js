// Sled Dog Race: the game shell. Scenes, input (one thumb), persistence, preview wiring, the Trail Cup, Trail Run, Practice, Learn drills,
// Watch & Learn and the Think hint. One race lives in sim.js (pure, fixed steps); the picture lives in scene.js and hud.js and only reads
// the state exposed here.
import {
  createRace, makeAi, aiControl, thinkDue, planPace, carePlan, idealFor, rivalAt, rivalFinish, careScore, gaitOf, elev, slopeAt, windowOf, freshDogs,
} from './sim.js';
import { live, syncSize, sizeKey, TEXT_SCALES, refLayout, setupPins, inRect, playLayout, stopLayout } from './layout.js';
import { setPress } from './ui.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import * as MN from './menus.js';
import { renderHud, watchRects, goRect, ACTIONS, fmtClock } from './hud.js';
import { drawScene, makeCam } from './scene.js';
import { v3 } from './v3.js';
import {
  RACES, RIVALS, LESSONS, TRAIL_LIVES, THINK_STEPS, STAR_CARE, HINT_COST, LEG_STRIKE, STEEP, CARE, trailLeg, DOGS, VIS,
} from './consts.js';

export const meta = { width: 720, height: 1280, fluid: { short: 720 } };
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const DEMO_LEG_CAP = 5;
const KEY_PACE = 0.55;

export function createGame(env) {
  const { rng, audio, storage, config } = env;
  const demo = !!config.demo;
  const G = {
    scene: 'title', mode: 'none', demo, loaded: false, dev: !!config.dev, t: 0,
    settings: { textIdx: 0, sound: true, thinkIdx: 1, guide: 0 },
    setup: { mode: 'cup', race: 0 },
    progress: { stars: [0, 0, 0, 0, 0], best: 0, drills: {}, demoLegs: 0, cups: 0 },
    ui: { scroll: 0, drag: null }, back: 'title', setupMsg: '', restoreMsg: '',
    round: null, run: null, legs: [], rivals: [], place: 0, ghost: null,
    paused: false, pauseMenu: false, think: null, thinkRects: null, hintMsg: '', plan: null,
    watch: { phase: 'ready', timer: 0, total: 1, paused: false, lines: [], ai: null, queue: null },
    resultInfo: null, learnCur: 0, drillResult: null, drill: null,
    c: { paceGrab: false, brakeAt: -9, brakeWas: false }, cam: null, lastMode: 'cup', brakeOn: false,
    cue: null, callLit: null, selDog: -1, stopMsg: '', stopMsgT: 0, hasNextLeg: false, nextLen: 0, praiseT: 0, camE: 0, coachFrom: 0,
    legTarget: 0, legCarried0: 0, look: 1,
  };
  let evSeen = 0, lastSize = '';
  const bg = { run: null, ai: null };
  const idealCache = new Map();
  const idealOf = (idx) => { if (!idealCache.has(idx)) idealCache.set(idx, idealFor({ legs: RACES[idx].legs })); return idealCache.get(idx); };

  // ---- persistence --------------------------------------------------------------------------------------------------------
  const saveAll = () => { storage.set('settings', G.settings); storage.set('progress', G.progress); storage.set('setup', G.setup); };
  Promise.all([storage.get('settings', null), storage.get('progress', null), storage.get('setup', null)]).then(([s, p, su]) => {
    if (s) Object.assign(G.settings, s);
    if (p) {
      if (Array.isArray(p.stars)) G.progress.stars = RACES.map((_, i) => clamp(p.stars[i] | 0, 0, 3));
      G.progress.best = p.best | 0; G.progress.drills = p.drills && typeof p.drills === 'object' ? p.drills : {};
      G.progress.demoLegs = p.demoLegs | 0; G.progress.cups = p.cups | 0;
    }
    if (su) { G.setup.mode = ['cup', 'trail', 'practice', 'watch'].includes(su.mode) ? su.mode : 'cup'; G.setup.race = clamp(su.race | 0, 0, RACES.length - 1); }
    G.settings.textIdx = clamp(G.settings.textIdx | 0, 0, TEXT_SCALES.length - 1);
    G.settings.thinkIdx = clamp(G.settings.thinkIdx | 0, 0, THINK_STEPS.length - 1);
    G.settings.guide = clamp(G.settings.guide | 0, 0, 2);
    G.loaded = true; MN.invalidateLayout(); audio.setMuted?.(!G.settings.sound);
  });

  // ---- sound --------------------------------------------------------------------------------------------------------------
  const tone = (o) => { if (G.settings.sound) audio.tone(o); };
  const sfx = {
    tick: () => tone({ freq: 820, dur: 0.04, type: 'triangle', vol: 0.05 }),
    bells: (q) => [0, 7, 12].forEach((k, i) => tone({ freq: 1320 * Math.pow(2, (k + q) / 12), dur: 0.05, type: 'sine', vol: 0.025 - i * 0.004 })),
    call: () => tone({ freq: 440, to: 520, dur: 0.1, type: 'triangle', vol: 0.07 }),
    good: () => [0, 4, 7].forEach((k, i) => tone({ freq: 523 * Math.pow(2, k / 12), dur: 0.12 + i * 0.04, type: 'triangle', vol: 0.08 })),
    bad: () => tone({ freq: 220, to: 110, dur: 0.22, type: 'sawtooth', vol: 0.07 }),
    thud: () => { tone({ freq: 160, to: 60, dur: 0.18, type: 'triangle', vol: 0.2 }); },
    yip: () => tone({ freq: 700, to: 1000, dur: 0.1, type: 'triangle', vol: 0.06 }),
    care: () => [0, 7].forEach((k, i) => tone({ freq: 660 * Math.pow(2, k / 12), dur: 0.12 + i * 0.05, type: 'sine', vol: 0.07 })),
    finish: () => [0, 4, 7, 12].forEach((k, i) => tone({ freq: 523 * Math.pow(2, k / 12), dur: 0.22 + i * 0.04, type: 'triangle', vol: 0.09 })),
    go: () => tone({ freq: 440, to: 660, dur: 0.12, type: 'triangle', vol: 0.08 }),
    sad: () => tone({ freq: 330, to: 250, dur: 0.3, type: 'triangle', vol: 0.06 }),
  };
  const delayed = [];
  const later = (f, t = 0.3) => delayed.push({ t, f });

  // ---- races --------------------------------------------------------------------------------------------------------------
  const blankRound = (idx, name) => ({ idx, name, score: 0, strikes: 0, legsDone: 0, over: false });
  function setupRivals(idx) {
    const R = RACES[idx], ideal = idealOf(idx);
    G.rivals = RIVALS.map((r) => ({ name: r.name, col: r.col, skill: Math.max(0.5, R.skill + r.d), ideal }));
    G.legs = R.legs;
  }
  function legTargetFor(spec) {
    const o = idealFor({ legs: [spec] });
    return o.legTimes[0] * LEG_STRIKE + 2;
  }
  function startRace(mode, opts = {}) {
    const st = G.setup;
    const idx = opts.idx ?? st.race;
    if (demo && (mode === 'cup' || mode === 'watch' || mode === 'practice') && idx > 1) { G.setupMsg = 'The web demo has the first two races.'; return; }
    if (demo && mode === 'trail' && G.progress.demoLegs >= DEMO_LEG_CAP) { G.scene = 'demolimit'; G.ui.scroll = 0; MN.invalidateLayout(); return; }
    G.mode = mode; G.lastMode = mode;
    G.drill = null; G.rivals = []; G.legs = []; G.place = 0;
    if (mode === 'trail') {
      G.round = blankRound(0, 'Trail Run');
      G.run = createRace({ legAt: trailLeg, legCount: Infinity });
      G.look = trailLeg(0).look;
    } else if (mode === 'drill') {
      const l = LESSONS[G.learnCur];
      G.round = blankRound(0, l.title);
      const legs = l.legs || [l.leg];
      G.run = createRace({ legs });
      G.legs = legs; G.look = l.look;
      G.drill = { id: l.id, title: l.title, goal: l.goal };
    } else {
      G.round = blankRound(idx, RACES[idx].name);
      setupRivals(idx);
      G.run = createRace({ legs: RACES[idx].legs });
      G.look = RACES[idx].look;
    }
    G.watch = { phase: 'ready', timer: 0, total: 1, paused: false, lines: [], ai: makeAi({ reserve: 0.5 }), queue: null, qT: 0 };
    afterLegStart(true);
    evSeen = 0;
    G.scene = 'play'; G.paused = false; G.pauseMenu = false; G.ui.scroll = 0; G.resultInfo = null; G.think = null; G.plan = null; G.hintMsg = '';
    G.brakeOn = false; G.c.paceGrab = false; G.selDog = -1; G.coachFrom = G.t;
    MN.invalidateLayout();
  }
  function afterLegStart(first) {
    const s = G.run.s;
    G.camE = elev(s.L, 6);
    G.legCarried0 = s.carried;
    G.nextLen = 0; G.hasNextLeg = s.leg + 1 < s.legCount;
    if (G.hasNextLeg) G.nextLen = G.run.legSpec(s.leg + 1).len;
    if (G.mode === 'trail') {
      G.look = s.L.look ?? 1;
      G.legTarget = legTargetFor(G.run.legSpec(s.leg));
    }
    G.watch.ai.legSeen = -1;
    G.brakeOn = false; G.hintMsg = ''; G.think = null; G.plan = null;
    s.pace = first ? 0.5 : s.pace;
  }

  // ---- the hint: what to do next, in words ---------------------------------------------------------------------------------
  const pctS = (v) => `${Math.round(v * 100)}%`;
  function planFor(forWatch, kind) {
    const run = G.run, s = run.s, L = s.L, who = forWatch ? 'the driver' : 'you';
    const lines = [];
    let span = null;
    if (s.phase === 'stop') {
      const next = run.legSpec(s.leg + 1);
      const cp = carePlan(s, next);
      if (!cp.length) lines.push('Every dog is in good shape. Leave the checkpoint when you are ready.');
      else cp.slice(0, 5).forEach((a) => lines.push(`${CARE[a.action].name}${a.idx >= 0 ? ` (${DOGS[a.idx].name})` : ' (whole team)'}: ${a.why}.`));
      if (cp.length > 5) lines.push(`...and ${cp.length - 5} more.`);
      const need = (next.rough || []).length ? 'There is rough ice on the next leg, so paws and booties matter.' : 'The next leg has no rough ice.';
      lines.push(need);
      return { lines, span, care: cp };
    }
    const wk = s.dogs.filter((d) => !d.riding);
    const mean = wk.length ? wk.reduce((a, d) => a + d.e, 0) / wk.length : 0;
    const rem = Math.max(0, L.len - s.x);
    const slope = slopeAt(L, s.x);
    const j = L.jx.find((q) => q.state === 'ahead');
    const steepA = L.steep.find(([a, b]) => b > s.x);
    const wantJunction = kind === 'junction' || (!kind && j && j.x - s.x < L.vis + 20 && (!steepA || j.x < steepA[0]));
    const wantHill = kind === 'hill' || (!kind && !wantJunction && steepA && steepA[0] - s.x < 70);
    if (kind === 'plan' || !kind) {
      const p = planPace(s, forWatch ? 0.5 : 0.45);
      lines.push(`${wk.length} ${wk.length === 1 ? 'dog is' : 'dogs are'} pulling at ${pctS(mean)} average energy with ${Math.round(rem)} metres to the ${s.leg + 1 >= s.legCount ? 'finish' : 'checkpoint'}.`);
      lines.push(`${forWatch ? 'The driver sets' : 'A good pace now is'} a ${gaitOf(p).toLowerCase()} (about ${pctS(p)} on the lever): quick enough, and the team still arrives with energy in hand.`);
      if (L.rough.length) lines.push('Part of this leg is rough ice: paws wear faster there.');
    }
    if (wantJunction && j) {
      const d = Math.round(j.x - s.x);
      lines.push(`A junction sign is ${d} metres ahead. It points ${j.dir === 'R' ? 'Gee, right' : 'Haw, left'}.`);
      lines.push(`${forWatch ? 'The driver calls' : 'Call'} ${j.dir === 'R' ? 'Gee' : 'Haw'} as soon as the marker lights up, about ${Math.round(windowOf(L))} metres before the sign. ${run.callsNeeded() > 1 ? 'The leaders are not happy, so it may take two calls.' : ''}`);
      span = [j.x - windowOf(L), j.x];
    }
    if (wantHill && steepA) {
      lines.push(`A steep downhill starts in ${Math.max(0, Math.round(steepA[0] - s.x))} metres.`);
      lines.push(`${forWatch ? 'The driver puts' : 'Put'} the brake down before it so the sled does not run into the wheel dogs, then lift it at the bottom.`);
      span = span || [steepA[0], steepA[1]];
    }
    if (!kind && lines.length < 3) {
      const thirsty = wk.filter((d) => d.w < 0.45).length, sore = wk.filter((d) => d.pw < 0.5).length;
      if (thirsty) lines.push(`${thirsty} ${thirsty === 1 ? 'dog is' : 'dogs are'} thirsty: water at the checkpoint.`);
      if (sore) lines.push(`${sore} ${sore === 1 ? 'dog has' : 'dogs have'} sore paws: fit booties at the checkpoint.`);
      if (slope > 0.06) lines.push('On a climb the team tires faster: do not spend too much here.');
    }
    return { lines, span };
  }
  function openThink() {
    const s = G.run.s;
    if (s.phase === 'finished' || s.phase === 'ready') return;
    const p = planFor(false);
    G.think = { lines: [...p.lines, `Using the hint adds ${HINT_COST} second to this leg.`] };
    G.plan = p.span ? { span: p.span, col: '#ffd54a' } : null;
    if (!s.hinted) { s.hinted = true; s.hintCost = HINT_COST; }
    G.c.paceGrab = false;
  }

  // ---- the end of a race --------------------------------------------------------------------------------------------------
  function endRace() {
    const R = G.round, s = G.run.s;
    if (R.over) return;
    R.over = true;
    const care = careScore(s);
    const info = { stars: 0, newStar: false, canNext: false, place: 0, time: s.clock, care, careAward: care >= STAR_CARE, carried: s.carried, detours: s.detours, times: [] };
    if (G.mode === 'cup' || G.mode === 'watch' || G.mode === 'practice') {
      const rt = G.rivals.map((r) => ({ name: r.name, time: rivalFinish(r.ideal, r.skill) }));
      const me = { name: G.mode === 'watch' ? 'The driver' : 'You', time: s.clock, me: true };
      const all = [...rt, me].sort((a, b) => a.time - b.time);
      info.place = 1 + rt.filter((r) => r.time < s.clock).length;
      info.times = all;
      if (G.mode === 'cup') {
        info.stars = info.place <= 2 ? 1 + (info.place === 1 ? 1 : 0) + (info.place === 1 && info.careAward ? 1 : 0) : 0;
        if (info.stars > G.progress.stars[R.idx]) { G.progress.stars[R.idx] = info.stars; info.newStar = true; }
        info.canNext = info.place <= 2 && R.idx < RACES.length - 1 && !(demo && R.idx + 1 > 1);
        G.progress.cups++;
      }
    } else if (G.mode === 'drill') {
      const l = LESSONS[G.learnCur];
      let ok = false;
      if (l.mode === 'pace') { const o = idealOfLeg(l.leg); ok = s.carried === 0 && s.clock <= o * 1.2; }
      else if (l.mode === 'calls') ok = s.detours === 0;
      else if (l.mode === 'care') ok = care >= 0.6;
      if (ok) G.progress.drills[l.id] = true;
      G.drillResult = { pass: ok, care, time: s.clock, detours: s.detours };
    }
    G.resultInfo = info;
    saveAll();
    sfx.finish();
    later(() => { if (G.round && G.round.over) { G.scene = G.mode === 'drill' ? 'lessonresult' : 'result'; G.ui.scroll = 0; MN.invalidateLayout(); } }, 1.6);
  }
  const legIdealCache = new Map();
  const idealOfLeg = (leg) => { const k = JSON.stringify(leg); if (!legIdealCache.has(k)) legIdealCache.set(k, idealFor({ legs: [leg] }).time); return legIdealCache.get(k); };
  function endTrail() {
    const R = G.round; R.over = true;
    const info = { newBest: false };
    if (R.score > G.progress.best) { G.progress.best = R.score; info.newBest = true; }
    G.resultInfo = info; saveAll(); sfx.sad();
    later(() => { if (G.round && G.round.over) { G.scene = 'result'; G.ui.scroll = 0; MN.invalidateLayout(); } }, 1.0);
  }

  // ---- events -> sound and flow -------------------------------------------------------------------------------------------
  function processEvents() {
    const s = G.run.s;
    for (const e of s.events) {
      if (e.id < evSeen) continue;
      evSeen = e.id + 1;
      if (e.type === 'start') sfx.go();
      else if (e.type === 'call') sfx.call();
      else if (e.type === 'junction') { if (e.ok) sfx.good(); else sfx.bad(); }
      else if (e.type === 'overrun') sfx.thud();
      else if (e.type === 'tired') sfx.sad();
      else if (e.type === 'rejoin') sfx.yip();
      else if (e.type === 'praise') { sfx.yip(); G.praiseT = 1; }
      else if (e.type === 'care') sfx.care();
      else if (e.type === 'checkpoint') onCheckpoint();
      else if (e.type === 'finish') { if (G.mode === 'trail') {/* never reached: the trail has no end */} else endRace(); }
    }
    const q = Math.floor(s.stride * 2);
    if (s.phase === 'run' && s.v > 0.5 && q !== (G._st | 0)) { G._st = q; if (q % 3 === 0) sfx.bells(q % 5); }
  }
  function onCheckpoint() {
    const s = G.run.s, R = G.round;
    G.selDog = -1; G.stopMsg = ''; G.stopMsgT = 0; G.think = null; G.plan = null; G.brakeOn = false;
    R.legsDone++;
    G.hasNextLeg = s.leg + 1 < s.legCount;
    if (G.mode === 'trail') {
      const legTime = s.legTimes[s.legTimes.length - 1], carriedNow = s.carried - G.legCarried0;
      const over = legTime > G.legTarget || carriedNow > 0;
      if (over) R.strikes++; else R.score += 20 + Math.max(0, Math.round((G.legTarget - legTime) * 2)) + Math.round(careScore(s) * 20);
      if (demo) { G.progress.demoLegs++; saveAll(); }
      G.stopMsg = over ? `Strike: ${legTime.toFixed(0)} s against a target of ${G.legTarget.toFixed(0)} s${carriedNow ? ' and a dog was carried' : ''}.` : `On target: ${legTime.toFixed(0)} s (target ${G.legTarget.toFixed(0)} s).`;
      G.stopMsgT = 6;
      if (R.strikes >= TRAIL_LIVES || (demo && G.progress.demoLegs >= DEMO_LEG_CAP)) { endTrail(); return; }
    }
    sfx.finish();
  }

  // ---- input --------------------------------------------------------------------------------------------------------------
  const go = (scene) => { G.scene = scene; G.ui.scroll = 0; MN.invalidateLayout(); };
  function setText(v) { G.settings.textIdx = clamp(v, 0, TEXT_SCALES.length - 1); G.ui.scroll = 0; MN.invalidateLayout(); saveAll(); }
  function scrollFlow(ptr) {
    const d = G.ui.drag, mt = MN.flowMeta();
    d.moved = Math.max(d.moved, Math.abs(ptr.y - d.y0));
    if (d.moved >= 10 && mt.lay) { const max = Math.max(0, mt.lay.contentH - (mt.bottom - mt.top)); G.ui.scroll = clamp(d.s0 - (ptr.y - d.y0), 0, max); }
  }
  const updateFlowScene = (dt, input, handler, key) => {
    const ptr = input.pointer;
    if (key) MN.ensureLayout(G, key);
    if (ptr.pressed) G.ui.drag = { y0: ptr.y, x0: ptr.x, s0: G.ui.scroll, moved: 0 };
    if (G.ui.drag && ptr.down) scrollFlow(ptr);
    if (ptr.released && G.ui.drag) {
      const d = G.ui.drag; G.ui.drag = null;
      const lay = MN.flowMeta();
      const scrollable = lay.lay && lay.lay.contentH > lay.bottom - lay.top;
      if (d.moved < 10) handler(MN.hitScreen(ptr.x, ptr.y, G.ui.scroll));
      else if (!scrollable) handler(MN.hitScreen(d.x0, d.y0, G.ui.scroll));
    }
    const mt = MN.flowMeta();
    const max = mt.lay ? Math.max(0, mt.lay.contentH - (mt.bottom - mt.top)) : 0;
    if (input.keys.pressed.has('Equal') || input.keys.pressed.has('NumpadAdd')) setText(G.settings.textIdx + 1);
    if (input.keys.pressed.has('Minus') || input.keys.pressed.has('NumpadSubtract')) setText(G.settings.textIdx - 1);
    const wh = input.wheel ? input.wheel.dy : 0; if (wh) G.ui.scroll = clamp(G.ui.scroll + wh, 0, max);
    if (input.keys.down.has('ArrowDown')) G.ui.scroll = clamp(G.ui.scroll + 14, 0, max);
    if (input.keys.down.has('ArrowUp')) G.ui.scroll = clamp(G.ui.scroll - 14, 0, max);
  };
  const openSetup = (mode) => { G.setup.mode = mode; G.setupMsg = ''; go('setup'); };
  function handleTitle(id) {
    if (!id) return;
    sfx.tick();
    if (id === 'cup' || id === 'trail' || id === 'practice' || id === 'watch') openSetup(id);
    else if (id === 'learn') go('learn');
    else if (id === 'howto') { G.back = 'title'; go('howto'); }
    else if (id === 'rules') { G.back = 'title'; go('rules'); }
    else if (id === 'about') { G.back = 'title'; go('about'); }
    else if (id === 'settings') go('settings');
    else if (id === 'sound') { G.settings.sound = !G.settings.sound; audio.setMuted?.(!G.settings.sound); saveAll(); MN.invalidateLayout(); }
  }
  function handleSetup(id) {
    if (!id) return;
    const st = G.setup;
    sfx.tick();
    if (id.startsWith('rd')) { st.race = +id.slice(2); G.setupMsg = ''; MN.invalidateLayout(); saveAll(); }
    else if (id === 'start') {
      const open = st.mode === 'trail' || st.race === 0 || G.progress.stars[st.race - 1] > 0 || st.mode !== 'cup' || G.dev;
      if (!open) { G.setupMsg = 'Place in the top two in the race before it first.'; return; }
      startRace(st.mode);
    } else if (id === 'back') go('title');
  }
  function handleSettings(id) {
    if (!id) return;
    sfx.tick();
    const st = G.settings;
    if (id === 'set-sound') { st.sound = !st.sound; audio.setMuted?.(!st.sound); }
    else if (id === 'txt-dec') setText(st.textIdx - 1);
    else if (id === 'txt-inc') setText(st.textIdx + 1);
    else if (id === 'guide-dec') st.guide = Math.max(0, st.guide - 1);
    else if (id === 'guide-inc') st.guide = Math.min(2, st.guide + 1);
    else if (id === 'think-dec') st.thinkIdx = Math.max(0, st.thinkIdx - 1);
    else if (id === 'think-inc') st.thinkIdx = Math.min(THINK_STEPS.length - 1, st.thinkIdx + 1);
    else if (id === 'restore') { G.restoreMsg = 'Checking...'; env.monetization.restore().then(() => { G.restoreMsg = env.monetization.owns('unlock_game') ? 'Purchase restored.' : 'No earlier purchase found.'; MN.invalidateLayout(); }).catch(() => { G.restoreMsg = 'Could not reach the store.'; MN.invalidateLayout(); }); }
    else if (id === 'back') { go('title'); G.restoreMsg = ''; }
    saveAll(); MN.invalidateLayout();
  }
  function handleResult(id) {
    if (!id) return;
    sfx.tick();
    const m = G.lastMode === 'drill' || G.lastMode === 'shot' ? G.setup.mode : G.lastMode;
    if (id === 'next') startRace('cup', { idx: G.round.idx + 1 });
    else if (id === 'again') startRace(m, { idx: G.round ? G.round.idx : 0 });
    else if (id === 'new') openSetup(m);
    else if (id === 'menu') go('title');
  }
  function handleLearn(id) {
    if (!id) return;
    sfx.tick();
    if (id === 'back') go('title');
    else if (id.startsWith('lesson') && id !== 'lesson-go' && id !== 'lesson-back') { G.learnCur = +id.slice(6); go('lesson'); }
  }
  const startLesson = () => startRace('drill');
  function handleLesson(id) { if (!id) return; sfx.tick(); if (id === 'lesson-go') startLesson(); else if (id === 'lesson-back') go('learn'); }
  function handleLessonResult(id) {
    if (!id) return;
    sfx.tick();
    if (id === 'lr-again') startLesson();
    else if (id === 'lr-next') { G.learnCur = Math.min(LESSONS.length - 1, G.learnCur + 1); go('lesson'); }
    else if (id === 'lr-list') go('learn');
  }
  function leaveRace() {
    const m = G.mode, R = G.round;
    G.paused = false; G.pauseMenu = false; G.think = null; G.watch.paused = false;
    if (R) R.over = true;
    if (m === 'trail' && R && R.legsDone > 0) {
      const info = { newBest: false };
      if (R.score > G.progress.best) { G.progress.best = R.score; info.newBest = true; }
      G.resultInfo = info; saveAll(); go('result'); return;
    }
    go('title');
  }
  function handlePause(id) {
    if (!id) return;
    sfx.tick();
    if (id === 'resume') { G.paused = false; G.pauseMenu = false; }
    else if (id === 'p-rules') { G.back = 'play'; go('rules'); }
    else if (id === 'p-howto') { G.back = 'play'; go('howto'); }
    else if (id === 'p-sound') { G.settings.sound = !G.settings.sound; audio.setMuted?.(!G.settings.sound); saveAll(); }
    else if (id === 'p-txt-dec') setText(G.settings.textIdx - 1);
    else if (id === 'p-txt-inc') setText(G.settings.textIdx + 1);
    else if (id === 'quit') leaveRace();
    MN.invalidateLayout();
  }
  const refList = () => (G.scene === 'howto' ? [HOWTO, 'How to Play'] : G.scene === 'about' ? [ABOUT, 'About'] : [RULES, 'Rules']);
  const updatePages = (input) => {
    const [list, header] = refList(); MN.refPrepare(G, list, header);
    const ptr = input.pointer, keys = input.keys, rm = MN.refMeta(), view = rm.vh, R = refLayout();
    const close = () => { G.scene = G.back === 'play' ? 'play' : 'title'; G.ui.scroll = 0; G.ui.drag = null; MN.invalidateLayout(); };
    const setS = (v) => { G.ui.scroll = clamp(v, 0, rm.max); };
    const next = () => { if (G.ui.scroll >= rm.max - 4) close(); else setS(G.ui.scroll + view * 0.85); };
    const prev = () => { if (G.ui.scroll <= 4) close(); else setS(G.ui.scroll - view * 0.85); };
    if (ptr.pressed) {
      if (inRect(R.next, ptr.x, ptr.y)) next();
      else if (inRect(R.back, ptr.x, ptr.y)) prev();
      else if (inRect(R.dec, ptr.x, ptr.y)) setText(G.settings.textIdx - 1);
      else if (inRect(R.inc, ptr.x, ptr.y)) setText(G.settings.textIdx + 1);
      else G.ui.drag = { y0: ptr.y, s0: G.ui.scroll };
    }
    if (G.ui.drag && ptr.down) setS(G.ui.drag.s0 - (ptr.y - G.ui.drag.y0));
    if (!ptr.down) G.ui.drag = null;
    const wh = input.wheel ? input.wheel.dy : 0; if (wh) setS(G.ui.scroll + wh);
    if (keys.down.has('ArrowDown')) setS(G.ui.scroll + 16);
    if (keys.down.has('ArrowUp')) setS(G.ui.scroll - 16);
    if (keys.pressed.has('PageDown') || keys.pressed.has('Space')) setS(G.ui.scroll + view * 0.85);
    if (keys.pressed.has('PageUp')) setS(G.ui.scroll - view * 0.85);
    if (keys.pressed.has('End')) setS(rm.max);
    if (keys.pressed.has('Home')) setS(0);
    if (keys.pressed.has('Equal') || keys.pressed.has('NumpadAdd')) setText(G.settings.textIdx + 1);
    if (keys.pressed.has('Minus') || keys.pressed.has('NumpadSubtract')) setText(G.settings.textIdx - 1);
    if (keys.pressed.has('Escape')) close();
  };
  const updateSetup = (dt, input) => {
    const ptr = input.pointer, k = input.keys;
    if (k.pressed.has('Enter')) { handleSetup('start'); return; }
    if (k.pressed.has('Escape')) { handleSetup('back'); return; }
    const pins = setupPins();
    if (ptr.pressed && (inRect(pins.start, ptr.x, ptr.y) || inRect(pins.back, ptr.x, ptr.y))) { handleSetup(inRect(pins.start, ptr.x, ptr.y) ? 'start' : 'back'); return; }
    updateFlowScene(dt, input, handleSetup, 'setup');
  };

  // ---- the trail ----------------------------------------------------------------------------------------------------------
  function openPause() { G.paused = true; G.pauseMenu = true; G.ui.scroll = 0; G.c.paceGrab = false; MN.invalidateLayout(); }
  function updateWatchControls(input, L) {
    const wt = G.watch, ptr = input.pointer, st = G.settings;
    if (ptr.pressed) {
      const rects = watchRects(L);
      if (inRect(rects[0], ptr.x, ptr.y) || inRect(L.pause, ptr.x, ptr.y)) { wt.paused = !wt.paused; sfx.tick(); }
      else if (inRect(rects[1], ptr.x, ptr.y)) { st.thinkIdx = Math.max(0, st.thinkIdx - 1); saveAll(); sfx.tick(); }
      else if (inRect(rects[2], ptr.x, ptr.y)) { st.thinkIdx = Math.min(THINK_STEPS.length - 1, st.thinkIdx + 1); saveAll(); sfx.tick(); }
      else if (inRect(rects[3], ptr.x, ptr.y)) { leaveRace(); return false; }
    }
    if (input.keys.pressed.has('KeyP') || input.keys.pressed.has('Escape')) wt.paused = !wt.paused;
    return true;
  }
  function updateWatch(dt, input, L) {
    if (!updateWatchControls(input, L)) return;
    const wt = G.watch, run = G.run, s = run.s;
    if (wt.paused) return;
    if (s.phase === 'finished') { run.update(dt, {}); processEvents(); return; }
    if (s.phase === 'ready') {
      wt.timer += dt;
      if (wt.timer >= 0.9) { wt.timer = 0; run.start(); wt.phase = 'ride'; wt.ai.legSeen = -1; processEvents(); }
      return;
    }
    if (s.phase === 'stop') {
      if (wt.phase !== 'think' && wt.phase !== 'reveal' && wt.phase !== 'care') {
        const p = planFor(true);
        wt.phase = 'think'; wt.total = THINK_STEPS[G.settings.thinkIdx]; wt.timer = wt.total; wt.lines = p.lines; wt.queue = p.care.slice(); wt.qT = 0;
        G.watch.leaveWait = 0;
      }
      if (wt.phase === 'think') { wt.timer -= dt; if (wt.timer <= 0) { wt.phase = 'reveal'; wt.timer = 2; } return; }
      if (wt.phase === 'reveal') { wt.timer -= dt; if (wt.timer <= 0) { wt.phase = 'care'; wt.qT = 0.4; } return; }
      if (wt.phase === 'care') {
        wt.qT -= dt;
        if (wt.qT <= 0) {
          const a = wt.queue.shift();
          if (a) { const r = run.care(a.action, a.idx); G.stopMsg = r && r.cost ? `${CARE[a.action].name}: ${r.cost} s` : ''; G.stopMsgT = 1.5; wt.qT = 0.8; processEvents(); }
          else { run.leave(); wt.phase = 'ride'; wt.lines = []; afterLegStart(false); processEvents(); }
        }
      }
      return;
    }
    // running
    if (wt.phase === 'ride') {
      const d = thinkDue(s, wt.ai);
      if (d) {
        const p = planFor(true, d.kind);
        wt.phase = 'think'; wt.total = THINK_STEPS[G.settings.thinkIdx]; wt.timer = wt.total; wt.lines = p.lines; G.plan = p.span ? { span: p.span, col: '#ffd54a' } : null;
        return;
      }
    }
    if (wt.phase === 'think') { wt.timer -= dt; if (wt.timer <= 0) { wt.phase = 'reveal'; wt.timer = 2; } return; }
    if (wt.phase === 'reveal') { wt.timer -= dt; if (wt.timer <= 0) { wt.phase = 'act'; wt.lines = []; G.plan = null; wt.actT = 3; } return; }
    if (wt.phase === 'act') { wt.actT -= dt; if (wt.actT <= 0) wt.phase = 'ride'; }
    run.update(dt, aiControl(run, wt.ai));
    processEvents();
  }
  const shotControl = (run) => {
    const s = run.s;
    if (s.phase === 'ready') { run.start(); return null; }
    if (!G.shotAi) G.shotAi = makeAi({ reserve: 0.45 });
    return aiControl(run, G.shotAi);
  };
  function updateCue() {
    const s = G.run.s, L = s.L, g = G.settings.guide;
    G.cue = null; G.callLit = null;
    if (s.phase !== 'run') return;
    const j = L.jx.find((q) => q.state === 'ahead');
    if (j && g < 2) {
      const d = j.x - s.x, w = windowOf(L);
      if (d < w && d > 0) { G.callLit = j.dir; G.cue = { text: `Call ${j.dir === 'R' ? 'GEE (right)' : 'HAW (left)'} now!`, col: '#ffd54a', urgent: true }; return; }
      if (d < L.vis && d > 0) { G.cue = { text: `Junction in ${Math.round(d)} m: ${j.dir === 'R' ? 'Gee, right' : 'Haw, left'}`, col: '#ffb13a' }; return; }
    }
    if (g === 0) {
      const slope = slopeAt(L, s.x), steep = L.steep.some(([a, b]) => s.x > a - 40 && s.x < b);
      if (steep && !s.brake && s.v > 6) { G.cue = { text: 'Steep downhill: tap Brake!', col: '#ff8a6a', urgent: true }; return; }
      if (slope < STEEP && s.brake) { G.cue = { text: 'Brake down. Lift it at the bottom', col: '#7fe0b0' }; return; }
      const wk = s.dogs.filter((d) => !d.riding);
      const low = wk.length ? Math.min(...wk.map((d) => d.e)) : 0;
      if (low < 0.2) { G.cue = { text: 'The team is tiring: ease the pace', col: '#ff8a6a' }; return; }
    }
  }

  function playerControl(input, L, dt) {
    const s = G.run.s, ptr = input.pointer, keys = input.keys;
    const ctl = {};
    // the pace lever
    if (ptr.pressed && inRect(L.pace, ptr.x, ptr.y)) G.c.paceGrab = true;
    if (G.c.paceGrab && ptr.down) {
      const r = L.pace, pad = 34;
      const v = r.vertical ? 1 - (ptr.y - (r.y + pad)) / (r.h - 2 * pad) : (ptr.x - (r.x + pad)) / (r.w - 2 * pad);
      ctl.pace = clamp(v, 0, 1);
    }
    if (!ptr.down) G.c.paceGrab = false;
    if (keys.down.has('ArrowUp') || keys.down.has('KeyW')) ctl.pace = clamp((ctl.pace ?? s.pace) + KEY_PACE * dt, 0, 1);
    if (keys.down.has('ArrowDown') && !keys.down.has('KeyS')) ctl.pace = clamp((ctl.pace ?? s.pace) - KEY_PACE * dt, 0, 1);
    // calls
    if (ptr.pressed && inRect(L.haw, ptr.x, ptr.y)) ctl.cmd = 'L';
    if (ptr.pressed && inRect(L.gee, ptr.x, ptr.y)) ctl.cmd = 'R';
    if (keys.pressed.has('ArrowLeft') || keys.pressed.has('KeyA') || keys.pressed.has('KeyH')) ctl.cmd = 'L';
    if (keys.pressed.has('ArrowRight') || keys.pressed.has('KeyD') || keys.pressed.has('KeyG')) ctl.cmd = 'R';
    // the brake: tap toggles, a long press holds
    if (ptr.pressed && inRect(L.brake, ptr.x, ptr.y)) { G.c.brakeAt = G.t; G.c.brakeWas = G.brakeOn; G.brakeOn = !G.brakeOn; G.c.brakeHeld = true; }
    if (ptr.released && G.c.brakeHeld) { if (G.t - G.c.brakeAt > 0.4 && !G.c.brakeWas) G.brakeOn = false; G.c.brakeHeld = false; }
    ctl.brake = G.brakeOn || keys.down.has('Space') || keys.down.has('KeyS');
    // praise: a tap on the trail
    if (ptr.pressed) {
      const hit = [L.pace, L.haw, L.gee, L.brake, L.pause, L.think, L.team, L.board, L.route].some((r) => inRect(r, ptr.x, ptr.y));
      if (!hit && ptr.y > L.top) ctl.praise = true;
    }
    if (keys.pressed.has('KeyF')) ctl.praise = true;
    return ctl;
  }
  function stopInput(input, L) {
    const ptr = input.pointer, keys = input.keys, s = G.run.s, run = G.run;
    const SL = stopLayout(G.settings.textIdx);
    const doCare = (a) => {
      const sel = G.selDog;
      if (a === 'bag' && sel < 0) return;
      const r = run.care(a, a === 'rest' ? -1 : sel);
      if (!r) return;
      if (r.refused) { G.stopMsg = `${DOGS[sel].name} is ${r.refused}`; G.stopMsgT = 2; return; }
      const who = a === 'rest' || sel < 0 ? 'the team' : DOGS[sel].name;
      const verb = { water: 'Water for', snack: 'A snack for', paws: 'Paws and booties for', rest: 'Rest for', praise: 'Praise for', bag: 'The bag for' }[a];
      G.stopMsg = `${verb} ${who}: ${r.cost} s`; G.stopMsgT = 2;
      if (a === 'praise') G.praiseT = 1;
      processEvents();
    };
    if (ptr.pressed) {
      SL.cards.forEach((r, i) => { if (inRect(r, ptr.x, ptr.y)) { G.selDog = G.selDog === i ? -1 : i; sfx.tick(); } });
      SL.actions.forEach((r, k) => { if (inRect(r, ptr.x, ptr.y)) doCare(ACTIONS[k]); });
      if (inRect(SL.leave, ptr.x, ptr.y)) leaveNow();
      if (inRect(L.pause, ptr.x, ptr.y)) { openPause(); return; }
      if (inRect(L.think, ptr.x, ptr.y)) { openThink(); return; }
    }
    if (keys.pressed.has('Enter')) leaveNow();
    if (keys.pressed.has('KeyP') || keys.pressed.has('Escape')) openPause();
    if (keys.pressed.has('KeyT')) openThink();
    ['KeyW', 'KeyS', 'KeyP2'].forEach(() => {});
    const num = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6'];
    num.forEach((c, i) => { if (keys.pressed.has(c)) { G.selDog = G.selDog === i ? -1 : i; } });
    const act = { KeyZ: 'water', KeyX: 'snack', KeyC: 'paws', KeyV: 'rest', KeyB: 'praise' };
    Object.keys(act).forEach((k) => { if (keys.pressed.has(k)) doCare(act[k]); });
  }
  function leaveNow() {
    const run = G.run;
    if (run.s.phase !== 'stop') return;
    run.leave();
    afterLegStart(false);
    G.stopMsg = ''; G.selDog = -1;
    sfx.go();
  }
  function updatePlay(dt, input) {
    const L = playLayout(G.settings.textIdx);
    const run = G.run, s = run.s, ptr = input.pointer, keys = input.keys;
    G.praiseT = Math.max(0, G.praiseT - dt * 0.8);
    G.stopMsgT = Math.max(0, G.stopMsgT - dt);
    // the camera follows the team smoothly
    const target = elev(s.L, s.x + 6);
    G.camE += (target - G.camE) * Math.min(1, dt * 2.5);
    if (G.mode === 'shot') { if (G.devFreeze) return; run.update(dt, shotControl(run)); processEvents(); return; }
    if (G.pauseMenu) { if (keys.pressed.has('Escape') || keys.pressed.has('KeyP')) { handlePause('resume'); return; } MN.ensureLayout(G, 'pause'); updateFlowScene(dt, input, handlePause, null); return; }
    if (G.mode === 'watch') { updateWatch(dt, input, L); updateCueWatch(); return; }
    if (G.think) {
      if ((ptr.pressed && G.thinkRects && inRect(G.thinkRects.close, ptr.x, ptr.y)) || keys.pressed.has('Enter') || keys.pressed.has('Escape') || keys.pressed.has('KeyT')) { G.think = null; G.plan = null; sfx.tick(); }
      return;
    }
    if (s.phase === 'finished') { run.update(dt, {}); processEvents(); return; }
    if (s.phase === 'stop') { stopInput(input, L); updateCue(); return; }
    if (ptr.pressed && inRect(L.pause, ptr.x, ptr.y)) { openPause(); return; }
    if (keys.pressed.has('KeyP') || keys.pressed.has('Escape')) { openPause(); return; }
    if (s.phase === 'ready') {
      const gr = goRect(L);
      if ((ptr.pressed && inRect(gr, ptr.x, ptr.y)) || keys.pressed.has('Space') || keys.pressed.has('Enter')) { run.start(); G.hintMsg = ''; G.c.paceGrab = false; processEvents(); }
      if (ptr.pressed && inRect(L.think, ptr.x, ptr.y)) openThink();
      return;
    }
    if (ptr.pressed && inRect(L.think, ptr.x, ptr.y)) { openThink(); return; }
    if (keys.pressed.has('KeyT')) { openThink(); return; }
    const ctl = playerControl(input, L, dt);
    run.update(dt, ctl);
    processEvents();
    updateCue();
    updatePlace();
  }
  function updateCueWatch() { G.cue = null; G.callLit = null; updatePlace(); }
  function updatePlace() {
    const s = G.run.s;
    if (!G.rivals.length) { G.place = 0; return; }
    const mine = G.run.totalDistance();
    let ahead = 0;
    for (const r of G.rivals) { const p = rivalAt(r.ideal, G.legs, r.skill, s.clock); if (p.dist > mine + 0.5 || (p.done && !s.finished)) ahead++; }
    G.place = 1 + ahead;
  }

  function updateBackdrop(dt) {
    if (!bg.run || bg.run.s.over || bg.run.s.phase === 'finished') {
      bg.run = createRace({ legs: [RACES[1].legs[0]] }); bg.ai = makeAi({ reserve: 0.5 }); bg.run.start();
    }
    const s = bg.run.s;
    if (s.phase === 'run') bg.run.update(dt, aiControl(bg.run, bg.ai));
    G.bgE = (G.bgE ?? 0) + (elev(s.L, s.x + 6) - (G.bgE ?? 0)) * Math.min(1, dt * 2.5);
  }

  // what the picture needs this frame
  G.sceneState = (run) => {
    const s = run ? run.s : null;
    let ghost = null;
    if (G.rivals.length && s && s.phase !== 'ready') {
      let best = null;
      for (const r of G.rivals) {
        const p = rivalAt(r.ideal, G.legs, r.skill, s.clock);
        if (p.leg === s.L.idx || (p.done && s.leg === s.legCount - 1)) { const dx = Math.abs(p.x - s.x); if (!best || dx < best.dx) best = { dx, x: p.x, leg: p.leg, col: r.col }; }
      }
      if (best) ghost = best;
    }
    return { s, L: s.L, time: G.t, look: G.look, x: s.x, camE: G.camE, ghost, sel: s.phase === 'stop' ? G.selDog : -1, praiseT: G.praiseT, plan: G.plan };
  };
  G.sceneBack = (ctx) => {
    if (!bg.run) return;
    const s = bg.run.s;
    const c = makeCam(live.w, live.h, { x: 0, y: 0, w: live.w, h: live.h }, live.land);
    drawScene(ctx, c, { s, L: s.L, time: G.t, look: 1, x: s.x, camE: G.bgE ?? 0, ghost: null, sel: -1, praiseT: 0, plan: null });
  };

  if (config.shot) {
    // fixed, deterministic scenes for screenshots: the seed picks the look, the weather and how far the computer has driven
    const n = (Number(config.shotSeed) || 1);
    const race = [0, 1, 2, 4, 3][(n - 1) % 5], R = RACES[race];
    G.mode = 'shot'; G.round = blankRound(race, R.name);
    setupRivals(race);
    G.run = createRace({ legs: R.legs }); G.look = R.look;
    G.watch.ai = makeAi();
    const s = G.run.s;
    const legIdx = n === 3 ? 1 : n === 5 ? 2 : 0;
    const stopAt = n === 4;
    G.run.start();
    const frames = [0, 22, 34, 0, 18][(n - 1) % 5] * 60;
    let guard = 0;
    while (guard++ < 200000) {
      if (s.phase === 'stop') { if (stopAt) break; for (const a of carePlan(s, G.run.legSpec(s.leg + 1))) G.run.care(a.action, a.idx); G.run.leave(); continue; }
      if (s.phase === 'ready') { if (s.leg >= legIdx) { G.run.start(); } else G.run.start(); continue; }
      if (s.phase === 'finished') break;
      if (!stopAt && s.leg === legIdx && s.t * 60 >= frames) break;
      G.run.update(1 / 60, shotControl(G.run));
    }
    G.camE = elev(s.L, s.x + 6);
    G.scene = 'play';
    if (config.dev) G.devFreeze = true;
    evSeen = s.evId;
    G.stopMsg = ''; G.hasNextLeg = s.leg + 1 < s.legCount; G.nextLen = G.hasNextLeg ? G.run.legSpec(s.leg + 1).len : 0;
    if (s.phase === 'stop') G.selDog = 2;
    G.coachFrom = -1000;
    updatePlace();
    G.cue = null;
    if (s.phase === 'run') updateCue();
  }
  if (config.dev) {
    G.devApi = {
      step(n = 1) { for (let i = 0; i < n; i++) { G.run.update(1 / 60, shotControl(G.run)); processEvents(); } },
      freeze(v = true) { G.devFreeze = v; },
      startRace(m, o) { startRace(m, o); },
      start() { G.run.start(); },
      scene(s, back) { G.scene = s; if (back) G.back = back; G.ui.scroll = 0; MN.invalidateLayout(); },
      textIdx(i) { setText(i); },
      hint() { openThink(); },
      pause() { openPause(); },
      untilPhase(ph) { for (let i = 0; i < 60000 && G.run.s.phase !== ph; i++) { G.run.update(1 / 60, shotControl(G.run)); processEvents(); } },
      cue() { updateCue(); },
    };
  }

  const api = {
    // Menus, Rules, About, settings, Learn, Watch & Learn, practice, pause, hints, waiting at the start and the checkpoint care are free; only real
    // driving on the trail in the Trail Cup or the Trail Run counts against the preview.
    isPreviewExempt: () => !(G.scene === 'play' && (G.mode === 'cup' || G.mode === 'trail') && G.run && G.run.s.phase === 'run') || G.paused || G.pauseMenu || !!G.think,
    update(dt, input) {
      syncSize(meta.width, meta.height);
      const sk = sizeKey();
      if (sk !== lastSize) { if (lastSize) { G.c.paceGrab = false; G.ui.drag = null; MN.invalidateLayout(); } lastSize = sk; }
      meta.previewBadge = { x: live.w / 2, y: G.scene === 'play' ? playLayout(G.settings.textIdx).top + 70 : live.h - 70, align: 'center' };
      setPress(input.pointer);
      G.t += dt;
      for (let i = delayed.length - 1; i >= 0; i--) { delayed[i].t -= dt; if (delayed[i].t <= 0) { const f = delayed[i].f; delayed.splice(i, 1); f(); } }
      if (G.scene !== 'play') updateBackdrop(dt);
      switch (G.scene) {
        case 'title': {
          const lt = MN.getLockTap(), pp = input.pointer;
          MN.setLockDown(G.lockDown > G.t);
          if (lt && pp.pressed && pp.x >= lt.x && pp.x <= lt.x + lt.w && pp.y >= lt.y && pp.y <= lt.y + lt.h) { G.lockDown = G.t + 0.25; env.openArcforgeHome?.(); break; }
          updateFlowScene(dt, input, handleTitle, 'title'); break;
        }
        case 'setup': updateSetup(dt, input); break;
        case 'settings': updateFlowScene(dt, input, handleSettings, 'settings'); break;
        case 'learn': updateFlowScene(dt, input, handleLearn, 'learn'); break;
        case 'lesson': updateFlowScene(dt, input, handleLesson, 'lesson'); break;
        case 'lessonresult': updateFlowScene(dt, input, handleLessonResult, 'lessonresult'); break;
        case 'result': updateFlowScene(dt, input, handleResult, 'result'); break;
        case 'demolimit': updateFlowScene(dt, input, (id) => { if (id === 'menu') go('title'); }, 'demolimit'); break;
        case 'howto': case 'about': case 'rules': updatePages(input); break;
        case 'play': updatePlay(dt, input); break;
        default: break;
      }
    },
    render(ctx) {
      syncSize(meta.width, meta.height);
      G.vw = live.w; G.vh = live.h;
      v3.hero = null;
      switch (G.scene) {
        case 'title': MN.renderTitle(ctx, G); break;
        case 'setup': MN.renderSetup(ctx, G); break;
        case 'settings': MN.renderSettings(ctx, G); break;
        case 'learn': MN.renderLearn(ctx, G); break;
        case 'lesson': MN.renderLesson(ctx, G); break;
        case 'lessonresult': MN.renderLessonResult(ctx, G); break;
        case 'result': MN.renderResult(ctx, G); break;
        case 'demolimit': MN.renderDemoLimit(ctx, G); break;
        case 'howto': MN.renderPages(ctx, G, HOWTO, 'How to Play'); break;
        case 'about': MN.renderPages(ctx, G, ABOUT, 'About'); break;
        case 'rules': MN.renderPages(ctx, G, RULES, 'Rules'); break;
        case 'play':
          renderHud(ctx, G);
          if (G.pauseMenu) MN.renderPause(ctx, G);
          break;
        default: break;
      }
    },
    getState: () => G,
  };
  if (config.dev) {
    const idle = () => ({ pointer: { x: 0, y: 0, down: false, pressed: false, released: false }, keys: { down: new Set(), pressed: new Set() }, wheel: { dx: 0, dy: 0 } });
    G.devApi.tick = (n) => { for (let i = 0; i < n; i++) api.update(1 / 60, idle()); };
  }
  return api;
}

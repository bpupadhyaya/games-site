// Rice Terraces, the game shell: scenes, input, persistence, preview wiring, Watch & Learn, Think. The hillside lives in farm.js, the computer farmer in planner.js.
import { createFarm, startYear, update as farmUpdate, continueFromCard, toggleGate, startJob, gateState, scoreOf, jobsFor } from './farm.js';
import { suggest } from './planner.js';
import { SEASONS, levelById, gateList, chapterLevels } from './levels.js';
import { ABOUT, HOWTO, RULES, SEASON_STORY, FESTIVAL } from './content.js';
import { SW, H, OX, PANEL, TEXT_SCALES, REF_CLOSE, TEXT_DEC, TEXT_INC, SETUP_PINS, inRect, setScreen, column, hudLayout } from './layout.js';
import { setPress, roundPath } from './ui.js';
import * as MN from './menus.js';
import { READER, pageViewH } from './menus.js';
import { renderHud, renderFallback, hit as hudHit, pickMap, CARD } from './hud.js';
import { clamp } from './util.js';

export const meta = { width: 720, height: 1280, fluid: { short: 720 } };
const THINK_STEPS = [2, 5, 8, 10];
const DEMO_STARTS = 8;
const WATCH_GAP = 4;                                   // sim seconds the computer farmer lets pass between decisions

export function createGame(env) {
  const { rng, audio, storage, config } = env;
  const demo = !!config.demo;
  const G = {
    scene: 'title', mode: 'none', demo, loaded: false, thinkSteps: THINK_STEPS,
    settings: { textIdx: 0, sound: true, thinkIdx: 1 },
    setup: { lv: 'c1', watch: false },
    ui: { scroll: 0, drag: null, cardScroll: 0 }, back: 'title', restoreMsg: '', setupMsg: '',
    record: { done: {}, pages: [], demoStarts: 0 },
    farm: { f: null }, lv: null, sel: null, focus: null, focusGate: null, hl: null, speed: 1, paused: false, pauseMenu: false, card: null, thinkCard: null,
    watch: { phase: 'idle', timer: 0, paused: false, card: null, run: 0, steps: null, wait: 0 }, thinkTotal: 5,
    stars: 0, houses: 1, newPages: [], houseGain: 0, nextLevel: null, floaters: [], flash: null, t: 0, kb: -1,
  };
  let aboutList = ABOUT;
  if (typeof fetch === 'function') {
    fetch('./vendor3d/LICENSES.md').then((r) => (r.status >= 400 ? '' : r.text())).then((t) => {
      const paras = String(t).split(/\n\s*\n/).map((x) => x.replace(/^#+\s*/gm, '').replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);
      if (paras.length) aboutList = [...ABOUT, { title: 'Credits and licences', p: paras }];
    }).catch(() => {});
  }
  let evSeen = 0;
  const farmSeed = rng.int(1000000);

  // ---- persistence -------------------------------------------------------------------------------
  const totals = () => {
    const s = Object.values(G.record.done).reduce((a, d) => a + d.stars, 0);
    G.stars = s; G.houses = clamp(1 + Math.floor(s / 2), 1, 12);
  };
  const saveAll = () => { storage.set('settings', G.settings); storage.set('record', G.record); };
  Promise.all([storage.get('settings', null), storage.get('record', null)]).then(([s, r]) => {
    if (s) Object.assign(G.settings, s);
    if (r) Object.assign(G.record, r);
    G.record.done = G.record.done || {}; G.record.pages = G.record.pages || [];
    G.settings.textIdx = clamp(G.settings.textIdx | 0, 0, TEXT_SCALES.length - 1);
    G.settings.thinkIdx = clamp(G.settings.thinkIdx | 0, 0, THINK_STEPS.length - 1);
    totals();
    G.loaded = true;
    audio.setMuted?.(!G.settings.sound);
  });
  totals();

  // ---- sound ---------------------------------------------------------------------------------------
  const tone = (o) => { if (G.settings.sound) audio.tone(o); };
  const sfx = {
    tick: () => tone({ freq: 700, dur: 0.04, type: 'triangle', vol: 0.05 }),
    open: () => { tone({ freq: 300, to: 560, dur: 0.22, type: 'sine', vol: 0.08 }); tone({ freq: 900, to: 1300, dur: 0.1, type: 'triangle', vol: 0.025 }); },
    shut: () => { tone({ freq: 420, to: 190, dur: 0.18, type: 'sine', vol: 0.09 }); },
    plant: () => tone({ freq: 520, to: 700, dur: 0.14, type: 'triangle', vol: 0.06 }),
    harvest: () => [0, 4, 7, 12].forEach((s, i) => tone({ freq: 523 * Math.pow(2, s / 12), dur: 0.16 + i * 0.03, type: 'triangle', vol: 0.07 })),
    wall: () => { tone({ freq: 110, to: 55, dur: 0.4, type: 'sine', vol: 0.3 }); tone({ freq: 500, to: 160, dur: 0.1, type: 'square', vol: 0.03 }); },
    fix: () => { tone({ freq: 200, to: 160, dur: 0.1, type: 'square', vol: 0.05 }); tone({ freq: 300, to: 240, dur: 0.1, type: 'square', vol: 0.04 }); },
    season: () => [0, 7, 12].forEach((s, i) => tone({ freq: 392 * Math.pow(2, s / 12), dur: 0.5 + i * 0.1, type: 'sine', vol: 0.07 })),
    storm: () => tone({ freq: 70, to: 45, dur: 1.4, type: 'sawtooth', vol: 0.05 }),
    bad: () => [0, -3].forEach((n) => tone({ freq: 330 * Math.pow(2, n / 12), dur: 0.26, type: 'triangle', vol: 0.07 })),
    good: (n) => [0, 4, 7, 12].slice(0, n).forEach((s, i) => tone({ freq: 523 * Math.pow(2, s / 12), dur: 0.2 + i * 0.04, type: 'triangle', vol: 0.09 })),
  };

  // ambient water: soft bubbling burbles whose rate follows how much water is moving (the kit has tones only, so the stream is made of tiny tones)
  let ambAcc = 0, ambS = 12345;
  const ambR = () => { ambS = (Math.imul(ambS, 1664525) + 1013904223) >>> 0; return ambS / 4294967296; };
  function ambient(dt) {
    const f = G.farm && G.farm.f;
    if (!G.settings.sound || G.scene !== 'play' || !f || f.ph !== 'run' || G.paused || G.pauseMenu || G.card || G.thinkCard || (G.mode === 'watch' && G.watch.paused)) { ambAcc = 0; return; }
    let flow = 0;
    for (const k of ['d', 's', 'f']) for (const id in f.flows[k]) flow += Math.abs(f.flows[k][id] || 0);
    const lvl = Math.min(1, flow / 4) + (f.weather && f.weather.kind === 'rain' ? 0.3 : 0);
    if (lvl <= 0.02) { ambAcc = 0; return; }
    ambAcc += dt * G.speed * (2.5 + 9 * lvl);
    while (ambAcc >= 1) {
      ambAcc -= 1;
      const fr = 380 + ambR() * 700;
      tone({ freq: fr, to: fr * (1.25 + ambR() * 0.5), dur: 0.05 + ambR() * 0.07, type: 'sine', vol: 0.006 + 0.01 * lvl * ambR() });
    }
  }

  // ---- lifecycle -----------------------------------------------------------------------------------
  const setCard = (c) => { G.card = c; G.ui.cardScroll = 0; };
  function yearCard() {
    const lv = G.lv;
    return { title: `Year ${lv.year}: ${lv.name}`, who: lv.story.who, role: lv.story.role, look: lv.story.look, text: `${lv.story.text}${lv.valleyNeed ? '  The village in the valley also needs its share of water.' : ''}`, button: 'Begin the year', kind: 'intro' };
  }
  function seasonCard(f) {
    const lv = G.lv, s = f.season, st = SEASON_STORY[lv.chapter][s];
    return { title: `${SEASONS[s].name} season`, who: st.who, role: st.role, look: st.look, text: `${st.text}  ${SEASONS[s].blurb}`, button: 'Continue', kind: 'season' };
  }
  function startRun(kind, lvId) {
    const lv = levelById(lvId || G.setup.lv);
    G.lv = lv; G.setup.lv = lv.id;
    G.farm.f = createFarm(lv.id, { seed: farmSeed + G.record.demoStarts, village: G.houses });
    G.mode = kind; G.scene = 'play'; G.sel = null; G.focus = null; G.focusGate = null; G.hl = null; G.speed = 1; G.paused = false; G.pauseMenu = false; G.thinkCard = null;
    G.watch = { phase: 'idle', timer: 0, paused: false, card: null, run: 0, steps: null, wait: 0 };
    G.newPages = []; G.houseGain = 0; G.floaters = []; G.ui.scroll = 0; evSeen = 0; G.kb = -1;
    if (demo && kind === 'play') { G.record.demoStarts++; saveAll(); }
    setCard(yearCard());
  }
  const leaveRun = () => { G.scene = 'title'; G.mode = 'none'; G.paused = false; G.pauseMenu = false; G.card = null; G.thinkCard = null; G.watch.card = null; G.ui.scroll = 0; };
  const go = (scene) => { G.scene = scene; G.ui.scroll = 0; MN.ensureLayout(G, '-'); };
  const demoCapped = () => demo && G.record.demoStarts >= DEMO_STARTS;

  function unlockPage(id) {
    if (!G.record.pages.includes(id)) { G.record.pages.push(id); G.newPages.push(id); }
  }
  function floater(plot, text, col) { G.floaters.push({ plot, text, col, t0: G.t }); if (G.floaters.length > 16) G.floaters.shift(); }

  // ---- sim events: sound, feedback, journal ---------------------------------------------------------
  function processEvents() {
    const f = G.farm.f; if (!f) return;
    const mine = G.mode === 'play';
    for (const e of f.events) {
      if (e.id <= evSeen) continue;
      evSeen = e.id;
      if (e.type === 'gate') (e.open ? sfx.open : sfx.shut)();
      else if (e.type === 'planted') { sfx.plant(); floater(e.plot, 'planted', '#a9dc7a'); if (mine) unlockPage('e_plant'); }
      else if (e.type === 'harvested') { sfx.harvest(); floater(e.plot, `+${Math.round(e.yield * 100)}`, '#f0c455'); if (mine) unlockPage('e_gold'); }
      else if (e.type === 'tended') floater(e.plot, 'weeded', '#c6df7a');
      else if (e.type === 'cleared') { floater(e.plot, 'snails gone', '#d3a8f0'); if (mine) unlockPage('e_snail'); }
      else if (e.type === 'repaired') { sfx.fix(); floater(e.plot, 'wall mended', '#e8c9a0'); if (mine) unlockPage('e_repair'); }
      else if (e.type === 'crack') floater(e.plot, 'wall cracked', '#ffb08a');
      else if (e.type === 'collapse') { sfx.wall(); floater(e.plot, 'wall collapsed!', '#ff7a5a'); }
      else if (e.type === 'lost') { sfx.bad(); floater(e.plot, 'rice lost', '#ff7a5a'); }
      else if (e.type === 'pestwave') floater(e.plot, 'snails!', '#d3a8f0');
      else if (e.type === 'weather' && e.kind === 'storm') sfx.storm();
      else if (e.type === 'season') {
        sfx.season();
        if (e.season === 1 && mine && f.plots.some((p) => p.soil >= 1)) unlockPage('e_soak');
      } else if (e.type === 'workday') G.flash = { text: 'Community work day: +3 labour, walls strengthened', t0: G.t };
      else if (e.type === 'card') {
        setCard(seasonCard(f)); G.thinkCard = null; G.focus = null; G.focusGate = null; G.hl = null;
      } else if (e.type === 'end') finishYear();
    }
  }
  // the year is over: a short festival vignette first, then the result
  function festivalCard() {
    const lv = G.lv, st = SEASON_STORY[lv.chapter][3], sc = G.farm.f.score;
    const mood = sc.stars >= 3 ? 'A golden year. Everyone sings.' : sc.stars === 2 ? 'A good year, and a good feast.' : sc.stars === 1 ? 'A thin year, but nobody goes hungry.' : 'A hard year. We will mend the walls and try again.';
    return { title: 'The harvest feast', who: st.who, role: st.role, look: st.look, text: `${FESTIVAL[lv.chapter]}  ${mood}`, button: 'See the result', kind: 'festival' };
  }
  function finishYear() {
    G.card = null; G.thinkCard = null;
    if (G.mode === 'watch') { settleYear(); return; }
    setCard(festivalCard());
  }
  function settleYear() {
    const f = G.farm.f, lv = G.lv, sc = f.score;
    G.card = null; G.thinkCard = null;
    if (G.mode === 'play') {
      const prev = G.record.done[lv.id];
      const before = G.houses;
      if (!prev || sc.stars > prev.stars || sc.total > prev.total) G.record.done[lv.id] = { stars: Math.max(sc.stars, prev ? prev.stars : 0), total: Math.max(sc.total, prev ? prev.total : 0) };
      totals(); G.houseGain = G.houses - before;
      unlockPage(lv.id);
      if (sc.valley !== null && sc.valley >= 1) unlockPage('e_valley');
      if (sc.shared !== null && sc.shared >= 0.7 && sc.yield >= 0.7) unlockPage('e_fair');
      if (sc.stars >= 3) unlockPage('e_perfect');
      const list = chapterLevels(lv.chapter), k = list.findIndex((l) => l.id === lv.id);
      G.nextLevel = k >= 0 && k < list.length - 1 && !demo ? list[k + 1] : null;
      saveAll();
      sfx.good(sc.stars >= 2 ? 4 : 2);
    } else G.nextLevel = null;
    G.scene = 'result'; G.ui.scroll = 0; G.paused = false; G.pauseMenu = false;
  }

  // ---- doing things on the hillside (player and computer farmer share these) -------------------------------------
  const gateById = (id) => gateList(G.lv).find((g) => g.id === id);
  function doGate(id, open) {
    const g = gateById(id); if (!g) return false;
    const cur = gateState(G.farm.f, g);
    if (cur === -1) return false;
    if (open !== undefined && (cur === 1) === open) return false;
    return toggleGate(G.farm.f, g);
  }
  function doJob(plot, type) { const r = startJob(G.farm.f, plot, type); if (!r.ok) G.flash = { text: r.why, t0: G.t }; return r.ok; }
  function applySuggestion(s) {
    if (!s) return;
    if (s.kind === 'job') doJob(s.plot, s.job);
    else if (s.kind === 'gate') for (const st of s.steps) doGate(st.gate, st.open);
  }
  function think() {
    const f = G.farm.f; if (!f || f.ph !== 'run') return;
    const s = suggest(f);
    G.thinkCard = { ...s };
    G.focus = s.plots || []; G.focusGate = s.kind === 'gate' ? s.gate : null; G.hl = null;
    G.ui.cardScroll = 0; sfx.tick();
  }

  // ---- scrolling ---------------------------------------------------------------------------------------
  function scrollInput(input, max, view, key = 'scroll') {
    const k = input.keys;
    let sc = G.ui[key] || 0;
    if (G.wheelAcc) { sc += G.wheelAcc * 1.1; G.wheelAcc = 0; }
    if (k.down.has('ArrowDown')) sc += 16;
    if (k.down.has('ArrowUp')) sc -= 16;
    const page = Math.max(80, view - 70);
    if (k.pressed.has('PageDown') || (k.pressed.has('Space') && !k.down.has('ShiftLeft') && !k.down.has('ShiftRight'))) sc += page;
    if (k.pressed.has('PageUp') || (k.pressed.has('Space') && (k.down.has('ShiftLeft') || k.down.has('ShiftRight')))) sc -= page;
    if (k.pressed.has('Home')) sc = 0;
    if (k.pressed.has('End')) sc = max;
    G.ui[key] = clamp(sc, 0, max);
  }
  function cardInput(input) {
    const ptr = input.pointer, R = CARD.rect;
    if (ptr.pressed && R && ptr.x >= R.x && ptr.x <= R.x + R.w + 24 && ptr.y >= R.y && ptr.y <= R.y + R.h) G.ui.cardDrag = { y0: ptr.y, s0: G.ui.cardScroll || 0 };
    if (G.ui.cardDrag && ptr.down) G.ui.cardScroll = clamp(G.ui.cardDrag.s0 - (ptr.y - G.ui.cardDrag.y0), 0, CARD.max);
    if (ptr.released) G.ui.cardDrag = null;
    if (G.wheelAcc && R) { G.ui.cardScroll = clamp((G.ui.cardScroll || 0) + G.wheelAcc, 0, CARD.max); G.wheelAcc = 0; }
  }
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
    if (input.keys.pressed.has('Equal') || input.keys.pressed.has('NumpadAdd')) { G.settings.textIdx = Math.min(TEXT_SCALES.length - 1, G.settings.textIdx + 1); saveAll(); }
    if (input.keys.pressed.has('Minus') || input.keys.pressed.has('NumpadSubtract')) { G.settings.textIdx = Math.max(0, G.settings.textIdx - 1); saveAll(); }
    scrollInput(input, max, mt.bottom - mt.top);
  };

  // ---- menu handlers -----------------------------------------------------------------------------------
  function handleTitle(id) {
    if (!id) return;
    sfx.tick();
    if (id === 'play') { G.setup.watch = false; go('levels'); }
    else if (id === 'watch') { G.setup.watch = true; go('levels'); }
    else if (id === 'journal') go('journal');
    else if (id === 'howto') { G.back = 'title'; go('howto'); }
    else if (id === 'rules') { G.back = 'title'; go('rules'); }
    else if (id === 'about') { G.back = 'title'; go('about'); }
    else if (id === 'settings') go('settings');
    else if (id === 'sound') { G.settings.sound = !G.settings.sound; audio.setMuted?.(!G.settings.sound); saveAll(); }
  }
  function handleLevels(id) {
    if (!id) return;
    sfx.tick();
    if (id.startsWith('lv-')) { G.setup.lv = id.slice(3); G.lv = levelById(G.setup.lv); }
    else if (id === 'start') {
      if (demoCapped() && !G.setup.watch) { go('demolimit'); return; }
      startRun(G.setup.watch ? 'watch' : 'play');
    } else if (id === 'back') go('title');
  }
  function handleSettings(id) {
    if (!id) return;
    sfx.tick();
    const st = G.settings;
    if (id === 'set-sound') { st.sound = !st.sound; audio.setMuted?.(!st.sound); }
    else if (id === 'txt-dec') { st.textIdx = Math.max(0, st.textIdx - 1); G.ui.scroll = 0; }
    else if (id === 'txt-inc') { st.textIdx = Math.min(TEXT_SCALES.length - 1, st.textIdx + 1); G.ui.scroll = 0; }
    else if (id === 'think-dec') st.thinkIdx = Math.max(0, st.thinkIdx - 1);
    else if (id === 'think-inc') st.thinkIdx = Math.min(THINK_STEPS.length - 1, st.thinkIdx + 1);
    else if (id === 'restore') { G.restoreMsg = 'Checking...'; env.monetization.restore().then(() => { G.restoreMsg = env.monetization.owns('unlock_game') ? 'Purchase restored.' : 'No earlier purchase found.'; }).catch(() => { G.restoreMsg = 'Could not reach the store.'; }); }
    else if (id === 'back') { go('title'); G.restoreMsg = ''; }
    saveAll();
  }
  function handleResult(id) {
    if (!id) return;
    sfx.tick();
    if (id === 'next' && G.nextLevel) { G.setup.lv = G.nextLevel.id; if (demoCapped()) go('demolimit'); else startRun('play'); }
    else if (id === 'again') { if (demoCapped() && G.mode !== 'watch') go('demolimit'); else startRun(G.mode === 'watch' ? 'watch' : 'play'); }
    else if (id === 'menu') { leaveRun(); go('title'); }
  }
  function handlePause(id) {
    if (!id) return;
    sfx.tick();
    if (id === 'resume') { G.paused = false; G.pauseMenu = false; }
    else if (id === 'p-rules') { G.back = 'play'; go('rules'); }
    else if (id === 'p-howto') { G.back = 'play'; go('howto'); }
    else if (id === 'p-sound') { G.settings.sound = !G.settings.sound; audio.setMuted?.(!G.settings.sound); saveAll(); }
    else if (id === 'p-txt-dec') { G.settings.textIdx = Math.max(0, G.settings.textIdx - 1); G.ui.scroll = 0; saveAll(); }
    else if (id === 'p-txt-inc') { G.settings.textIdx = Math.min(TEXT_SCALES.length - 1, G.settings.textIdx + 1); G.ui.scroll = 0; saveAll(); }
    else if (id === 'quit') { leaveRun(); }
  }
  const updatePages = (input) => {
    const ptr = input.pointer, keys = input.keys;
    const max = READER.max || 0, view = pageViewH();
    const close = () => { G.scene = G.back === 'play' ? 'play' : 'title'; G.ui.scroll = 0; G.ui.drag = null; };
    const zoom = (d) => { const n = clamp(G.settings.textIdx + d, 0, TEXT_SCALES.length - 1); if (n !== G.settings.textIdx) { G.settings.textIdx = n; G.ui.scroll = 0; saveAll(); } };
    if (ptr.pressed) {
      if (inRect(REF_CLOSE, ptr.x, ptr.y)) { close(); return; }
      else if (inRect(TEXT_DEC, ptr.x, ptr.y)) zoom(-1);
      else if (inRect(TEXT_INC, ptr.x, ptr.y)) zoom(1);
      else if (ptr.x > PANEL.x + PANEL.w - 40 && ptr.y > PANEL.y + 84 && ptr.y < PANEL.y + PANEL.h - 14 && ptr.x < PANEL.x + PANEL.w + 8) G.ui.drag = { bar: true };
      else if (ptr.y > PANEL.y + 60 && ptr.y < PANEL.y + PANEL.h) G.ui.drag = { y0: ptr.y, s0: G.ui.scroll };
    }
    if (G.ui.drag && ptr.down) {
      const d = G.ui.drag;
      if (d.bar) G.ui.scroll = clamp(((ptr.y - (PANEL.y + 84)) / view) * (max + view) - view / 2, 0, max);
      else G.ui.scroll = clamp(d.s0 - (ptr.y - d.y0), 0, max);
    }
    if (ptr.released) G.ui.drag = null;
    if (keys.pressed.has('Equal') || keys.pressed.has('NumpadAdd')) zoom(1);
    if (keys.pressed.has('Minus') || keys.pressed.has('NumpadSubtract')) zoom(-1);
    scrollInput(input, max, view);
    if (keys.pressed.has('Escape') || keys.pressed.has('Enter')) close();
  };
  const updatePinned = (dt, input, key, handler, hasStart) => {
    const ptr = input.pointer, k = input.keys;
    if (hasStart && k.pressed.has('Enter')) { handler('start'); return; }
    if (k.pressed.has('Escape')) { handler('back'); return; }
    if (ptr.pressed) {
      if (hasStart && inRect(SETUP_PINS.start, ptr.x, ptr.y)) { handler('start'); return; }
      const backR = hasStart ? SETUP_PINS.back : { x: 30, y: SETUP_PINS.back.y, w: SETUP_PINS.start.w + SETUP_PINS.back.w + 16, h: SETUP_PINS.back.h };
      if (inRect(backR, ptr.x, ptr.y)) { handler('back'); return; }
    }
    updateFlowScene(dt, input, handler, key);
  };

  // ---- the play update -----------------------------------------------------------------------------------
  function colInput(kind, input) {
    column(kind);
    const p = input.pointer;
    const inp = OX ? { keys: input.keys, pointer: { x: p.x - OX, y: p.y, down: p.down, pressed: p.pressed, released: p.released } } : input;
    setPress(inp.pointer);
    return inp;
  }
  const COLUMN = { title: 'title', levels: 'menu', settings: 'menu', result: 'menu', demolimit: 'menu', journal: 'menu', howto: 'reader', about: 'reader', rules: 'reader' };

  function tapMap(id) {
    if (!id) { G.sel = null; return; }
    if (id.startsWith('g:')) { doGate(id.slice(2)); G.hl = id; }
    else if (id.startsWith('p:')) { const i = +id.slice(2); G.sel = G.sel === i ? null : i; sfx.tick(); }
  }
  function kbTargets() {
    const lv = G.lv, f = G.farm.f;
    return [...gateList(lv).filter((g) => gateState(f, g) !== -1).map((g) => `g:${g.id}`), ...f.plots.map((_, i) => `p:${i}`)];
  }
  function hudClick(id) {
    if (!id) return false;
    const f = G.farm.f;
    if (id === 'pause') { G.paused = true; G.pauseMenu = true; G.ui.scroll = 0; sfx.tick(); return true; }
    if (id === 'speed') { G.speed = G.speed === 1 ? 2 : G.speed === 2 ? 3 : 1; sfx.tick(); return true; }
    if (id === 'think') { think(); return true; }
    if (id === 'think-close') { G.thinkCard = null; G.focus = null; G.focusGate = null; sfx.tick(); return true; }
    if (id === 'think-do') { const s = G.thinkCard; G.thinkCard = null; G.focus = null; G.focusGate = null; applySuggestion(s); return true; }
    if (id === 'card-go') { sfx.tick(); const c = G.card; G.card = null; if (c && c.kind === 'intro') startYear(f); else if (c && c.kind === 'festival') settleYear(); else continueFromCard(f); return true; }
    if (id.startsWith('job:')) { if (G.sel !== null) doJob(G.sel, id.slice(4)); return true; }
    if (id === 'sheet') return true;
    return false;
  }
  function updatePlayInput(input) {
    const ptr = input.pointer, kp = input.keys.pressed;
    const f = G.farm.f;
    if (G.card) {
      cardInput(input);
      if (ptr.pressed && hudHit(ptr.x, ptr.y) === 'card-go') hudClick('card-go');
      else if (kp.has('Enter') || kp.has('Space')) hudClick('card-go');
      return;
    }
    if (G.thinkCard) {
      cardInput(input);
      if (ptr.pressed) { const id = hudHit(ptr.x, ptr.y); if (id) hudClick(id); }
      if (kp.has('Enter')) hudClick(G.thinkCard && G.thinkCard.kind !== 'wait' ? 'think-do' : 'think-close');
      else if (kp.has('Escape') || kp.has('KeyT')) hudClick('think-close');
      return;
    }
    if (ptr.pressed) {
      const id = hudHit(ptr.x, ptr.y);
      if (id && hudClick(id)) return;
      if (!id) G.ui.tapDown = { x: ptr.x, y: ptr.y };
    }
    if (ptr.released && G.ui.tapDown) {
      const d = G.ui.tapDown; G.ui.tapDown = null;
      if (Math.hypot(ptr.x - d.x, ptr.y - d.y) < 26) tapMap(pickMap(G, d.x, d.y));
    }
    if (kp.has('KeyP') || kp.has('Escape')) { hudClick('pause'); return; }
    if (kp.has('KeyT')) { hudClick('think'); return; }
    if (kp.has('Digit1')) G.speed = 1;
    if (kp.has('Digit2')) G.speed = 2;
    if (kp.has('Digit3')) G.speed = 3;
    // keyboard: arrows cycle through gates and fields, Space / Enter acts, letters do jobs
    if (f.ph === 'run') {
      const tg = kbTargets();
      if (kp.has('ArrowRight') || kp.has('ArrowDown')) G.kb = (G.kb + 1) % tg.length;
      if (kp.has('ArrowLeft') || kp.has('ArrowUp')) G.kb = (G.kb - 1 + tg.length) % tg.length;
      G.hl = G.kb >= 0 ? tg[G.kb] : G.hl;
      if ((kp.has('Space') || kp.has('Enter')) && G.kb >= 0) tapMap(tg[G.kb]);
      const jk = { KeyJ: 'plant', KeyW: 'tend', KeyS: 'pests', KeyH: 'harvest', KeyR: 'repair' };
      for (const code of Object.keys(jk)) if (kp.has(code) && G.sel !== null) doJob(G.sel, jk[code]);
    }
  }
  // gentle coaching in the first year of each chapter: what to do now, and a glow on the thing to touch
  function coachUpdate() {
    const f = G.farm.f, lv = G.lv;
    G.coach = null;
    if (G.mode !== 'play' || !lv || lv.year !== 1 || G.record.done[lv.id] || !f || f.ph !== 'run' || G.card || G.thinkCard) { if (G.coachGate) G.focusGate = null; G.coachGate = null; return; }
    let text = '', gate = null;
    const open = f.feed.filter((x) => x === 1).length + f.down.filter((x) => x === 1).length + f.side.filter((x) => x === 1).length;
    if (f.season === 0) {
      if (!open) { text = 'Tap the glowing gate to let the spring water in.'; gate = 'f0'; }
      else if (f.plots.some((p) => p.w < 2.4 && !p.owner)) text = 'Open spill gates so the water falls tier by tier. Fields want the green band: 2.5 to 3.5 hands.';
      else text = 'The mud is soaking. When a field is soft, the next season lets you plant it.';
    } else if (f.season === 1) {
      const ready = f.plots.map((p, i) => i).filter((i) => !f.plots[i].owner && jobsFor(f, i).includes('plant'));
      text = ready.length ? 'Tap a field with a green P, then Plant. Planting costs labour; it refills slowly.' : 'Keep the soaked fields in their band so they are ready to plant.';
    } else if (f.season === 2) text = 'Keep the water steady in the green band. Tap fields with W (weeds) or S (snails) to look after them.';
    else text = 'Drain the fields to 1 hand or less: close the feed gates and open the spill gates. Then Harvest the gold.';
    G.coach = text; G.coachGate = gate; G.focusGate = gate;
  }
  function runSim(dt, mult) {
    farmUpdate(G.farm.f, dt * mult);
    processEvents();
  }
  function updatePlay(dt, input) {
    const f = G.farm.f;
    if (!f) { leaveRun(); return; }
    if (G.pauseMenu) { const inp = colInput('menu', input); MN.ensureLayout(G, 'pause'); updateFlowScene(dt, inp, handlePause, null); column('screen'); return; }
    if (G.mode === 'watch') { updateWatch(dt, input); return; }
    updatePlayInput(input);
    coachUpdate();
    if (f.ph === 'run' && !G.card && !G.thinkCard && !G.paused) runSim(dt, G.speed);
    else processEvents();
    G.floaters = G.floaters.filter((x) => G.t - x.t0 < 1.7);
  }

  // Watch & Learn: the computer farmer thinks, shows what it chose and why, then does it. Pause freezes everything.
  function updateWatch(dt, input) {
    const f = G.farm.f, w = G.watch, ptr = input.pointer;
    cardInput(input);
    if (ptr.pressed) {
      const id = hudHit(ptr.x, ptr.y);
      if (id === 'w-pause') { w.paused = !w.paused; sfx.tick(); }
      else if (id === 'w-faster') { G.settings.thinkIdx = Math.max(0, G.settings.thinkIdx - 1); saveAll(); G.flash = { text: `Thinking time ${THINK_STEPS[G.settings.thinkIdx]} s`, t0: G.t }; }
      else if (id === 'w-slower') { G.settings.thinkIdx = Math.min(THINK_STEPS.length - 1, G.settings.thinkIdx + 1); saveAll(); G.flash = { text: `Thinking time ${THINK_STEPS[G.settings.thinkIdx]} s`, t0: G.t }; }
      else if (id === 'w-quit') { leaveRun(); return; }
    }
    if (input.keys.pressed.has('KeyP') || input.keys.pressed.has('Escape')) w.paused = !w.paused;
    if (w.paused) return;                                            // freezes everything: timers, sim, motion
    G.floaters = G.floaters.filter((x) => G.t - x.t0 < 1.7);
    if (f.ph === 'intro') { if (!w.timer) w.timer = 4; w.timer -= dt; if (w.timer <= 0) { w.timer = 0; G.card = null; startYear(f); w.phase = 'idle'; w.run = 1.5; processEvents(); } return; }
    if (f.ph === 'card') {
      if (!w.timer) w.timer = 4.5;
      w.timer -= dt;
      if (w.timer <= 0) { w.timer = 0; G.card = null; continueFromCard(f); w.phase = 'idle'; w.run = 1; processEvents(); }
      return;
    }
    if (f.ph !== 'run') { processEvents(); return; }
    if (w.phase === 'idle') {
      runSim(dt, 3); w.run -= dt * 3;
      if (w.run <= 0) {
        const s = suggest(f);
        if (s.kind === 'wait') { w.wait += 1; if (w.wait % 3 !== 0) { w.run = WATCH_GAP; return; } }
        w.steps = { first: s };
        w.card = { ...s };
        G.focus = s.plots || []; G.focusGate = s.kind === 'gate' ? s.gate : null;
        w.phase = 'think'; G.thinkTotal = THINK_STEPS[G.settings.thinkIdx]; w.timer = G.thinkTotal; G.ui.cardScroll = 0;
      }
      return;
    }
    w.timer -= dt;
    if (w.phase === 'think' && w.timer <= 0) { w.phase = 'reveal'; w.timer = 2; }
    else if (w.phase === 'reveal' && w.timer <= 0) {
      w.phase = 'act';
      const s = w.steps.first;
      if (s.kind === 'job') {
        doJob(s.plot, s.job);
        // the same job on every other field that is ready: one explanation covers them
        for (let k = 0; k < 5; k++) { const s2 = suggest(f); if (s2.kind === 'job' && s2.job === s.job) doJob(s2.plot, s2.job); else break; }
      } else applySuggestion(s);
      G.focus = null; G.focusGate = null; w.card = null; w.phase = 'idle'; w.run = WATCH_GAP; processEvents();
    }
  }

  // ?shot=1 (store screenshots): a real year played by the computer farmer, advanced to a chosen moment and frozen
  function startShot() {
    const q = new URLSearchParams(globalThis.location ? globalThis.location.search : '');
    const lvId = q.get('lv') || 'c1', at = Number(q.get('at') || 120);
    startRun('shot', lvId); G.mode = 'shot'; G.card = null;
    const f = G.farm.f;
    startYear(f); G.card = null;
    let guard = 0;
    while (f.t < at && f.ph !== 'end' && guard++ < 4000) {
      if (f.ph === 'card') { continueFromCard(f); continue; }
      for (let k = 0; k < 3; k++) {
        const s = suggest(f);
        if (s.kind === 'job') doJob(s.plot, s.job); else if (s.kind === 'gate') applySuggestion(s); else break;
      }
      farmUpdate(f, 2);
    }
    evSeen = f.evId;
    const sel = q.get('sel'); if (sel !== null && sel !== '') G.sel = +sel;
    const cd = q.get('card'); if (cd === 'intro') setCard(yearCard()); else if (cd === 'season') setCard(seasonCard(f));
    const tc = q.get('think'); if (tc) { think(); }
  }
  if (config.shot) {
    const sc = new URLSearchParams(globalThis.location ? globalThis.location.search : '').get('scene');
    if (sc && sc !== 'play') {
      G.scene = sc; G.back = 'title'; G.frozen = true;
      if (sc === 'result') { startShot(); G.farm.f.score = scoreOf(G.farm.f); G.nextLevel = null; G.scene = 'result'; }
    } else { startShot(); G.frozen = true; }
  }

  return {
    // Menus, Rules, About, Watch & Learn, pause, story and Think cards and result screens are free; only live play counts against the preview.
    isPreviewExempt: () => !!config.dev || !(G.scene === 'play' && G.mode === 'play') || G.paused || G.pauseMenu || !!G.card || !!G.thinkCard || !G.farm.f || G.farm.f.ph !== 'run',
    wheel(dy) { G.wheelAcc = (G.wheelAcc || 0) + dy; },
    update(dt, raw) {
      setScreen(meta.width, meta.height);
      if (G.frozen) return;                                   // ?shot=1: a store screenshot frame stays exactly as built
      const kind = G.scene === 'play' ? 'screen' : (COLUMN[G.scene] || 'menu');
      const input = kind === 'screen' ? (column('screen'), setPress(raw.pointer), raw) : colInput(kind, raw);
      G.t += dt;
      switch (G.scene) {
        case 'title': {
          const lt = MN.getLockTap(), pp = input.pointer;
          MN.setLockDown(G.lockDown > G.t);
          if (lt && pp.pressed && pp.x >= lt.x && pp.x <= lt.x + lt.w && pp.y >= lt.y && pp.y <= lt.y + lt.h) { G.lockDown = G.t + 0.25; env.openArcforgeHome?.(); break; }
          updateFlowScene(dt, input, handleTitle, 'title'); break;
        }
        case 'levels': updatePinned(dt, input, 'levels', handleLevels, !!G.setup.lv); break;
        case 'journal': updatePinned(dt, input, 'journal', (id) => { if (id === 'back') go('title'); }, false); break;
        case 'settings': updateFlowScene(dt, input, handleSettings, 'settings'); break;
        case 'result': updateFlowScene(dt, input, handleResult, 'result'); break;
        case 'demolimit': updateFlowScene(dt, input, (id) => { if (id === 'menu') { leaveRun(); go('title'); } }, 'demolimit'); break;
        case 'howto': case 'about': case 'rules': updatePages(input); break;
        case 'play': if (G.mode !== 'shot') { updatePlay(dt, input); ambient(dt); } break;
        default: break;
      }
      G.wheelAcc = 0;
    },
    render(ctx, view) {
      setScreen(meta.width, meta.height);
      G.viewW = (view && view.cssW) || SW; G.viewH = (view && view.cssH) || H;
      column('screen');
      ctx.clearRect(0, 0, SW, H);
      const v = { cssW: G.viewW, cssH: G.viewH };
      if (view && view.noGL && G.scene === 'play') renderFallback(ctx, G, v);
      const kind = G.scene === 'play' ? 'screen' : (COLUMN[G.scene] || 'menu');
      const ox = column(kind);
      ctx.save(); ctx.translate(ox, 0);
      switch (G.scene) {
        case 'title': MN.renderTitle(ctx, G); break;
        case 'levels': MN.renderLevels(ctx, G); break;
        case 'journal': MN.renderJournal(ctx, G); break;
        case 'settings': MN.renderSettings(ctx, G); break;
        case 'result': MN.renderResult(ctx, G); break;
        case 'demolimit': MN.renderDemoLimit(ctx, G); break;
        case 'howto': MN.renderPages(ctx, G, HOWTO, 'How to Play'); break;
        case 'about': MN.renderPages(ctx, G, aboutList, 'About'); break;
        case 'rules': MN.renderPages(ctx, G, RULES, 'Rules'); break;
        case 'play':
          renderHud(ctx, G, v);
          if (G.flash && G.t - G.flash.t0 < 2.2) {
            const L = hudLayout(G.settings.textIdx);
            ctx.save(); ctx.font = `700 ${Math.round(26 * Math.min(L.m0, 1.4))}px sans-serif`; ctx.textAlign = 'center';
            const tw = ctx.measureText(G.flash.text).width + 40, fx = L.mapRect.x + L.mapRect.w / 2, fy = L.mapRect.y + 30;
            ctx.fillStyle = 'rgba(8,22,14,0.88)'; roundPath(ctx, fx - tw / 2, fy - 22, tw, 44, 22); ctx.fill();
            ctx.fillStyle = '#ffe28a'; ctx.textBaseline = 'middle'; ctx.fillText(G.flash.text, fx, fy); ctx.restore();
          }
          if (G.pauseMenu) { const ox2 = column('menu'); ctx.translate(ox2, 0); MN.renderPause(ctx, G); }
          break;
        default: break;
      }
      ctx.restore();
      column('screen');
    },
    getState: () => G,
  };
}

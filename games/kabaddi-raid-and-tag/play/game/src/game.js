// Kabaddi: Raid and Tag. State and flow. The rules are in rules.js, the clock and the movement in sim.js, the opponents in ai.js,
// the panel contents in panel.js, drawing in view.js / menus.js / art.js. This is the only file that mutates `state` outside the sim.
//
// Scenes: title, setup, settings, play (also Watch & Learn and the Learn lessons), result, learn, howto / about / rules, demolimit.
// The 3D presenter (web/view3d, web/main.js) only reads getState(): `state.sc.actors` (positions the sim owns) and `state.sc.events`.
import { W, H, PLAY, resetPlayLayout, TEXT_SCALES, THINK_STEPS, REVEAL_SECS, TEXT_DEC, TEXT_INC, REF_BACK, REF_NEXT, SETUP_PINS, inRect } from './layout.js';
import { newMatch, FORMATION_NAME, ACTION_NAME, defenderPositions, nearestTarget, validTargets, available } from './rules.js';
import { newScene, step, beginPre, preSet, preStart, submitAction, submitResponse, tapTiming, placeAll, RESP_WINDOWS } from './sim.js';
import { suggestRaid, suggestResponse, explainRaid, explainResponse, formationScores, explainFormation } from './ai.js';
import { panelKind, panelWidgets, humanRaids, humanDefends, targetsSorted } from './panel.js';
import { renderPlay, playLayoutNow, panelHit, miniHit } from './view.js';
import { renderTitle, renderSetup, renderSettings, renderResult, renderPause, renderPages, renderDemoLimit, renderLearn, renderHint, renderLesson, hitScreen, flowMeta, pageCount, ensureLayout, resetMenus, resetPages } from './menus.js';
import { ABOUT, HOWTO, RULES, LESSONS } from './content.js';
import { setPress } from './ui.js';

export const meta = { width: W, height: H };
const DEMO_MATCH_CAP = 1;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function createGame(env) {
  const { rng, audio, storage, config, monetization } = env;
  resetMenus(); resetPlayLayout();
  const fx = rng.fork();
  const matchRng = rng.fork();
  let shotMode = false, shotZoom = -1;
  try { shotMode = /[?&]shot=/.test(globalThis.location.search); } catch { shotMode = false; }
  try { const z = /[?&]zoom=(\d)/.exec(globalThis.location.search); if (z) shotZoom = Number(z[1]); } catch { shotZoom = -1; }
  const shotSeed = config.seed | 0;

  const state = {
    scene: 'title', back: 'title', t: 0, paused: false, pauseMenu: false, demo: !!config.demo, v3: false, credits: '',
    settings: { sound: true, textIdx: 0, thinkIdx: 1, respWin: 1, women: false },
    record: { played: 0, wins: [0, 0, 0, 0, 0], draws: 0, lost: 0, bestMargin: 0, touches: 0, superTackles: 0, superRaids: 0, demoMatches: 0, lessons: [] },
    setup: { mode: 'ai', level: 0, length: 'quick' },
    ui: { scroll: 0, drag: null, pscroll: 0, pdrag: null, target: null },
    page: 0, resume: null, loaded: false, sc: null, m: null, mode: 'ai', hint: null, watch: null, lesson: null, over: null, toast: '', toastT: 0, restoreMsg: '', setupMsg: '',
    att: null, shot: false, lastEvt: 0, lastPre: '', flash: 0, viewRect: { x: 0, y: 200, w: W, h: 500 },
  };

  // ---- persistence ------------------------------------------------------------------------------------------------------
  const save = () => { storage.set('settings', state.settings); storage.set('record', state.record); };
  const validResume = (r) => !!r && !!r.cfg && r.m && Array.isArray(r.m.teams) && r.m.teams.length === 2 && r.m.teams.every((t) => Array.isArray(t.players) && t.players.length === 7 && Array.isArray(t.onMat) && Array.isArray(t.outQ))
    && Array.isArray(r.m.score) && r.m.score.length === 2 && !r.m.over && (r.cfg.mode === 'ai' || r.cfg.mode === 'two') && Number.isInteger(r.m.half) && (r.m.half === 1 || r.m.half === 2)
    && Array.isArray(r.m.done) && Number.isInteger(r.m.per) && (r.m.raiding === 0 || r.m.raiding === 1)
    && r.m.teams.every((t) => t.onMat.length + t.outQ.length === 7 && t.onMat.length >= 1);
  const clearResume = () => { state.resume = null; storage.remove('resume'); };
  // the match only changes when a raid ends, so the snapshot taken at the start of each raid is also the right place to continue from
  const saveResume = () => {
    const sc = state.sc;
    if (!sc || state.mode === 'watch' || state.mode === 'lesson' || sc.match.over) { clearResume(); return; }
    state.resume = { cfg: { mode: state.mode, level: state.setup.level, length: sc.match.cfg.length }, m: JSON.parse(JSON.stringify(sc.match)) };
    storage.set('resume', state.resume);
  };
  Promise.all([storage.get('settings', null), storage.get('record', null), storage.get('resume', null)]).then(([s, r, res]) => {
    if (s) Object.assign(state.settings, s);
    if (r) Object.assign(state.record, r);
    const st = state.settings;
    st.textIdx = clamp(st.textIdx | 0, 0, TEXT_SCALES.length - 1);
    st.thinkIdx = clamp(st.thinkIdx | 0, 0, THINK_STEPS.length - 1);
    st.respWin = clamp(st.respWin | 0, 0, RESP_WINDOWS.length - 1);
    if (!Array.isArray(state.record.wins) || state.record.wins.length < 5) state.record.wins = [0, 0, 0, 0, 0];
    if (!Array.isArray(state.record.lessons)) state.record.lessons = [];
    if (validResume(res) && !shotMode) state.resume = res;
    state.loaded = true;
    audio.setMuted?.(!st.sound);
  }).catch(() => { state.loaded = true; });

  // ---- sound ----------------------------------------------------------------------------------------------------------------
  const tone = (o) => { if (state.settings.sound) audio.tone(o); };
  const sfx = {
    tick: () => tone({ freq: 880, dur: 0.04, type: 'triangle', vol: 0.05 }),
    whistle: () => { tone({ freq: 2300, to: 2150, dur: 0.2, type: 'sine', vol: 0.06 }); tone({ freq: 2420, to: 2250, dur: 0.2, type: 'sine', vol: 0.04 }); },
    touch: () => { tone({ freq: 660, to: 990, dur: 0.12, type: 'triangle', vol: 0.09 }); },
    thud: () => { tone({ freq: 150, to: 55, dur: 0.18, type: 'sine', vol: 0.28 }); tone({ freq: 400, to: 200, dur: 0.05, type: 'triangle', vol: 0.05 }); },
    point: () => [0, 4, 7].forEach((n, i) => tone({ freq: 523 * Math.pow(2, n / 12), dur: 0.22 + i * 0.05, type: 'triangle', vol: 0.1 })),
    lose: () => tone({ freq: 300, to: 120, dur: 0.4, type: 'sawtooth', vol: 0.05 }),
    ring: (perfect) => tone({ freq: perfect ? 1320 : 990, dur: 0.07, type: 'triangle', vol: 0.07 }),
    win: () => [0, 2, 4, 7, 9, 12].forEach((n, i) => tone({ freq: 440 * Math.pow(2, n / 12), dur: 0.3 + i * 0.05, type: 'triangle', vol: 0.1 })),
  };
  const toast = (text, secs = 2.2) => { state.toast = text; state.toastT = secs; };

  // ---- the match ------------------------------------------------------------------------------------------------------------------
  const controls = (cfg) => {
    if (cfg.mode === 'two') return { human: [true, true], levels: [0, 0], watch: false, twoHumans: true, respWin: state.settings.respWin };
    if (cfg.mode === 'watch') return { human: [false, false], levels: [cfg.a, cfg.b], watch: true, respWin: state.settings.respWin };
    if (cfg.mode === 'lesson') return { human: [!cfg.defend, !!cfg.defend], levels: [0, 0], watch: false, respWin: 2, rig: cfg.rig, script: cfg.script };
    return { human: [true, false], levels: [0, cfg.level], watch: false, respWin: state.settings.respWin };
  };
  const afterNewScene = () => {
    const sc = state.sc;
    state.m = sc.match; state.hint = null; state.watch = null; state.over = null; state.ui.target = null; state.lastEvt = 0; state.paused = false; state.pauseMenu = false;
    state.scene = 'play'; state.ui.scroll = 0; state.ui.pscroll = 0; PLAY.key = '';
    beginPre(sc);
    state.lastPre = `${sc.match.raids}:${sc.match.half}`;
    afterPre();
  };
  // a raid begins with the 'pre' phase: save so that a quit here continues at the start of this raid
  const afterPre = () => { if (state.mode === 'ai' || state.mode === 'two') saveResume(); };
  const startMatch = (cfg) => {
    if (state.demo && cfg.mode !== 'watch' && cfg.mode !== 'lesson' && state.record.demoMatches >= DEMO_MATCH_CAP) { state.scene = 'demolimit'; state.ui.scroll = 0; return; }
    state.mode = cfg.mode; state.lesson = null;
    const first = cfg.first ?? matchRng.int(2);
    const m = newMatch(matchRng.fork(), { length: cfg.length, first, mode: cfg.mode, level: cfg.level });
    state.sc = newScene(m, rng, controls(cfg));
    afterNewScene();
  };
  const startWatch = () => {
    const a = 1 + fx.int(3), b = Math.min(4, a + 1 + fx.int(2));
    startMatch({ mode: 'watch', a, b, length: 'quick', first: fx.int(2) });
  };
  const resumeMatch = () => {
    const r = state.resume;
    if (!r) return;
    if (state.demo && state.record.demoMatches >= DEMO_MATCH_CAP) { clearResume(); state.scene = 'demolimit'; state.ui.scroll = 0; return; }
    state.mode = r.cfg.mode; state.lesson = null; state.setup.level = r.cfg.level ?? 0;
    const m = JSON.parse(JSON.stringify(r.m));
    state.sc = newScene(m, rng, controls({ mode: r.cfg.mode, level: r.cfg.level ?? 0 }));
    placeAll(state.sc);
    afterNewScene();
    // resuming always starts paused, so nothing happens until the player says so
    state.paused = true; state.pauseMenu = true; state.ui.scroll = 0;
  };
  const startLesson = (idx) => {
    const def = LESSONS[idx];
    const cfg = { mode: 'lesson', defend: !def.raider, rig: def.rig, length: 'quick', level: 0, first: def.raider ? 0 : 1 };
    state.mode = 'lesson';
    const m = newMatch(matchRng.fork(), { length: 'quick', first: cfg.first, mode: 'lesson' });
    if (def.dod) m.teams[0].empty = 2;
    if (def.outs) { const t = m.teams[0]; t.outQ = [5, 6].slice(0, def.outs); t.onMat = t.onMat.filter((x) => !t.outQ.includes(x)); }
    const script = def.raider ? undefined : [{ action: 'hand', target: 'nearest' }];
    state.sc = newScene(m, rng, controls({ ...cfg, script }));
    state.lesson = { idx, def, phase: 'intro', t: 0, startEvt: 0 };
    state.m = m; state.hint = null; state.watch = null; state.paused = false; state.pauseMenu = false; state.scene = 'play'; state.ui.scroll = 0; state.ui.pscroll = 0; PLAY.key = ''; state.lastEvt = 0; state.over = null;
    beginPre(state.sc);
    preStart(state.sc);
  };
  const leaveMatch = () => {
    if (state.mode === 'ai' || state.mode === 'two') saveResume();
    state.scene = state.mode === 'lesson' ? 'learn' : 'title'; state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; state.hint = null; state.watch = null;
    if (state.mode === 'lesson') state.lesson = null;
  };
  const finishMatch = () => {
    if (state.scene === 'result') return;
    const sc = state.sc, m = sc.match, rec = state.record;
    state.scene = 'result'; state.ui.scroll = 0; state.over = { winner: m.over.winner, score: [...m.score], mode: state.mode, level: state.setup.level, stats: JSON.parse(JSON.stringify(m.stats)) };
    clearResume();
    if (state.mode === 'ai') {
      rec.played++;
      if (m.over.winner === 0) { rec.wins[state.setup.level] = (rec.wins[state.setup.level] | 0) + 1; rec.bestMargin = Math.max(rec.bestMargin, m.score[0] - m.score[1]); sfx.win(); }
      else if (m.over.winner === 1) { rec.lost++; sfx.lose(); } else rec.draws++;
      rec.touches += m.stats[0].touches; rec.superTackles += m.stats[0].superTackles; rec.superRaids += m.stats[0].superRaids;
      if (state.demo) rec.demoMatches++;
    }
    save();
  };

  // ---- hints (Think) ----------------------------------------------------------------------------------------------------------------
  const raidSketch = (sc) => {
    const m = sc.match, rt = m.raiding;
    return { team: rt, def: 1 - rt, raider: sc.pre.raider, defIds: [...m.teams[1 - rt].onMat].sort((a, b) => a - b), nDef: m.teams[1 - rt].onMat.length, form: 'arc', P: { x: 5, u: 0 }, crossed: false, banked: [], bonus: false, bonusTried: false, beat: 0, closure: 0, off: [], blocked: false, dod: m.teams[rt].empty >= 2, clock: 30, cant: 1, history: [], lastFeints: 0 };
  };
  const buildHint = () => {
    const sc = state.sc;
    if (!sc) return null;
    const m = sc.match;
    if (sc.phase === 'pre' && sc.pre) {
      const p = sc.pre;
      if (p.humanD) {
        const sco = formationScores(m, raidSketch(sc)).sort((a, b) => b.ev - a.ev);
        const f = sco[0].f;
        return { title: 'Think', lines: [`Suggested formation: ${FORMATION_NAME[f]}.`, explainFormation(m, null, f), `Against this raider it rates ahead of the ${FORMATION_NAME[sco[1].f].toLowerCase()}.`], apply: { kind: 'formation', value: f } };
      }
      if (p.humanR) {
        let best = null, bs = -1;
        for (const id of m.teams[p.team].onMat) { const q = m.teams[p.team].players[id], s = (q.spd + q.agi + q.rch) / 3; if (s > bs) { bs = s; best = id; } }
        const q = m.teams[p.team].players[best];
        return { title: 'Think', lines: [`Raider #${q.num} has the best mix of speed, agility and reach on the mat.`, `Speed ${Math.round(q.spd * 100)}, agility ${Math.round(q.agi * 100)}, reach ${Math.round(q.rch * 100)} out of 100.`], apply: { kind: 'raider', value: best } };
      }
    }
    if (sc.phase === 'decide' && sc.need && sc.need.kind === 'action' && humanRaids(state)) {
      const pick = suggestRaid(m, sc.raid);
      const lines = explainRaid(m, sc.raid, pick);
      const alt = pick.alts[0];
      if (alt) lines.push(`Next best: ${ACTION_NAME[alt.action]}${alt.target != null ? ` on #${m.teams[sc.raid.def].players[alt.target].num}` : ''}.`);
      return { title: 'Think', lines, apply: { kind: 'act', action: pick.action, target: pick.target } };
    }
    if (sc.phase === 'commit' && sc.need && sc.need.kind === 'response' && humanDefends(state)) {
      const tele = sc.need.tele, pick = suggestResponse(m, sc.raid, tele);
      return { title: 'Think', lines: explainResponse(m, sc.raid, tele, pick), apply: { kind: 'resp', value: pick.resp } };
    }
    return null;
  };
  const openHint = () => {
    const h = buildHint();
    if (!h) { toast('Nothing to think about right now', 1.4); return; }
    state.hint = h; state.paused = true; state.ui.scroll = 0; sfx.tick();
  };
  const closeHint = () => { state.hint = null; state.paused = false; state.ui.scroll = 0; };
  const applyHint = () => {
    const h = state.hint; if (!h) return;
    const a = h.apply;
    closeHint();
    const sc = state.sc;
    if (a.kind === 'formation') preSet(sc, 'formation', a.value);
    else if (a.kind === 'raider') preSet(sc, 'raider', a.value);
    else if (a.kind === 'act') { state.ui.target = a.target; submitAction(sc, a.action, a.target); }
    else if (a.kind === 'resp') submitResponse(sc, a.value);
  };

  // ---- watch & learn ----------------------------------------------------------------------------------------------------------------
  const preText = (sc) => {
    const m = sc.match, p = sc.pre, q = m.teams[p.team].players[p.raider];
    return `${p.team === 0 ? 'Blue' : 'Red'} raid with #${q.num}; ${p.team === 0 ? 'Red' : 'Blue'} line up in a ${FORMATION_NAME[p.formation].toLowerCase()}.`;
  };
  const watchStep = (dt) => {
    const sc = state.sc, need = sc.need;
    if (!need || !need.ai) { state.watch = null; return; }
    const key = `${need.kind}:${sc.raid ? sc.raid.beat : -1}:${sc.match.raids}:${sc.phase}`;
    if (!state.watch || state.watch.key !== key) {
      state.watch = { key, phase: need.kind === 'pre' ? 'reveal' : 'think', t: 0, dur: THINK_STEPS[state.settings.thinkIdx], text: '' };
      if (need.kind === 'pre') state.watch.text = preText(sc);
    }
    const w = state.watch;
    w.t += dt;
    if (w.phase === 'think' && w.t >= w.dur) { w.phase = 'reveal'; w.t = 0; w.text = (need.why ?? []).join(' '); if (need.kind === 'action' && need.pick.target != null) state.ui.target = need.pick.target; }
    else if (w.phase === 'reveal' && w.t >= REVEAL_SECS) {
      const kind = need.kind, pick = need.pick;
      state.watch = null;
      if (kind === 'pre') preStart(sc);
      else if (kind === 'action') { if (!submitAction(sc, pick.action, pick.target)) submitAction(sc, 'retreat', null); }
      else if (kind === 'response') submitResponse(sc, pick);
    }
  };

  // ---- pause ----------------------------------------------------------------------------------------------------------------------------
  const openPause = () => { if (state.scene !== 'play') return; state.paused = true; state.pauseMenu = true; state.ui.scroll = 0; };
  const closePause = () => { state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; };

  // ---- events from the sim: sounds ------------------------------------------------------------------------------------------------------
  const consumeEvents = () => {
    const sc = state.sc;
    for (const e of sc.events) {
      if (e.id <= state.lastEvt) continue;
      state.lastEvt = e.id;
      if (e.type === 'raidStart') sfx.whistle();
      else if (e.type === 'contact') { if (e.caught) sfx.thud(); else if (e.touched.length || e.bonusGot) sfx.touch(); }
      else if (e.type === 'raidEnd') { const s = e.summary; if (s.touches || s.bonus || s.defPts) { const mine = sc.ctl.human[s.defPts ? e.def : e.team]; if (mine || state.mode === 'watch') sfx.point(); else sfx.lose(); } }
    }
  };

  // ---- lessons ----------------------------------------------------------------------------------------------------------------------------
  const lessonStep = () => {
    const L = state.lesson;
    if (!L || L.phase !== 'play') return;
    const sc = state.sc;
    const e = sc.events.find((x) => x.type === 'raidEnd' && x.id > L.startEvt);
    if (!e) return;
    const s = e.summary;
    const ok = L.def.id === 'raid' ? s.empty : L.def.raider ? (s.touches + s.bonus > 0 && s.how === 'safe') : s.how === 'caught';
    if (ok) { L.phase = 'done'; state.record.lessons = Array.from(new Set([...state.record.lessons, L.def.id])); save(); sfx.win(); } else L.phase = 'retry';
    state.paused = true; state.ui.scroll = 0;
  };

  // ---- the play scene ---------------------------------------------------------------------------------------------------------------------
  const selectTarget = (dir) => {
    const sc = state.sc, raid = sc.raid;
    const pos = defenderPositions(raid), list = targetsSorted(raid, pos);
    if (!list.length) return;
    let i = list.indexOf(state.ui.target);
    if (i < 0) { state.ui.target = nearestTarget(raid, pos); return; }
    state.ui.target = list[(i + dir + list.length) % list.length];
  };
  const lessonAllows = (id) => !(state.lesson && state.lesson.phase === 'play' && !state.lesson.def.allow.includes(id));
  const pressAction = (a) => {
    const sc = state.sc;
    if (panelKind(state) !== 'raid') return;
    if (!lessonAllows(a)) { toast('Not in this lesson', 1.4); return; }
    sfx.tick();
    if (!submitAction(sc, a, state.ui.target)) toast(available(sc.raid)[a] || 'That move is not available now', 1.8);
  };
  const pressResponse = (r) => { if (panelKind(state) !== 'resp' || !lessonAllows(r)) return; sfx.tick(); submitResponse(state.sc, r); };
  const pressStart = () => { const sc = state.sc; if (sc.phase !== 'pre') return; sfx.tick(); preStart(sc); };
  const handlePanelTap = (id) => {
    if (!id) return;
    const sc = state.sc;
    if (id.startsWith('act-')) pressAction(id.slice(4));
    else if (id.startsWith('resp-')) pressResponse(id.slice(5));
    else if (id === 'start') pressStart();
    else if (id.startsWith('form-')) { preSet(sc, 'formation', id.slice(5)); sfx.tick(); }
    else if (id === 'rprev' || id === 'rnext') {
      const on = sc.match.teams[sc.pre.team].onMat, i = on.indexOf(sc.pre.raider), d = id === 'rnext' ? 1 : -1;
      preSet(sc, 'raider', on[(i + d + on.length) % on.length]); sfx.tick();
    } else if (id === 'tprev') { selectTarget(-1); sfx.tick(); } else if (id === 'tnext') { selectTarget(1); sfx.tick(); }
  };
  function handlePanel(input, lay) {
    const ptr = input.pointer, S = PLAY.scroll;
    if (ptr.pressed && inRect(S, ptr.x, ptr.y)) state.ui.pdrag = { y0: ptr.y, x0: ptr.x, s0: state.ui.pscroll, moved: 0 };
    if (state.ui.pdrag && ptr.down) {
      const d = state.ui.pdrag; d.moved = Math.max(d.moved, Math.abs(ptr.y - d.y0));
      const max = Math.max(0, S.contentH - S.h);
      if (d.moved >= 10 && max > 0) state.ui.pscroll = clamp(d.s0 - (ptr.y - d.y0), 0, max);
    }
    if (ptr.released && state.ui.pdrag) {
      const d = state.ui.pdrag; state.ui.pdrag = null;
      if (d.moved < 10) handlePanelTap(panelHit(state, lay, d.x0, d.y0));
    }
  }
  function scrollFlow(ptr) {
    const d = state.ui.drag, mt = flowMeta();
    d.moved = Math.max(d.moved, Math.abs(ptr.y - d.y0));
    if (d.moved >= 10 && mt.lay) {
      const max = Math.max(0, mt.lay.contentH - (mt.bottom - mt.top));
      state.ui.scroll = clamp(d.s0 - (ptr.y - d.y0), 0, max);
    }
  }
  function updateFlowOverlay(input, key, handler) {
    const ptr = input.pointer;
    ensureLayout(state, key);
    if (ptr.pressed) state.ui.drag = { y0: ptr.y, x0: ptr.x, s0: state.ui.scroll, moved: 0 };
    if (state.ui.drag && ptr.down) scrollFlow(ptr);
    if (ptr.released && state.ui.drag) { const d = state.ui.drag; state.ui.drag = null; if (d.moved < 10) handler(hitScreen(ptr.x, ptr.y, state.ui.scroll)); }
    if (input.keys.pressed.has('Escape') && key === 'pause') closePause();
  }
  function handlePauseTap(id) {
    if (!id) return;
    sfx.tick();
    if (id === 'resume') closePause();
    else if (id === 'p-rules') { state.back = 'play'; state.scene = 'rules'; state.page = 0; }
    else if (id === 'p-howto') { state.back = 'play'; state.scene = 'howto'; state.page = 0; }
    else if (id === 'p-sound') { state.settings.sound = !state.settings.sound; audio.setMuted?.(!state.settings.sound); save(); }
    else if (id === 'quit') leaveMatch();
  }
  const handleHintTap = (id) => { if (id === 'hint-do') applyHint(); else if (id === 'hint-close') closeHint(); };
  function handleLessonTap(id) {
    const L = state.lesson;
    if (!id || !L) return;
    sfx.tick();
    if (id === 'ls-start') { L.phase = 'play'; L.startEvt = state.sc.eid; state.ui.scroll = 0; }
    else if (id === 'ls-retry') startLesson(L.idx);
    else if (id === 'ls-next') { const n = L.idx + 1; if (n < LESSONS.length) startLesson(n); else { state.scene = 'learn'; state.lesson = null; state.paused = false; state.ui.scroll = 0; } }
    else if (id === 'ls-back') { state.scene = 'learn'; state.lesson = null; state.paused = false; state.ui.scroll = 0; }
  }
  const keyboard = (keys, kind) => {
    const map = { Digit1: 'step', Digit2: 'feintL', Digit3: 'feintR', Digit4: 'hand', Digit5: 'toe', Digit6: 'run', Digit7: 'bonus', Digit8: 'retreat' };
    const rmap = { Digit1: 'ankle', Digit2: 'thigh', Digit3: 'chain', Digit4: 'block', Digit5: 'dash', Digit6: 'hold' };
    if (kind === 'raid') { for (const [k, a] of Object.entries(map)) if (keys.pressed.has(k)) pressAction(a); if (keys.pressed.has('ArrowLeft')) selectTarget(-1); if (keys.pressed.has('ArrowRight')) selectTarget(1); }
    if (kind === 'resp') for (const [k, r] of Object.entries(rmap)) if (keys.pressed.has(k)) pressResponse(r);
    if (kind === 'pre' && (keys.pressed.has('Enter') || keys.pressed.has('Space'))) pressStart();
  };
  const updatePlay = (dt, input) => {
    const ptr = input.pointer, keys = input.keys, sc = state.sc;
    if (!sc) { state.scene = 'title'; return; }
    const kind = panelKind(state);
    const lay = playLayoutNow(state, panelWidgets(state));
    if (state.pauseMenu) { updateFlowOverlay(input, 'pause', handlePauseTap); return; }
    if (state.hint) { updateFlowOverlay(input, 'hint', handleHintTap); return; }
    if (state.lesson && state.lesson.phase !== 'play') { updateFlowOverlay(input, 'lesson', handleLessonTap); return; }
    if (keys.pressed.has('KeyP') || keys.pressed.has('Escape')) { if (state.mode === 'watch') state.paused = !state.paused; else openPause(); }
    if (ptr.pressed) {
      if (inRect(PLAY.menu, ptr.x, ptr.y)) { if (state.mode === 'watch') leaveMatch(); else openPause(); return; }
      if (inRect(PLAY.think, ptr.x, ptr.y)) { if (state.mode === 'watch') { state.paused = !state.paused; sfx.tick(); } else openHint(); return; }
    }
    if (keys.pressed.has('KeyH') && state.mode !== 'watch') openHint();
    if (state.paused) return;                       // everything below is frozen while paused: the clock, the animation, the computer's thinking
    handlePanel(input, lay);
    if (ptr.pressed && state.mode !== 'watch') {
      if (kind === 'raid') { const id = miniHit(state, ptr.x, ptr.y); if (id != null) { state.ui.target = id; sfx.tick(); } }
      // a tap anywhere above the panel while the contact ring is closing is the timing tap
      if (sc.phase === 'contact' && ptr.y < PLAY.coach.y) { if (tapTiming(sc)) sfx.ring(sc.beat && Math.abs(sc.t - sc.beat.tc) < 0.12); }
    }
    if (keys.pressed.has('Space') && state.mode !== 'watch' && sc.phase === 'contact') tapTiming(sc);
    keyboard(keys, kind);
    if (kind === 'raid' && sc.raid) { if (!validTargets(sc.raid).includes(state.ui.target)) state.ui.target = nearestTarget(sc.raid); }
    if (state.toastT > 0) state.toastT -= dt;
    if (state.mode === 'watch') watchStep(dt);
    step(sc, dt);
    consumeEvents();
    const pk = `${sc.match.raids}:${sc.match.half}`;
    if (sc.phase === 'pre' && state.lastPre !== pk) { state.lastPre = pk; afterPre(); }
    if (sc.phase !== 'pre' && sc.phase !== 'over') { /* a raid is under way */ }
    lessonStep();
    if (sc.phase === 'over') finishMatch();
  };

  // ---- menus ------------------------------------------------------------------------------------------------------------------------------------
  const handleTitle = (id) => {
    if (!id) return;
    sfx.tick();
    if (id === 'play') { state.setup.mode = 'ai'; state.scene = 'setup'; state.ui.scroll = 0; state.setupMsg = ''; }
    else if (id === 'two') { state.setup.mode = 'two'; state.scene = 'setup'; state.ui.scroll = 0; state.setupMsg = ''; }
    else if (id === 'learn') { state.scene = 'learn'; state.ui.scroll = 0; }
    else if (id === 'watch') startWatch();
    else if (id === 'continue') resumeMatch();
    else if (id === 'howto' || id === 'rules' || id === 'about') { state.back = 'title'; state.scene = id; state.page = 0; }
    else if (id === 'settings') { state.scene = 'settings'; state.ui.scroll = 0; }
    else if (id === 'sound') { state.settings.sound = !state.settings.sound; audio.setMuted?.(!state.settings.sound); save(); }
  };
  const handleSetup = (id) => {
    if (!id) return;
    const s = state.setup;
    sfx.tick();
    if (id.startsWith('lv')) { const i = Number(id.slice(2)); if (state.demo && i > 1) { state.setupMsg = 'That opponent is in the full game.'; return; } s.level = i; state.setupMsg = ''; }
    else if (id === 'len-quick') s.length = 'quick';
    else if (id === 'len-full') { if (state.demo) { state.setupMsg = 'Full matches are in the full game.'; return; } s.length = 'full'; }
    else if (id === 'start') startMatch({ mode: s.mode, level: s.level, length: state.demo ? 'quick' : s.length });
    else if (id === 'back') { state.scene = 'title'; state.ui.scroll = 0; }
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
    else if (id === 'resp-dec') st.respWin = Math.min(RESP_WINDOWS.length - 1, st.respWin + 1);      // a longer index is a shorter window
    else if (id === 'resp-inc') st.respWin = Math.max(0, st.respWin - 1);
    else if (id === 'set-women') st.women = !st.women;
    else if (id === 'restore') {
      state.restoreMsg = 'Checking with the store...';
      Promise.resolve(monetization.restore?.()).then(() => { state.restoreMsg = monetization.owns('unlock_game') ? 'Purchase restored. Thank you!' : 'No previous purchase found.'; }).catch(() => { state.restoreMsg = 'The store is not available right now.'; });
    } else if (id === 'back') { state.scene = 'title'; state.ui.scroll = 0; state.restoreMsg = ''; }
    save();
  };
  const handleLearn = (id) => {
    if (!id) return;
    sfx.tick();
    if (id === 'back') { state.scene = 'title'; state.ui.scroll = 0; }
    else if (id.startsWith('lesson')) startLesson(Number(id.slice(6)));
  };
  const handleResult = (id) => {
    if (!id) return;
    sfx.tick();
    const mode = state.over?.mode;
    if (id === 'again') { if (mode === 'watch') startWatch(); else startMatch({ mode, level: state.setup.level, length: state.sc.match.cfg.length }); }
    else if (id === 'new') { state.setup.mode = mode === 'watch' ? 'ai' : mode; state.scene = 'setup'; state.ui.scroll = 0; }
    else if (id === 'menu') { state.scene = 'title'; state.ui.scroll = 0; }
  };
  const updateFlowScene = (dt, input, handler, key) => {
    const ptr = input.pointer;
    if (key) ensureLayout(state, key);
    if (ptr.pressed) state.ui.drag = { y0: ptr.y, x0: ptr.x, s0: state.ui.scroll, moved: 0 };
    if (state.ui.drag && ptr.down) scrollFlow(ptr);
    if (ptr.released && state.ui.drag) {
      const d = state.ui.drag; state.ui.drag = null;
      const lay = flowMeta();
      const scrollable = lay.lay && lay.lay.contentH > lay.bottom - lay.top;
      if (d.moved < 10) handler(hitScreen(ptr.x, ptr.y, state.ui.scroll));
      else if (!scrollable) handler(hitScreen(d.x0, d.y0, state.ui.scroll));
    }
    const mt = flowMeta();
    const max = mt.lay ? Math.max(0, mt.lay.contentH - (mt.bottom - mt.top)) : 0;
    if (input.keys.pressed.has('Equal') || input.keys.pressed.has('NumpadAdd')) { state.settings.textIdx = Math.min(TEXT_SCALES.length - 1, state.settings.textIdx + 1); save(); }
    if (input.keys.pressed.has('Minus') || input.keys.pressed.has('NumpadSubtract')) { state.settings.textIdx = Math.max(0, state.settings.textIdx - 1); save(); }
    if (input.keys.down.has('ArrowDown')) state.ui.scroll = clamp(state.ui.scroll + 14, 0, max);
    if (input.keys.down.has('ArrowUp')) state.ui.scroll = clamp(state.ui.scroll - 14, 0, max);
  };
  const updateSetup = (dt, input) => {
    const ptr = input.pointer, k = input.keys;
    if (k.pressed.has('Enter')) { handleSetup('start'); return; }
    if (k.pressed.has('Escape')) { handleSetup('back'); return; }
    if (ptr.pressed && (inRect(SETUP_PINS.start, ptr.x, ptr.y) || inRect(SETUP_PINS.back, ptr.x, ptr.y))) { handleSetup(inRect(SETUP_PINS.start, ptr.x, ptr.y) ? 'start' : 'back'); return; }
    updateFlowScene(dt, input, handleSetup, 'setup');
  };
  const updatePages = (input) => {
    const ptr = input.pointer, keys = input.keys, n = pageCount(state);
    const close = () => { state.scene = state.back === 'play' ? 'play' : 'title'; state.page = 0; };
    const next = () => { if (state.page >= n - 1) close(); else state.page++; };
    const prev = () => { if (state.page <= 0) close(); else state.page--; };
    if (ptr.pressed) {
      if (inRect(REF_NEXT, ptr.x, ptr.y)) next();
      else if (inRect(REF_BACK, ptr.x, ptr.y)) prev();
      else if (inRect(TEXT_DEC, ptr.x, ptr.y)) { state.settings.textIdx = Math.max(0, state.settings.textIdx - 1); save(); }
      else if (inRect(TEXT_INC, ptr.x, ptr.y)) { state.settings.textIdx = Math.min(TEXT_SCALES.length - 1, state.settings.textIdx + 1); save(); }
    }
    if (keys.pressed.has('ArrowRight')) next();
    if (keys.pressed.has('ArrowLeft')) prev();
    if (keys.pressed.has('Escape')) close();
  };

  // ---- the attract court behind the title -------------------------------------------------------------------------------------------------
  const updateAttract = (dt) => {
    if (!state.att) {
      const m = newMatch(fx.fork(), { length: 'quick', first: 0 });
      const sc = newScene(m, fx, { human: [false, false], levels: [3, 3], watch: false });
      beginPre(sc); state.att = sc;
    }
    const sc = state.att;
    if (sc.phase === 'pre') preStart(sc);
    if (sc.phase === 'over' || sc.match.over) { state.att = null; return; }
    step(sc, Math.min(dt, 1 / 30));
  };

  // ---- shot presets (store screenshots): ?shot=1&seed=N picks a fixed, deterministic screen ----------------------------------------------------
  const autoplay = (sc) => {
    if (sc.phase === 'pre') preStart(sc);
    const nd = sc.need;
    if (!nd) return;
    if (nd.ai) { if (nd.kind === 'action') submitAction(sc, nd.pick.action, nd.pick.target); else if (nd.kind === 'response') submitResponse(sc, nd.pick); else if (nd.kind === 'pre') preStart(sc); return; }
    if (nd.kind === 'action') { const p = suggestRaid(sc.match, sc.raid); submitAction(sc, p.action, p.target); }
    else if (nd.kind === 'response') submitResponse(sc, suggestResponse(sc.match, sc.raid, nd.tele).resp);
  };
  const runUntil = (sc, test, maxSecs = 500) => { let guard = 0; while (!test(sc) && guard < maxSecs * 60) { autoplay(sc); step(sc, 1 / 60); guard++; } };
  const shotMatch = (cfg, until) => {
    startMatch(cfg);
    const sc = state.sc;
    runUntil(sc, until);
    if (sc.raid) state.ui.target = nearestTarget(sc.raid);
    state.lastEvt = sc.eid;
  };
  const applyPreset = () => {
    state.shot = true;
    if (shotZoom >= 0 && shotZoom < TEXT_SCALES.length) state.settings.textIdx = shotZoom;
    const n = ((shotSeed % 100) + 100) % 100;
    const decide = (b) => (sc) => sc.phase === 'decide' && sc.raid.beat >= b;
    if (n === 1) { state.scene = 'title'; state.att = null; updateAttract(0.1); for (let i = 0; i < 420; i++) updateAttract(1 / 60); return; }
    if (n === 2) { shotMatch({ mode: 'ai', level: 2, length: 'quick', first: 0 }, (sc) => sc.phase === 'decide' && sc.raid.beat >= 1 && sc.raid.crossed); return; }
    if (n === 3) { shotMatch({ mode: 'ai', level: 2, length: 'quick', first: 0 }, (sc) => sc.phase === 'contact' && sc.beat && ['hand', 'toe', 'run'].includes(sc.beat.action) && sc.t > sc.beat.tc - 0.3); return; }
    if (n === 4) { shotMatch({ mode: 'ai', level: 3, length: 'quick', first: 1 }, (sc) => sc.phase === 'commit' && sc.need && sc.need.kind === 'response' && sc.raid.beat >= 1); return; }
    if (n === 5) { shotMatch({ mode: 'ai', level: 2, length: 'quick', first: 0 }, (sc) => sc.phase === 'after' && sc.afterKind === 'tackle' && sc.phaseT > 0.6); return; }
    if (n === 6) { shotMatch({ mode: 'watch', a: 3, b: 4, length: 'quick', first: 0 }, (sc) => sc.phase === 'result' && sc.summary && sc.summary.touches >= 2); return; }
    if (n === 7) { state.back = 'title'; state.scene = 'rules'; state.page = 1; return; }
    if (n === 8) { state.back = 'title'; state.scene = 'howto'; state.page = 0; return; }
    if (n === 9) { state.scene = 'setup'; return; }
    if (n === 10) { state.scene = 'settings'; return; }
    if (n === 11) { state.back = 'title'; state.scene = 'about'; return; }
    if (n === 12) { state.scene = 'learn'; return; }
    if (n === 13) { shotMatch({ mode: 'ai', level: 2, length: 'quick', first: 0 }, decide(1)); openHint(); return; }
    if (n === 14) { shotMatch({ mode: 'ai', level: 1, length: 'quick', first: 0 }, decide(1)); openPause(); return; }
    if (n >= 15 && n <= 19) {
      state.settings.textIdx = 4;
      if (n === 15) { state.back = 'title'; state.scene = 'rules'; state.page = 3; }
      else if (n === 16) state.scene = 'title';
      else if (n === 17) shotMatch({ mode: 'ai', level: 2, length: 'quick', first: 0 }, decide(1));
      else if (n === 18) state.scene = 'settings';
      else state.scene = 'setup';
      return;
    }
    if (n === 20) { shotMatch({ mode: 'ai', level: 2, length: 'quick', first: 0 }, (sc) => sc.phase === 'over' || !!sc.match.over, 900); finishMatch(); return; }
    if (n === 22) {   // a chain tackle: every answer is a chain and the first exchange after the step is a hold
      startMatch({ mode: 'ai', level: 2, length: 'quick', first: 0 });
      const sc = state.sc; sc.brains[1].chooseResponse = () => 'chain';
      let guard = 0;
      while (!(sc.phase === 'after' && sc.afterKind === 'tackle' && sc.phaseT > 0.9) && guard++ < 60 * 400) {
        sc.ctl.rig = sc.raid && sc.raid.beat >= 1 && sc.raid.crossed ? { touch: false, catch: true } : undefined;
        if (sc.phase === 'pre') preStart(sc);
        if (sc.need && sc.need.kind === 'action') { if (!sc.raid.crossed) submitAction(sc, 'step', null); else submitAction(sc, 'hand', null); }
        step(sc, 1 / 60);
      }
      sc.ctl.rig = undefined; state.lastEvt = sc.eid; return;
    }
    if (n === 23) {   // the bonus line
      startMatch({ mode: 'ai', level: 2, length: 'quick', first: 0 });
      const sc = state.sc; let guard = 0;
      while (!(sc.phase === 'contact' && sc.beat && sc.beat.action === 'bonus' && sc.beat.tc - sc.t < 0.12) && guard++ < 60 * 400) {
        if (sc.phase === 'pre') preStart(sc);
        if (sc.need && sc.need.kind === 'action') submitAction(sc, 'bonus', null);
        step(sc, 1 / 60);
      }
      state.lastEvt = sc.eid; return;
    }
    if (n === 21) { shotMatch({ mode: 'ai', level: 2, length: 'quick', first: 1 }, (sc) => sc.phase === 'pre' && sc.match.raids >= 2); return; }
  };

  // ---- the object the kit and the shell see -------------------------------------------------------------------------------------------------------
  const aboutList = () => state.creditsList ?? ABOUT;
  const game = {
    // Watch & Learn, Learn, every menu and a paused match are free; only real play counts against the free preview.
    isPreviewExempt: () => !(state.scene === 'play' && state.mode !== 'watch' && state.mode !== 'lesson') || state.paused,
    setView3d(on) { state.v3 = !!on; },
    // verification pages start a match directly (not used by the app)
    debugStart: (cfg) => startMatch(cfg),
    setCredits(text) {
      state.credits = String(text || '');
      const paras = state.credits.split(/\n{2,}/).map((s) => s.replace(/^#+\s*/gm, '').replace(/\n/g, ' ').trim()).filter(Boolean);
      if (paras.length) { state.creditsList = [...ABOUT, { title: 'Credits', p: paras }]; resetPages(); }
    },
    update(dt, input) {
      setPress(input.pointer);
      if (state.shot) { state.t += dt; return; }
      state.t += state.paused && state.scene === 'play' ? 0 : dt;
      if (state.scene !== 'play') updateAttract(dt);
      switch (state.scene) {
        case 'title': updateFlowScene(dt, input, handleTitle, 'title'); break;
        case 'setup': updateSetup(dt, input); break;
        case 'settings': updateFlowScene(dt, input, handleSettings, 'settings'); break;
        case 'learn': updateFlowScene(dt, input, handleLearn, 'learn'); break;
        case 'result': updateFlowScene(dt, input, handleResult, 'result'); break;
        case 'demolimit': updateFlowScene(dt, input, (id) => { if (id === 'menu') { state.scene = 'title'; state.ui.scroll = 0; } }, 'demolimit'); break;
        case 'howto': case 'about': case 'rules': updatePages(input); break;
        case 'play': updatePlay(dt, input); break;
        default: break;
      }
    },
    render(ctx) {
      ctx.clearRect(0, 0, W, H);
      switch (state.scene) {
        case 'title': renderTitle(ctx, state); break;
        case 'setup': renderSetup(ctx, state); break;
        case 'settings': renderSettings(ctx, state); break;
        case 'learn': renderLearn(ctx, state); break;
        case 'result': renderResult(ctx, state); break;
        case 'demolimit': renderDemoLimit(ctx, state); break;
        case 'howto': renderPages(ctx, state, HOWTO, 'How to Play'); break;
        case 'about': renderPages(ctx, state, aboutList(), 'About'); break;
        case 'rules': renderPages(ctx, state, RULES, 'Rules'); break;
        case 'play':
          if (state.sc) {
            renderPlay(ctx, state);
            if (state.pauseMenu) renderPause(ctx, state);
            else if (state.hint) renderHint(ctx, state);
            else if (state.lesson && state.lesson.phase !== 'play') renderLesson(ctx, state);
          }
          break;
        default: break;
      }
      state.viewRect = { x: PLAY.view.x, y: PLAY.view.y, w: PLAY.view.w, h: PLAY.view.h };
    },
    getState: () => state,
  };
  if (shotMode) applyPreset();
  return game;
}

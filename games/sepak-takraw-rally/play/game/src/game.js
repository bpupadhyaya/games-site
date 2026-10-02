// Sepak Takraw: the game shell. Scenes, input, persistence, preview wiring, Learn, Watch & Learn. The match itself lives in sim.js.
import { createSim } from './sim.js';
import { W, H, TEXT_SCALES, THINK_STEPS, REF_BACK, REF_NEXT, TEXT_DEC, TEXT_INC, SETUP_PINS, inRect, hudLayout } from './layout.js';
import { setPress } from './ui.js';
import { ABOUT, HOWTO, RULES, LESSONS, QUIZ } from './content.js';
import * as MN from './menus.js';
import { renderHud, renderFallback, hudRects, controlState, goKeyOf, renderThink, watchHit, W_RECTS } from './hud.js';
import { unprojectV } from './camera.js';
import { HW, HL, LEVELS } from './consts.js';
import { clamp } from './util.js';
import { dirOf, W as WT } from './model.js';

export const meta = { width: W, height: H };
const DEMO_MATCH_CAP = 2;
const SAVE_VERSION = 1;

export function createGame(env) {
  const { rng, audio, storage, config } = env;
  const demo = !!config.demo;
  const G = {
    scene: 'title', mode: 'none', demo, loaded: false,
    settings: { textIdx: 0, sound: true, women: false, venue: 'hall', decision: 'slow', thinkIdx: 1 },
    setup: { opp: 3, mode: 'full', pass: false, watch: false, watchA: 3, lastMode: 'ai' },
    ui: { scroll: 0, drag: null }, page: 0, back: 'title', setupMsg: '', restoreMsg: '',
    learn: { cur: 0, qi: 0, qscore: 0, done: {}, result: null, tally: null },
    saved: null, record: { demoMatches: 0 },
    sim: null, women: false, venue: 'hall', paused: false, pauseMenu: false, think: null, thinkRects: null, feedback: null, goKey: '',
    watch: { phase: 'think', timer: 0, paused: false, holdId: -1 }, t: 0,
  };
  let aboutList = ABOUT;
  if (typeof fetch === 'function') {
    fetch('./vendor3d/LICENSES.md').then((r) => (r.status >= 400 ? '' : r.text())).then((t) => {
      const paras = String(t).split(/\n\s*\n/).map((x) => x.replace(/^#+\s*/gm, '').replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);
      if (paras.length) aboutList = [...ABOUT, { title: 'Credits and licences', p: paras }];
    }).catch(() => {});
  }
  let S = null, evSeen = 0, snap = null, simRng = rng.fork(), audioSeen = 0;

  // ---- persistence -------------------------------------------------------------------------------
  const saveSettings = () => { storage.set('settings', G.settings); storage.set('learn', { done: G.learn.done }); storage.set('record', G.record); };
  const metaOfSave = (d) => ({ oppName: d.oppName, setNo: d.match.setNo, pts: [...d.match.pts] });
  const validSave = (d) => d && d.v === SAVE_VERSION && d.setup && d.match && Array.isArray(d.match.pts) && Array.isArray(d.match.sets) && d.match.sets.every((v) => v < 2) && (d.setup.mode === 'quick' ? d.match.sets.every((v) => v < 1) : true);
  const persistMatch = () => {
    if (!S || (G.mode !== 'ai' && G.mode !== 'pass') || S.s.match.over) return;
    const m = S.s.match;
    const d = { v: SAVE_VERSION, setup: { ...G.setup, lastMode: G.mode }, mode: G.mode, women: G.women, venue: G.venue, oppName: S.s.teams[1].name, match: { setNo: m.setNo, sets: [...m.sets], pts: [...m.pts], firstServer: m.firstServer, serving: m.serving, serveCount: m.serveCount, rallies: m.rallies } };
    snap = d; G.saved = metaOfSave(d); storage.set('match', d);
  };
  const clearSave = () => { snap = null; G.saved = null; storage.remove('match'); };

  Promise.all([storage.get('settings', null), storage.get('learn', null), storage.get('record', null), storage.get('match', null)]).then(([s, l, r, mch]) => {
    if (s) Object.assign(G.settings, s);
    if (l && l.done) G.learn.done = l.done;
    if (r) Object.assign(G.record, r);
    if (validSave(mch)) { snap = mch; G.saved = metaOfSave(mch); }
    G.settings.textIdx = clamp(G.settings.textIdx | 0, 0, TEXT_SCALES.length - 1);
    G.settings.thinkIdx = clamp(G.settings.thinkIdx | 0, 0, THINK_STEPS.length - 1);
    if (!['slow', 'wait', 'fast'].includes(G.settings.decision)) G.settings.decision = 'slow';
    if (!G.women && G.scene === 'title') { G.women = !!G.settings.women; G.venue = G.settings.venue === 'beach' ? 'beach' : 'hall'; }
    G.loaded = true;
    audio.setMuted?.(!G.settings.sound);
  });

  // ---- sound ---------------------------------------------------------------------------------------
  const tone = (o) => { if (G.settings.sound) audio.tone(o); };
  const sfx = {
    tick: () => tone({ freq: 760, dur: 0.04, type: 'triangle', vol: 0.05 }),
    kick: (q) => { tone({ freq: 190 + q * 60, to: 80, dur: 0.09, type: 'sine', vol: 0.16 }); tone({ freq: 900, to: 300, dur: 0.04, type: 'square', vol: 0.03 }); },
    smash: () => { tone({ freq: 140, to: 50, dur: 0.22, type: 'sine', vol: 0.22 }); tone({ freq: 1800, to: 300, dur: 0.1, type: 'sawtooth', vol: 0.05 }); },
    block: () => tone({ freq: 110, to: 60, dur: 0.18, type: 'triangle', vol: 0.2 }),
    bounce: () => tone({ freq: 220, to: 120, dur: 0.1, type: 'sine', vol: 0.12 }),
    net: () => tone({ freq: 300, to: 200, dur: 0.12, type: 'triangle', vol: 0.08 }),
    point: (win) => (win ? [0, 4, 7].forEach((n, i) => tone({ freq: 523 * Math.pow(2, n / 12), dur: 0.18 + i * 0.04, type: 'triangle', vol: 0.09 })) : [0, -3].forEach((n, i) => tone({ freq: 392 * Math.pow(2, n / 12), dur: 0.22, type: 'triangle', vol: 0.07 }))),
    whistle: () => tone({ freq: 2400, to: 2100, dur: 0.25, type: 'sine', vol: 0.05 }),
  };

  // ---- match lifecycle -------------------------------------------------------------------------------
  const setSim = (sim) => { S = sim; G.sim = sim.s; evSeen = 0; G.feedback = null; G.goKey = ''; G.think = null; };
  const startDemoBg = () => {
    const women = G.women;
    setSim(createSim({ mode: 'full', humans: [false, false], levels: [3, 3], firstServer: 0, women, decision: 'fast' }, simRng.fork()));
    G.mode = 'none';
  };
  function startMatch(kind, opts = {}) {
    const st = G.setup;
    G.women = !!G.settings.women; G.venue = G.settings.venue === 'beach' ? 'beach' : 'hall';
    let cfg;
    const mode = st.mode === 'quick' || (demo && kind !== 'watch') ? 'quick' : st.mode;
    const decision = G.settings.decision === 'slow' ? 'slow' : 'fast';
    if (kind === 'ai') {
      if (demo && G.record.demoMatches >= DEMO_MATCH_CAP) { G.scene = 'demolimit'; G.ui.scroll = 0; return; }
      cfg = { mode, humans: [true, false], levels: [3, st.opp], opp: st.opp, women: G.women, decision };
    } else if (kind === 'pass') {
      if (demo && G.record.demoMatches >= DEMO_MATCH_CAP) { G.scene = 'demolimit'; G.ui.scroll = 0; return; }
      cfg = { mode, humans: [true, true], levels: [3, 3], women: G.women, decision };
    } else if (kind === 'watch') {
      cfg = { mode: 'quick', humans: [false, false], levels: [st.watchA, st.opp], women: G.women, decision: 'fast', watch: true };
    } else if (kind === 'drill') {
      cfg = { mode: 'full', humans: [true, false], levels: [3, 2], women: G.women, decision, drill: opts.drill, firstServer: opts.drill.server ?? 0 };
    }
    if (opts.resume) cfg.resume = opts.resume;
    G.mode = kind === 'ai' ? 'ai' : kind;
    G.setup.lastMode = kind;
    setSim(createSim(cfg, simRng.fork()));
    S.s.cfg.watch = !!cfg.watch;
    G.scene = 'play'; G.paused = !!opts.paused; G.pauseMenu = !!opts.paused; G.ui.scroll = 0; G.watch = { phase: 'think', timer: 0, paused: false, holdId: -1 };
    if (kind === 'ai' || kind === 'pass') { if (demo) { G.record.demoMatches++; saveSettings(); } if (!opts.resume) persistMatch(); }
  }
  const resumeMatch = () => {
    if (!snap) return;
    const d = JSON.parse(JSON.stringify(snap));
    Object.assign(G.setup, d.setup);
    G.settings.women = !!d.women; G.settings.venue = d.venue;
    startMatch(d.mode === 'pass' ? 'pass' : 'ai', { resume: d.match, paused: true });
  };
  const leaveMatch = () => { persistMatch(); G.scene = 'title'; G.mode = 'none'; G.paused = false; G.pauseMenu = false; G.think = null; G.ui.scroll = 0; G.women = !!G.settings.women; G.venue = G.settings.venue === 'beach' ? 'beach' : 'hall'; startDemoBg(); };

  // ---- learn --------------------------------------------------------------------------------------------
  function startLesson() {
    const l = LESSONS[G.learn.cur];
    if (l.quiz) { G.learn.qi = 0; G.learn.qscore = 0; G.scene = 'quiz'; G.ui.scroll = 0; return; }
    G.learn.tally = { n: 0, ok: 0, rally: { q1: null, q2: null, tm: null, blocked: false, served: false } };
    startMatch('drill', { drill: l.drill });
  }
  function drillEvent(e) {
    const l = LESSONS[G.learn.cur], T = G.learn.tally;
    if (!T || !l) return;
    const r = T.rally;
    if (e.type === 'touch') {
      if (e.team === 0 && e.kind === 'receive' && e.n === 1) r.q1 = e.q;
      if (e.team === 0 && e.n === 2 && e.kind === 'receive') r.q2 = e.q;
      if (e.team === 0 && e.kind === 'attack') r.tm = e.tm;
    }
    if (e.type === 'block' && e.team === 0) r.blocked = true;
    if (e.type === 'point') {
      let ok = false;
      const k = l.drill.kind;
      if (l.id === 'serve') ok = e.reason === 'ace';
      else if (l.id === 'receive') ok = r.q1 !== null && r.q1 >= 0.5 && e.reason !== 'hand touch';
      else if (l.id === 'set') ok = r.q2 !== null && r.q2 >= 0.55;
      else if (l.id === 'spike') ok = r.tm !== null && r.tm >= 0.7;
      else if (l.id === 'block') ok = r.blocked;
      void k;
      T.n++; if (ok) T.ok++;
      G.feedback = { t: S.s.t, text: ok ? 'Good' : 'Not this time', col: ok ? '#7fe8d6' : '#ffb59a' };
      T.rally = { q1: null, q2: null, tm: null, blocked: false };
      if (T.n >= l.n) {
        G.learn.result = { score: T.ok, n: l.n, pass: T.ok >= l.need };
        if (G.learn.result.pass) { G.learn.done[l.id] = true; saveSettings(); }
        G.scene = 'lessonresult'; G.ui.scroll = 0; G.mode = 'none'; startDemoBg();
      }
    }
  }

  // ---- events from the sim: sound, feedback, saving ------------------------------------------------
  function processEvents() {
    const s = S.s;
    for (const e of s.events) {
      if (e.id < evSeen) continue;
      evSeen = e.id + 1;
      if (G.scene !== 'play' && G.scene !== 'none') { continue; }
      if (G.mode === 'drill') drillEvent(e);
      if (e.type === 'touch') {
        if (e.kind === 'attack') { sfx.smash(); if (e.tm !== undefined && S.s.teams[e.team].human) { const tm = e.tm; G.feedback = { t: s.t, text: tm >= 0.9 ? 'PERFECT' : tm >= 0.7 ? 'GOOD' : tm >= 0.45 ? 'OK' : 'LATE', col: tm >= 0.9 ? '#7fe8d6' : tm >= 0.7 ? '#ffe9a0' : tm >= 0.45 ? '#fff6e4' : '#ff9a86' }; } }
        else if (e.kind === 'serve') { sfx.kick(0.8); if (s.teams[e.team].human && s.ring === null) { /* feedback from the act */ } }
        else sfx.kick(e.q || 0.5);
      } else if (e.type === 'block') sfx.block();
      else if (e.type === 'land') sfx.bounce();
      else if (e.type === 'netHit' || e.type === 'cord' || e.type === 'net') sfx.net();
      else if (e.type === 'point') {
        sfx.whistle();
        const mine = s.teams[0].human ? e.winner === 0 : true;
        later(() => sfx.point(mine));
        if (G.mode === 'ai' || G.mode === 'pass') persistMatch();
      } else if (e.type === 'matchEnd') {
        if (G.mode === 'ai' || G.mode === 'pass' || G.mode === 'watch') { if (G.mode !== 'watch') clearSave(); G.scene = 'result'; G.ui.scroll = 0; }
      }
      if (e.type === 'toss' && S.s.teams[e.team].human && S.s.cfg.humans[e.team]) G.feedback = null;
    }
    // serve feedback from the act
    const srv = s.players[s.rally ? s.rally.server * 3 : 0];
    void srv;
  }
  const delayed = [];
  const later = (f) => delayed.push({ t: 0.35, f });

  // ---- watch & learn ---------------------------------------------------------------------------------
  function updateWatch(dt) {
    const s = S.s, w = G.watch;
    if (w.paused) return false;
    if (s.hold) {
      if (w.holdId !== s.hold.id) { w.holdId = s.hold.id; w.phase = 'think'; w.timer = THINK_STEPS[G.settings.thinkIdx]; }
      w.timer -= dt;
      if (w.phase === 'think' && w.timer <= 0) { w.phase = 'reveal'; w.timer = 2; }
      else if (w.phase === 'reveal' && w.timer <= 0) { w.phase = 'act'; S.release(); return true; }
      return false;
    }
    return true;
  }

  // ---- taps in play ----------------------------------------------------------------------------------
  function courtTap(x, y, team) {
    const cam = S.s.cam, cw = G.viewW || 720, ch = G.viewH || 1280;
    const p = unprojectV(cam, cw, ch, x, y, 0);
    if (!p) return;
    const sideZ = team === 0 ? 1 : -1;
    const aim = { x: clamp(p.x, -HW + 0.25, HW - 0.25), z: sideZ * clamp(Math.abs(p.z), 0.7, HL - 0.3) };
    if (p.z * sideZ < 0.2) return;                  // taps on your own half are ignored
    const pd = S.s.pending[team], ch0 = S.s.choice[team];
    if (pd && pd.kind === 'serve') S.choose(team, { serveAim: aim });
    else if (pd && pd.kind === 'set' && ch0.pace === 'over') S.choose(team, { overAim: aim });
    else S.choose(team, { aim, overAim: aim });
  }
  function applyChoiceId(team, id) {
    const [k, v] = id.split(':');
    if (k === 'stype') S.choose(team, { stype: v });
    else if (k === 'att') S.choose(team, { attacker: +v });
    else if (k === 'zone') S.choose(team, { zone: +v, pace: S.s.choice[team].pace === 'over' ? 'high' : S.s.choice[team].pace });
    else if (k === 'pace') S.choose(team, { pace: v });
    else if (k === 'atype') S.choose(team, { atype: v });
    else if (k === 'block') S.choose(team, { block: v });
  }
  function openThink(cs) {
    if (cs.team < 0) return;
    const sug = S.suggest(cs.team, cs.pend.kind);
    G.think = { team: cs.team, kind: cs.pend.kind, reason: sug.reason, summary: sug.summary || '', choice: sug.choice };
  }
  function playTap(ptr, rects) {
    const x = ptr.x, y = ptr.y, { cs, cf, lay } = rects;
    if (G.mode === 'watch') {
      const i = watchHit(x, y);
      if (i === 0) { G.watch.paused = !G.watch.paused; sfx.tick(); }
      else if (i === 1) { G.settings.thinkIdx = Math.max(0, G.settings.thinkIdx - 1); saveSettings(); }
      else if (i === 2) { G.settings.thinkIdx = Math.min(THINK_STEPS.length - 1, G.settings.thinkIdx + 1); saveSettings(); }
      else if (i === 3) leaveMatch();
      return;
    }
    if (inRect(lay.util.pause, x, y)) { G.paused = true; G.pauseMenu = true; G.ui.scroll = 0; persistMatch(); return; }
    if (inRect(lay.util.think, x, y)) { openThink(cs); return; }
    if (lay.action && inRect(lay.action, x, y)) {
      if (cf.action && cf.action.go) { G.goKey = goKeyOf(cs); sfx.tick(); } else if (cs.team >= 0) { S.tap(cs.team); }
      return;
    }
    for (let i = 0; i < cf.list.length; i++) if (inRect(lay.choices[i].rect, x, y)) { applyChoiceId(cs.team, cf.list[i].id); sfx.tick(); return; }
    if (y > lay.topH && y < lay.barTop) { const team = cs.team >= 0 ? cs.team : S.s.teams[0].human ? 0 : 1; courtTap(x, y, team); }
  }

  // ---- menus -----------------------------------------------------------------------------------------------
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
    if (input.keys.pressed.has('Equal') || input.keys.pressed.has('NumpadAdd')) { G.settings.textIdx = Math.min(TEXT_SCALES.length - 1, G.settings.textIdx + 1); saveSettings(); }
    if (input.keys.pressed.has('Minus') || input.keys.pressed.has('NumpadSubtract')) { G.settings.textIdx = Math.max(0, G.settings.textIdx - 1); saveSettings(); }
    if (input.keys.down.has('ArrowDown')) G.ui.scroll = clamp(G.ui.scroll + 14, 0, max);
    if (input.keys.down.has('ArrowUp')) G.ui.scroll = clamp(G.ui.scroll - 14, 0, max);
  };
  const go = (scene) => { G.scene = scene; G.ui.scroll = 0; G.page = 0; };
  const refresh = () => { G.women = !!G.settings.women; G.venue = G.settings.venue === 'beach' ? 'beach' : 'hall'; };
  function handleTitle(id) {
    if (!id) return;
    sfx.tick();
    if (id === 'continue') resumeMatch();
    else if (id === 'play') { G.setup.pass = false; G.setup.watch = false; G.setup.mode = 'full'; go('setup'); G.setupMsg = ''; }
    else if (id === 'quick') { G.setup.pass = false; G.setup.watch = false; G.setup.mode = 'quick'; go('setup'); G.setupMsg = ''; }
    else if (id === 'pass') { G.setup.pass = true; G.setup.watch = false; go('setup'); G.setupMsg = ''; }
    else if (id === 'watch') { G.setup.pass = false; G.setup.watch = true; go('setup'); G.setupMsg = ''; }
    else if (id === 'learn') go('learn');
    else if (id === 'howto') { G.back = 'title'; go('howto'); }
    else if (id === 'rules') { G.back = 'title'; go('rules'); }
    else if (id === 'about') { G.back = 'title'; go('about'); }
    else if (id === 'settings') go('settings');
    else if (id === 'sound') { G.settings.sound = !G.settings.sound; audio.setMuted?.(!G.settings.sound); saveSettings(); }
  }
  function handleSetup(id) {
    if (!id) return;
    const st = G.setup;
    sfx.tick();
    if (id.startsWith('opp')) st.opp = +id.slice(3);
    else if (id.startsWith('wa')) st.watchA = +id.slice(2);
    else if (id === 'len-full') st.mode = 'full';
    else if (id === 'len-quick') st.mode = 'quick';
    else if (id === 'ev-m') { G.settings.women = false; saveSettings(); refresh(); }
    else if (id === 'ev-f') { G.settings.women = true; saveSettings(); refresh(); }
    else if (id === 'ven-hall') { G.settings.venue = 'hall'; saveSettings(); refresh(); }
    else if (id === 'ven-beach') { G.settings.venue = 'beach'; saveSettings(); refresh(); }
    else if (id === 'start') {
      if (demo && st.opp > 2 && !st.pass && !st.watch) { G.setupMsg = 'The free demo has the first two rivals.'; return; }
      startMatch(st.watch ? 'watch' : st.pass ? 'pass' : 'ai');
    } else if (id === 'back') go('title');
  }
  function handleSettings(id) {
    if (!id) return;
    sfx.tick();
    const st = G.settings;
    if (id === 'set-sound') { st.sound = !st.sound; audio.setMuted?.(!st.sound); }
    else if (id === 'txt-dec') { st.textIdx = Math.max(0, st.textIdx - 1); G.ui.scroll = 0; }
    else if (id === 'txt-inc') { st.textIdx = Math.min(TEXT_SCALES.length - 1, st.textIdx + 1); G.ui.scroll = 0; }
    else if (id.startsWith('dm-')) st.decision = id.slice(3);
    else if (id === 'think-dec') st.thinkIdx = Math.max(0, st.thinkIdx - 1);
    else if (id === 'think-inc') st.thinkIdx = Math.min(THINK_STEPS.length - 1, st.thinkIdx + 1);
    else if (id === 'restore') { G.restoreMsg = 'Checking...'; env.monetization.restore().then(() => { G.restoreMsg = env.monetization.owns('unlock_game') ? 'Purchase restored.' : 'No earlier purchase found.'; }).catch(() => { G.restoreMsg = 'Could not reach the store.'; }); }
    else if (id === 'back') { go('title'); G.restoreMsg = ''; }
    saveSettings();
  }
  function handleResult(id) {
    if (!id) return;
    sfx.tick();
    if (id === 'again') startMatch(G.setup.lastMode === 'pass' ? 'pass' : G.setup.lastMode === 'watch' ? 'watch' : 'ai');
    else if (id === 'new') { if (G.setup.lastMode === 'watch') startMatch('watch'); else go('setup'); }
    else if (id === 'menu') { go('title'); startDemoBg(); }
  }
  function handleLearn(id) {
    if (!id) return;
    sfx.tick();
    if (id === 'back') go('title');
    else if (id.startsWith('lesson') && id !== 'lesson-go' && id !== 'lesson-back') { G.learn.cur = +id.slice(6); go('lesson'); }
  }
  function handleLesson(id) { if (!id) return; sfx.tick(); if (id === 'lesson-go') startLesson(); else if (id === 'lesson-back') go('learn'); }
  function handleQuiz(id) {
    if (!id) return;
    sfx.tick();
    const i = +id.slice(3);
    if (i === QUIZ[G.learn.qi].ok) G.learn.qscore++;
    G.learn.qi++;
    if (G.learn.qi >= QUIZ.length) {
      const l = LESSONS[G.learn.cur];
      G.learn.result = { score: G.learn.qscore, n: QUIZ.length, pass: G.learn.qscore >= l.need };
      if (G.learn.result.pass) { G.learn.done[l.id] = true; saveSettings(); }
      go('lessonresult');
    } else G.ui.scroll = 0;
  }
  function handleLessonResult(id) {
    if (!id) return;
    sfx.tick();
    if (id === 'lr-again') startLesson();
    else if (id === 'lr-next') { G.learn.cur = Math.min(LESSONS.length - 1, G.learn.cur + 1); go('lesson'); }
    else if (id === 'lr-list') go('learn');
  }
  function handlePause(id) {
    if (!id) return;
    sfx.tick();
    if (id === 'resume') { G.paused = false; G.pauseMenu = false; }
    else if (id === 'p-rules') { G.back = 'play'; go('rules'); }
    else if (id === 'p-howto') { G.back = 'play'; go('howto'); }
    else if (id === 'p-sound') { G.settings.sound = !G.settings.sound; audio.setMuted?.(!G.settings.sound); saveSettings(); }
    else if (id === 'p-txt-dec') { G.settings.textIdx = Math.max(0, G.settings.textIdx - 1); G.ui.scroll = 0; saveSettings(); }
    else if (id === 'p-txt-inc') { G.settings.textIdx = Math.min(TEXT_SCALES.length - 1, G.settings.textIdx + 1); G.ui.scroll = 0; saveSettings(); }
    else if (id === 'quit') leaveMatch();
  }
  const updatePages = (input) => {
    const ptr = input.pointer, keys = input.keys;
    const n = MN.pageCount();
    const close = () => { G.scene = G.back === 'play' ? 'play' : 'title'; G.page = 0; };
    const next = () => { if (G.page >= n - 1) close(); else G.page++; };
    const prev = () => { if (G.page <= 0) close(); else G.page--; };
    if (ptr.pressed) {
      if (inRect(REF_NEXT, ptr.x, ptr.y)) next();
      else if (inRect(REF_BACK, ptr.x, ptr.y)) prev();
      else if (inRect(TEXT_DEC, ptr.x, ptr.y)) { G.settings.textIdx = Math.max(0, G.settings.textIdx - 1); saveSettings(); }
      else if (inRect(TEXT_INC, ptr.x, ptr.y)) { G.settings.textIdx = Math.min(TEXT_SCALES.length - 1, G.settings.textIdx + 1); saveSettings(); }
    }
    if (keys.pressed.has('ArrowRight')) next();
    if (keys.pressed.has('ArrowLeft')) prev();
    if (keys.pressed.has('Escape')) close();
  };
  const updateSetup = (dt, input) => {
    const ptr = input.pointer, k = input.keys;
    if (k.pressed.has('Enter')) { handleSetup('start'); return; }
    if (k.pressed.has('Escape')) { handleSetup('back'); return; }
    if (ptr.pressed && (inRect(SETUP_PINS.start, ptr.x, ptr.y) || inRect(SETUP_PINS.back, ptr.x, ptr.y))) { handleSetup(inRect(SETUP_PINS.start, ptr.x, ptr.y) ? 'start' : 'back'); return; }
    updateFlowScene(dt, input, handleSetup, 'setup');
  };

  // ---- the play update ------------------------------------------------------------------------------
  function updatePlay(dt, input) {
    const ptr = input.pointer, keys = input.keys;
    const s = S.s;
    if (G.mode === 'shot') { S.update(dt); processEvents(); return; }
    if (G.pauseMenu) { MN.ensureLayout(G, 'pause'); updateFlowScene(dt, input, handlePause, null); return; }
    const rects = hudRects(G, S, null);
    if (G.think) {
      if (ptr.pressed && G.thinkRects) {
        if (inRect(G.thinkRects.use, ptr.x, ptr.y)) { S.choose(G.think.team, G.think.choice); G.think = null; sfx.tick(); }
        else if (inRect(G.thinkRects.close, ptr.x, ptr.y)) { G.think = null; sfx.tick(); }
      }
      return;
    }
    if (ptr.pressed) playTap(ptr, rects);
    if (keys.pressed.has('Space') && rects.cs.team >= 0) { if (rects.cf.action && rects.cf.action.go) G.goKey = goKeyOf(rects.cs); else S.tap(rects.cs.team); }
    if (keys.pressed.has('KeyP') || keys.pressed.has('Escape')) { if (G.mode === 'watch') G.watch.paused = !G.watch.paused; else { G.paused = true; G.pauseMenu = true; G.ui.scroll = 0; persistMatch(); } }
    if (keys.pressed.has('KeyT') && G.mode !== 'watch') openThink(rects.cs);
    if (G.think || G.pauseMenu) return;
    // wait-for-me mode holds the clock at each human decision until GO
    if (G.mode !== 'watch' && rects.cs.team >= 0 && G.settings.decision === 'wait' && G.goKey !== goKeyOf(rects.cs)) return;
    if (G.mode === 'watch') { if (!updateWatch(dt)) { return; } }
    S.update(dt);
    processEvents();
  }

  // ?shot=1 (store screenshots): a real match played by a coached team, frozen after N ticks, with the full HUD
  function startShot() {
    G.women = false; G.venue = 'hall';
    G.mode = 'shot'; G.setup.lastMode = 'shot';
    setSim(createSim({ mode: 'full', humans: [true, false], levels: [3, 4], bot: { iq: 0.6, sigma: 0.09 }, women: false, decision: 'fast' }, simRng.fork()));
    G.scene = 'play';
  }
  function startup() { G.women = false; G.venue = 'hall'; if (config.shot) startShot(); else startDemoBg(); }
  startup();

  return {
    // Menus, Rules, About, settings, Learn text and Watch & Learn are free; only real play counts against the preview.
    isPreviewExempt: () => !((G.scene === 'play' && (G.mode === 'ai' || G.mode === 'pass' || G.mode === 'drill')) ) || G.paused || G.pauseMenu || (S && S.s.phase === 'dead'),
    update(dt, input) {
      setPress(input.pointer);
      G.t += dt;
      for (let i = delayed.length - 1; i >= 0; i--) { delayed[i].t -= dt; if (delayed[i].t <= 0) { delayed[i].f(); delayed.splice(i, 1); } }
      if (G.scene !== 'play') S.update(dt);
      switch (G.scene) {
        case 'title': updateFlowScene(dt, input, handleTitle, 'title'); break;
        case 'setup': updateSetup(dt, input); break;
        case 'settings': updateFlowScene(dt, input, handleSettings, 'settings'); break;
        case 'learn': updateFlowScene(dt, input, handleLearn, 'learn'); break;
        case 'lesson': updateFlowScene(dt, input, handleLesson, 'lesson'); break;
        case 'quiz': updateFlowScene(dt, input, handleQuiz, 'quiz'); break;
        case 'lessonresult': updateFlowScene(dt, input, handleLessonResult, 'lessonresult'); break;
        case 'result': updateFlowScene(dt, input, handleResult, 'result'); break;
        case 'demolimit': updateFlowScene(dt, input, (id) => { if (id === 'menu') { go('title'); } }, 'demolimit'); break;
        case 'howto': case 'about': case 'rules': updatePages(input); break;
        case 'play': updatePlay(dt, input); break;
        default: break;
      }
    },
    render(ctx, view) {
      G.viewW = (view && view.cssW) || 720; G.viewH = (view && view.cssH) || 1280;
      ctx.clearRect(0, 0, W, H);
      if (view && view.noGL) renderFallback(ctx, G, view);
      switch (G.scene) {
        case 'title': MN.renderTitle(ctx, G); break;
        case 'setup': MN.renderSetup(ctx, G); break;
        case 'settings': MN.renderSettings(ctx, G); break;
        case 'learn': MN.renderLearn(ctx, G); break;
        case 'lesson': MN.renderLesson(ctx, G); break;
        case 'quiz': MN.renderQuiz(ctx, G); break;
        case 'lessonresult': MN.renderLessonResult(ctx, G); break;
        case 'result': MN.renderResult(ctx, G); break;
        case 'demolimit': MN.renderDemoLimit(ctx, G); break;
        case 'howto': MN.renderPages(ctx, G, HOWTO, 'How to Play'); break;
        case 'about': MN.renderPages(ctx, G, aboutList, 'About'); break;
        case 'rules': MN.renderPages(ctx, G, RULES, 'Rules'); break;
        case 'play':
          renderHud(ctx, G, S, { cssW: G.viewW, cssH: G.viewH });
          if (G.think) renderThink(ctx, G, view);
          if (G.pauseMenu) MN.renderPause(ctx, G);
          break;
        default: break;
      }
    },
    getState: () => G,
  };
}

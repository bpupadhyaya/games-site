// Basketball 3x3: the game shell. Scenes, touch / keyboard controls, persistence, preview wiring, Learn, Watch & Learn.
// The match itself lives in sim.js; the 3D picture is drawn by view3d/ from the sim state.
import { createSim } from './sim.js';
import { W, H, TEXT_SCALES, THINK_STEPS, REF_BACK, REF_NEXT, TEXT_DEC, TEXT_INC, SETUP_PINS, inRect, inCircle, hudLayout } from './layout.js';
import { setPress } from './ui.js';
import { ABOUT, HOWTO, RULES, LESSONS, QUIZ } from './content.js';
import * as MN from './menus.js';
import { renderHud, renderFallback, controlState, renderThink, watchHit } from './hud.js';
import { LEVELS, ROLES, GAME_LEN } from './consts.js';
import { clamp } from './util.js';
import { screenToWorld } from './camera.js';

export const meta = { width: W, height: H };
const DEMO_GAME_CAP = 2;
const SAVE_VERSION = 1;

export function createGame(env) {
  const { rng, audio, storage, config } = env;
  const demo = !!config.demo;
  const G = {
    scene: 'title', mode: 'none', demo, loaded: false,
    settings: { textIdx: 0, sound: true, thinkIdx: 1, kitIdx: 0, courtIdx: 0 },
    setup: { opp: 3, role: 0, len: 'full', watch: false, watchA: 3, lastMode: 'ai' },
    ui: { scroll: 0, drag: null }, page: 0, back: 'title', setupMsg: '', restoreMsg: '',
    learn: { cur: 0, qi: 0, qscore: 0, done: {}, result: null },
    saved: null, record: { demoMatches: 0 },
    sim: null, meter: null, paused: false, pauseMenu: false, think: null, thinkRects: null, feedback: null, hintShow: null, oppName: 'Red', lessonTitle: '',
    watch: { phase: 'think', timer: 0, paused: false, holdId: -1 }, t: 0,
    ctl: { stickId: null, ox: 0, oy: 0, sx: 0, sz: 0, stickOn: false, bind: {}, down: { a: false, b: false, c: false, d: false }, btn: { a: {}, b: {}, c: {}, d: {} } },
  };
  let aboutList = ABOUT;
  if (typeof fetch === 'function') {
    fetch('./vendor3d/LICENSES.md').then((r) => (r.status >= 400 ? '' : r.text())).then((t) => {
      const paras = String(t).split(/\n\s*\n/).map((x) => x.replace(/^#+\s*/gm, '').replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);
      if (paras.length) aboutList = [...ABOUT, { title: 'Credits and licences', p: paras }];
    }).catch(() => {});
  }
  let S = null, evSeen = 0, snap = null, simRng = rng.fork();

  // ---- persistence ------------------------------------------------------------------------------------------------------------------
  const saveSettings = () => { storage.set('settings', G.settings); storage.set('learn', { done: G.learn.done }); storage.set('record', G.record); storage.set('setup', { opp: G.setup.opp, role: G.setup.role, len: G.setup.len, watchA: G.setup.watchA }); };
  const clockText = (c) => { const s = Math.ceil(c); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
  const metaOfSave = (d) => ({ roleName: ROLES[d.setup.role].name, score: d.score, clockText: d.ot ? 'Overtime' : clockText(d.clock) });
  const validSave = (d) => d && d.v === SAVE_VERSION && d.setup && Array.isArray(d.score) && Array.isArray(d.fouls) && typeof d.clock === 'number' && (d.poss === 0 || d.poss === 1);
  const persistMatch = () => {
    if (!S || G.mode !== 'ai' || S.s.over) return;
    const s = S.s;
    const d = { v: SAVE_VERSION, setup: { opp: G.setup.opp, role: G.setup.role, len: G.setup.len }, score: [...s.score], fouls: [...s.fouls], clock: s.clock, poss: s.poss, ot: s.ot, otTarget: s.otTarget || 0 };
    snap = d; G.saved = metaOfSave(d); storage.set('match', d);
  };
  const clearSave = () => { snap = null; G.saved = null; storage.remove('match'); };

  Promise.all([storage.get('settings', null), storage.get('learn', null), storage.get('record', null), storage.get('match', null), storage.get('setup', null)]).then(([st, l, r, mch, su]) => {
    if (st) Object.assign(G.settings, st);
    if (l && l.done) G.learn.done = l.done;
    if (r) Object.assign(G.record, r);
    if (su) { if (su.opp >= 1 && su.opp <= 5) G.setup.opp = su.opp; if (su.role >= 0 && su.role <= 2) G.setup.role = su.role; if (su.len === 'quick') G.setup.len = 'quick'; if (su.watchA >= 1 && su.watchA <= 5) G.setup.watchA = su.watchA; }
    if (validSave(mch)) { snap = mch; G.saved = metaOfSave(mch); }
    G.settings.textIdx = clamp(G.settings.textIdx | 0, 0, TEXT_SCALES.length - 1);
    G.settings.thinkIdx = clamp(G.settings.thinkIdx | 0, 0, THINK_STEPS.length - 1);
    G.settings.kitIdx = clamp(G.settings.kitIdx | 0, 0, 3); G.settings.courtIdx = clamp(G.settings.courtIdx | 0, 0, 2);
    G.loaded = true;
    audio.setMuted?.(!G.settings.sound);
  });

  // ---- sound ------------------------------------------------------------------------------------------------------------------------
  const tone = (o) => { if (G.settings.sound) audio.tone(o); };
  const sfx = {
    tick: () => tone({ freq: 760, dur: 0.04, type: 'triangle', vol: 0.05 }),
    dribble: () => { tone({ freq: 120, to: 70, dur: 0.07, type: 'sine', vol: 0.13 }); tone({ freq: 380, to: 200, dur: 0.03, type: 'triangle', vol: 0.03 }); },
    bounce: (v) => tone({ freq: 140, to: 80, dur: 0.09, type: 'sine', vol: Math.min(0.14, 0.03 + v * 0.01) }),
    rim: (v) => { tone({ freq: 640, to: 420, dur: 0.22, type: 'triangle', vol: Math.min(0.14, 0.04 + v * 0.015) }); tone({ freq: 1280, to: 900, dur: 0.12, type: 'square', vol: 0.025 }); },
    board: () => tone({ freq: 170, to: 110, dur: 0.12, type: 'triangle', vol: 0.14 }),
    swish: () => { tone({ freq: 2600, to: 1100, dur: 0.22, type: 'sawtooth', vol: 0.035 }); tone({ freq: 1800, to: 700, dur: 0.2, type: 'triangle', vol: 0.03 }); },
    pass: () => tone({ freq: 520, to: 360, dur: 0.07, type: 'triangle', vol: 0.05 }),
    catch: () => tone({ freq: 240, to: 180, dur: 0.06, type: 'sine', vol: 0.08 }),
    block: () => tone({ freq: 220, to: 90, dur: 0.14, type: 'square', vol: 0.09 }),
    steal: () => { tone({ freq: 700, to: 300, dur: 0.1, type: 'sawtooth', vol: 0.05 }); },
    whistle: () => tone({ freq: 2500, to: 2200, dur: 0.3, type: 'sine', vol: 0.05 }),
    buzzer: () => tone({ freq: 190, dur: 0.5, type: 'sawtooth', vol: 0.07 }),
    cheer: (win) => (win ? [0, 4, 7, 12].forEach((n, i) => tone({ freq: 523 * Math.pow(2, n / 12), dur: 0.16 + i * 0.03, type: 'triangle', vol: 0.07 })) : [0, -3].forEach((n) => tone({ freq: 330 * Math.pow(2, n / 12), dur: 0.22, type: 'triangle', vol: 0.05 }))),
    land: () => tone({ freq: 110, to: 70, dur: 0.06, type: 'sine', vol: 0.06 }),
  };

  // ---- match lifecycle ----------------------------------------------------------------------------------------------------------------
  const setSim = (sim) => { S = sim; G.sim = sim.s; evSeen = 0; G.feedback = null; G.think = null; G.hintShow = null; resetCtl(); };
  const startDemoBg = () => { G.oppName = 'Red'; setSim(createSim({ len: 'full', levels: [3, 3], firstPoss: 0 }, simRng.fork())); G.mode = 'none'; };
  function startMatch(kind, opts = {}) {
    const st = G.setup;
    let cfg;
    if (kind === 'ai') {
      if (demo && G.record.demoMatches >= DEMO_GAME_CAP) { G.scene = 'demolimit'; G.ui.scroll = 0; return; }
      cfg = { len: demo ? 'quick' : st.len, human: { team: 0, role: st.role }, level: st.opp };
      G.oppName = LEVELS[st.opp].name;
    } else if (kind === 'watch') {
      cfg = { len: 'quick', levels: [st.watchA, st.opp], watch: true };
      G.oppName = 'Red';
    } else if (kind === 'drill') {
      cfg = { len: 'full', human: { team: 0, role: opts.drill.role }, level: 2, drill: opts.drill.drill };
      G.oppName = 'Practice';
    }
    if (opts.resume) cfg.resume = opts.resume;
    G.mode = kind;
    G.setup.lastMode = kind;
    setSim(createSim(cfg, simRng.fork()));
    S.s.cfg.watch = kind === 'watch';
    G.scene = 'play'; G.paused = !!opts.paused; G.pauseMenu = !!opts.paused; G.ui.scroll = 0; G.watch = { phase: 'think', timer: 0, paused: false, holdId: -1 };
    if (kind === 'ai') { if (demo && !opts.resume) { G.record.demoMatches++; saveSettings(); } if (!opts.resume) persistMatch(); }
  }
  const resumeMatch = () => {
    if (!snap) return;
    const d = JSON.parse(JSON.stringify(snap));
    Object.assign(G.setup, d.setup);
    startMatch('ai', { resume: { score: d.score, fouls: d.fouls, clock: d.clock, poss: d.poss, ot: d.ot, otTarget: d.otTarget }, paused: true });
  };
  const leaveMatch = () => { persistMatch(); G.scene = 'title'; G.mode = 'none'; G.paused = false; G.pauseMenu = false; G.think = null; G.ui.scroll = 0; startDemoBg(); };

  // ---- learn ------------------------------------------------------------------------------------------------------------------------------
  function startLesson() {
    const l = LESSONS[G.learn.cur];
    if (l.quiz) { G.learn.qi = 0; G.learn.qscore = 0; G.scene = 'quiz'; G.ui.scroll = 0; return; }
    G.lessonTitle = l.title.replace(/^\d+\. /, '');
    startMatch('drill', { drill: l });
  }
  function drillEvent(e) {
    const l = LESSONS[G.learn.cur], d = S.s.drill;
    if (!l || !d) return;
    if (e.type === 'drillAttempt') {
      G.feedback = { t: S.s.t, text: d.lastOk ? 'Good' : 'Not this time', col: d.lastOk ? '#7fe8d6' : '#ffb59a' };
      if (d.n >= d.total) {
        G.learn.result = { score: d.ok, n: d.total, pass: d.ok >= l.need };
        if (G.learn.result.pass) { G.learn.done[l.id] = true; saveSettings(); }
        G.scene = 'lessonresult'; G.ui.scroll = 0; G.mode = 'none'; startDemoBg();
      }
    }
  }

  // ---- events from the sim: sound, banners, saving -----------------------------------------------------------------------------------
  const flash = (text, col = '#fff6e4', size = 52, sub = '') => { G.feedback = { t: S.s.t, text, col, size, sub }; };
  function processEvents() {
    const s = S.s;
    const mine = (p) => s.humanId >= 0 && s.players[p].team === s.players[s.humanId].team;
    for (const e of s.events) {
      if (e.id < evSeen) continue;
      evSeen = e.id + 1;
      if (G.scene !== 'play' && G.scene !== 'none') continue;
      if (G.mode === 'drill') drillEvent(e);
      switch (e.type) {
        case 'dribble': sfx.dribble(); break;
        case 'bounce': sfx.bounce(e.v || 3); break;
        case 'rim': sfx.rim(e.v || 2); break;
        case 'board': sfx.board(); break;
        case 'pass': sfx.pass(); break;
        case 'catch': sfx.catch(); break;
        case 'land': if (e.v > 2) sfx.land(); break;
        case 'block': sfx.block(); flash('BLOCKED!', '#ffd23f', 54); break;
        case 'stealHit': case 'poke': case 'intercept': sfx.steal(); flash('STEAL!', '#ffd23f', 54); break;
        case 'rebound': flash('REBOUND', '#fff6e4', 40); break;
        case 'foul': sfx.whistle(); flash('FOUL', '#ff9a86', 54, e.ft ? `${e.ft} free throw${e.ft > 1 ? 's' : ''}` : 'Check ball'); break;
        case 'shotclock': sfx.buzzer(); flash('SHOT CLOCK', '#ff9a86', 48); break;
        case 'notcleared': flash('TAKE IT BEHIND THE ARC', '#ff9a86', 34); break;
        case 'screened': if (s.humanId >= 0 && e.by === s.humanId) flash('SCREEN!', '#7fe8d6', 50); break;
        case 'overtime': flash('OVERTIME', '#ffd23f', 56, 'First to 2 points'); break;
        case 'violation': sfx.whistle(); flash(e.why === 'double dribble' ? 'DOUBLE DRIBBLE' : 'TRAVELLING', '#ff9a86', 46, 'Check ball'); break;
        case 'pickup': if (s.humanId >= 0 && e.pid === s.humanId) flash('DRIBBLE ENDED', '#ffe9a0', 34, 'Pass or shoot'); break;
        case 'out': sfx.whistle(); flash('OUT OF BOUNDS', '#ff9a86', 40); break;
        case 'setup': if (G.mode === 'ai') persistMatch(); break;
        case 'score': {
          sfx.swish();
          const my = s.humanId < 0 ? e.team === 0 : mine(e.pid);
          G.feedback = { t: s.t, text: e.dunk ? 'DUNK!' : e.swish ? 'SWISH!' : `+${e.pts}`, col: my ? '#7fe8d6' : '#ff9a86', size: 60, sub: e.swish || e.dunk ? `+${e.pts}` : '' };
          setTimeout0(() => sfx.cheer(my));
          break;
        }
        case 'end': {
          sfx.buzzer();
          if (G.mode === 'ai' || G.mode === 'watch') { if (G.mode === 'ai') { clearSave(); if (s.humanId >= 0 && e.winner === s.players[s.humanId].team) { G.record.matchWins = (G.record.matchWins | 0) + 1; saveSettings(); } } G.scene = 'result'; G.ui.scroll = 0; }
          break;
        }
        default: break;
      }
    }
  }
  const delayed = [];
  const setTimeout0 = (f) => delayed.push({ t: 0.3, f });

  // ---- Watch & Learn ---------------------------------------------------------------------------------------------------------------
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

  // ---- controls: a floating stick plus four buttons; several fingers at once when the shell provides them ---------------------------------------------
  function resetCtl() { const c = G.ctl; c.stickId = null; c.stickOn = false; c.sx = c.sz = 0; c.bind = {}; for (const k of ['a', 'b', 'c', 'd']) { c.down[k] = false; c.btn[k] = {}; } }
  const KEYS = { a: ['Space', 'KeyJ'], b: ['KeyK'], c: ['KeyL'], d: ['KeyI'] };
  function pollTouches(input) {
    if (input.touches) return input.touches;
    const p = input.pointer;
    return (p.down || p.pressed || p.released) ? [{ id: 'p', x: p.x, y: p.y, pressed: p.pressed, down: p.down, released: p.released }] : [];
  }
  function readCtl(input, lay, cs) {
    const c = G.ctl;
    const touches = pollTouches(input);
    for (const k of ['a', 'b', 'c', 'd']) c.btn[k] = { down: false, pressed: false, released: false };
    const alive = new Set();
    for (const t of touches) {
      if (t.pressed && !t.consumed) {
        let hit = null;
        for (const k of ['a', 'b', 'c', 'd']) if (cs[k] && inCircle(lay.btn[k], t.x, t.y, 14)) { hit = k; break; }
        if (hit) { if (c.bind[hit] === undefined) { c.bind[hit] = t.id; c.btn[hit].pressed = true; } }
        else if (c.stickId === null && inRect(lay.stickZone, t.x, t.y)) { c.stickId = t.id; c.ox = clamp(t.x, 90, 290); c.oy = clamp(t.y, 990, 1190); c.stickOn = true; }
      }
      if (t.down || t.pressed) alive.add(t.id);
    }
    for (const k of ['a', 'b', 'c', 'd']) {
      if (c.bind[k] !== undefined) {
        const t = touches.find((q) => q.id === c.bind[k]);
        if (t && (t.down || t.pressed)) c.btn[k].down = true;
        else { c.btn[k].released = true; delete c.bind[k]; }
        if (c.bind[k] !== undefined && !cs[k]) { delete c.bind[k]; c.btn[k].released = true; c.btn[k].down = false; }
      }
    }
    if (c.stickId !== null) {
      const t = touches.find((q) => q.id === c.stickId);
      if (t && (t.down || t.pressed)) {
        let dx = t.x - c.ox, dy = t.y - c.oy; const R = 80, l = Math.hypot(dx, dy);
        if (l > R * 1.5) { c.ox += dx / l * (l - R * 1.5); c.oy += dy / l * (l - R * 1.5); dx = t.x - c.ox; dy = t.y - c.oy; }
        const m = Math.min(1, Math.hypot(dx, dy) / R), a = Math.atan2(dy, dx);
        c.sx = m < 0.12 ? 0 : Math.cos(a) * m; c.sz = m < 0.12 ? 0 : Math.sin(a) * m;
      } else { c.stickId = null; c.stickOn = false; c.sx = c.sz = 0; }
    }
    // keyboard
    const k = input.keys;
    let kx = 0, kz = 0;
    if (k.down.has('ArrowLeft') || k.down.has('KeyA')) kx -= 1;
    if (k.down.has('ArrowRight') || k.down.has('KeyD')) kx += 1;
    if (k.down.has('ArrowUp') || k.down.has('KeyW')) kz -= 1;
    if (k.down.has('ArrowDown') || k.down.has('KeyS')) kz += 1;
    if (kx || kz) { const l = Math.hypot(kx, kz); c.sx = kx / l; c.sz = kz / l; }
    for (const b of ['a', 'b', 'c', 'd']) {
      if (!cs[b]) continue;
      for (const code of KEYS[b]) { if (k.pressed.has(code)) { c.btn[b].pressed = true; } if (k.down.has(code)) c.btn[b].down = true; }
    }
    for (const b of ['a', 'b', 'c', 'd']) { if (c.btn[b].pressed) c.btn[b].down = true; c.down[b] = c.btn[b].down; }
    const w = screenToWorld(c.sx, c.sz);
    return { sx: w.x, sz: w.z, btn: c.btn, passTo: cs.passIds };
  }
  function openThink() {
    if (!S || S.s.humanId < 0) return;
    const sug = S.suggest();
    G.thinkSt = null; G.think = { reason: sug.reason, summary: sug.summary || '', target: sug.target || null };
  }

  // ---- menus --------------------------------------------------------------------------------------------------------------------------------
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
    { const k = input.keys, step = Math.max(40, mt.bottom - mt.top - 60), set = (v) => { G.ui.scroll = clamp(v, 0, max); };
      if (input.wheel) set(G.ui.scroll + input.wheel);
      if (k.down.has('ArrowDown')) set(G.ui.scroll + 14);
      if (k.down.has('ArrowUp')) set(G.ui.scroll - 14);
      if (k.pressed.has('PageDown') || k.pressed.has('Space')) set(G.ui.scroll + step);
      if (k.pressed.has('PageUp')) set(G.ui.scroll - step);
      if (k.pressed.has('Home')) set(0);
      if (k.pressed.has('End')) set(max); }
  };
  const go = (scene) => { G.scene = scene; G.ui.scroll = 0; G.page = 0; };
  function handleTitle(id) {
    if (!id) return;
    sfx.tick();
    if (id === 'continue') resumeMatch();
    else if (id === 'play') { G.setup.watch = false; go('setup'); G.setupMsg = ''; }
    else if (id === 'watch') { G.setup.watch = true; go('setup'); G.setupMsg = ''; }
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
    else if (id.startsWith('role') && id !== 'roletut') st.role = +id.slice(4);
    else if (id === 'roletut') { const i = LESSONS.findIndex((l) => l.role === st.role && !l.quiz && l.id !== 'shoot' && l.id !== 'rebound' && l.id !== 'defend') ; G.learn.cur = i >= 0 ? i : 0; if (st.role === 1) G.learn.cur = 0; go('lesson'); }
    else if (id === 'len-full') st.len = 'full';
    else if (id === 'len-quick') st.len = 'quick';
    else if (id === 'start') {
      if (demo && st.opp > 2 && !st.watch) { G.setupMsg = 'The free demo has the first two opponents.'; return; }
      saveSettings();
      startMatch(st.watch ? 'watch' : 'ai');
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
    else if (id === 'kit-next') st.kitIdx = ((st.kitIdx | 0) + 1) % 4;
    else if (id === 'court-next') st.courtIdx = ((st.courtIdx | 0) + 1) % 3;
    else if (id === 'think-inc') st.thinkIdx = Math.min(THINK_STEPS.length - 1, st.thinkIdx + 1);
    else if (id === 'restore') { G.restoreMsg = 'Checking...'; env.monetization.restore().then(() => { G.restoreMsg = env.monetization.owns('unlock_game') ? 'Purchase restored.' : 'No earlier purchase found.'; }).catch(() => { G.restoreMsg = 'Could not reach the store.'; }); }
    else if (id === 'back') { go('title'); G.restoreMsg = ''; }
    saveSettings();
  }
  function handleResult(id) {
    if (!id) return;
    sfx.tick();
    if (id === 'again') startMatch(G.setup.lastMode === 'watch' ? 'watch' : 'ai');
    else if (id === 'new') { if (G.setup.lastMode === 'watch') startMatch('watch'); else go('setup'); }
    else if (id === 'menu') { go('title'); G.mode = 'none'; startDemoBg(); }
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
  // Shared scrolling input for every text screen: touch drag / swipe inside `rect`, mouse wheel, arrows, PageUp / PageDown, Space, Home / End.
  // `st` = { scroll, drag } is owned by the caller; returns true when the pointer is being used to scroll (so a tap must not fire).
  function scrollInput(input, st, max, view, rect) {
    const ptr = input.pointer, keys = input.keys;
    const set = (v) => { st.scroll = clamp(v, 0, max); };
    if (ptr.pressed) st.drag = rect && inRect(rect, ptr.x, ptr.y) ? { y0: ptr.y, s0: st.scroll, moved: 0 } : null;
    let used = false;
    if (st.drag && ptr.down) { st.drag.moved = Math.max(st.drag.moved, Math.abs(ptr.y - st.drag.y0)); if (st.drag.moved >= 10) { set(st.drag.s0 - (ptr.y - st.drag.y0)); used = true; } }
    if (ptr.released && st.drag) { used = used || st.drag.moved >= 10; st.drag = null; }
    if (input.wheel) set(st.scroll + input.wheel);
    const step = Math.max(40, view - 60);
    if (keys.down.has('ArrowDown')) set(st.scroll + 14);
    if (keys.down.has('ArrowUp')) set(st.scroll - 14);
    if (keys.pressed.has('PageDown') || keys.pressed.has('Space')) set(st.scroll + step);
    if (keys.pressed.has('PageUp')) set(st.scroll - step);
    if (keys.pressed.has('Home')) set(0);
    if (keys.pressed.has('End')) set(max);
    return used;
  }
  const updatePages = (input) => {
    const ptr = input.pointer, keys = input.keys;
    const mt = MN.readerMeta();
    const close = () => { G.scene = G.back === 'play' ? 'play' : 'title'; G.ui.scroll = 0; G.ui.drag = null; };
    const down = () => { if (G.ui.scroll >= mt.max - 2) close(); else G.ui.scroll = clamp(G.ui.scroll + mt.view - 70, 0, mt.max); };
    const up = () => { if (G.ui.scroll <= 2) close(); else G.ui.scroll = clamp(G.ui.scroll - (mt.view - 70), 0, mt.max); };
    const zoom = (d) => { const old = G.settings.textIdx; G.settings.textIdx = clamp(old + d, 0, TEXT_SCALES.length - 1); if (G.settings.textIdx !== old) G.ui.keepFrac = mt.max > 0 ? G.ui.scroll / mt.max : 0; saveSettings(); };
    const used = scrollInput(input, G.ui, mt.max, mt.view, mt.rect);
    if (ptr.pressed && !used) {
      if (inRect(REF_NEXT, ptr.x, ptr.y)) down();
      else if (inRect(REF_BACK, ptr.x, ptr.y)) close();
      else if (inRect(TEXT_DEC, ptr.x, ptr.y)) zoom(-1);
      else if (inRect(TEXT_INC, ptr.x, ptr.y)) zoom(1);
    }
    if (keys.pressed.has('ArrowRight')) down();
    if (keys.pressed.has('ArrowLeft')) up();
    if (keys.pressed.has('Equal') || keys.pressed.has('NumpadAdd')) zoom(1);
    if (keys.pressed.has('Minus') || keys.pressed.has('NumpadSubtract')) zoom(-1);
    if (keys.pressed.has('Escape')) close();
  };
  const updateSetup = (dt, input) => {
    const ptr = input.pointer, k = input.keys;
    if (k.pressed.has('Enter')) { handleSetup('start'); return; }
    if (k.pressed.has('Escape')) { handleSetup('back'); return; }
    if (ptr.pressed && (inRect(SETUP_PINS.start, ptr.x, ptr.y) || inRect(SETUP_PINS.back, ptr.x, ptr.y))) { handleSetup(inRect(SETUP_PINS.start, ptr.x, ptr.y) ? 'start' : 'back'); return; }
    updateFlowScene(dt, input, handleSetup, 'setup');
  };

  // ---- the play update -------------------------------------------------------------------------------------------------------------------------
  function updatePlay(dt, input) {
    const ptr = input.pointer, keys = input.keys;
    const s = S.s;
    if (G.mode === 'shot') { S.update(dt, {}); processEvents(); return; }
    if (G.pauseMenu) { resetCtl(); MN.ensureLayout(G, 'pause'); updateFlowScene(dt, input, handlePause, null); return; }
    const lay = hudLayout(G.settings.textIdx);
    if (G.think) {
      resetCtl();
      const tm = G.thinkMeta, tused = tm && G.thinkSt ? scrollInput(input, G.thinkSt, tm.max, tm.view, tm.rect) : false;
      if (ptr.pressed && !tused && G.thinkRects) {
        if (inRect(G.thinkRects.show, ptr.x, ptr.y)) { G.hintShow = { until: s.t + 5, target: G.think.target }; G.think = null; sfx.tick(); }
        else if (inRect(G.thinkRects.close, ptr.x, ptr.y)) { G.think = null; sfx.tick(); }
      }
      if (keys.pressed.has('Escape') || keys.pressed.has('KeyT')) G.think = null;
      return;
    }
    if (G.mode === 'watch') {
      const wm = G.watchMeta, wused = wm && G.watchSt ? scrollInput(input, G.watchSt, wm.max, wm.view, wm.rect) : false;
      if (ptr.pressed && !wused) {
        const i = watchHit(ptr.x, ptr.y);
        if (i === 0) { G.watch.paused = !G.watch.paused; sfx.tick(); }
        else if (i === 1) { G.settings.thinkIdx = Math.max(0, G.settings.thinkIdx - 1); saveSettings(); }
        else if (i === 2) { G.settings.thinkIdx = Math.min(THINK_STEPS.length - 1, G.settings.thinkIdx + 1); saveSettings(); }
        else if (i === 3) { leaveMatch(); return; }
      }
      if (keys.pressed.has('KeyP') || keys.pressed.has('Escape')) G.watch.paused = !G.watch.paused;
      if (!updateWatch(dt)) return;
      S.update(dt, {});
      processEvents();
      return;
    }
    // util buttons (taps that are not bound to the stick or a control button)
    for (const t of pollTouches(input)) {
      if (!t.pressed) continue;
      if (inRect(lay.util.pause, t.x, t.y)) { G.paused = true; G.pauseMenu = true; G.ui.scroll = 0; persistMatch(); resetCtl(); return; }
      if (inRect(lay.util.think, t.x, t.y)) { openThink(); resetCtl(); return; }
    }
    if (keys.pressed.has('KeyP') || keys.pressed.has('Escape')) { G.paused = true; G.pauseMenu = true; G.ui.scroll = 0; persistMatch(); resetCtl(); return; }
    if (keys.pressed.has('KeyT')) { openThink(); resetCtl(); return; }
    const cs = controlState(G, S);
    G.meter = S.meter();
    const ctl = readCtl(input, lay, cs);
    S.update(dt, ctl);
    processEvents();
  }

  // ?shot=1 (store screenshots): a real game played by an autopilot player, frozen after N ticks, with the full HUD
  function startShot() {
    G.mode = 'shot'; G.setup.lastMode = 'shot';
    const role = (config.shotRole ?? 0) | 0;
    G.oppName = LEVELS[4].name;
    setSim(createSim({ len: 'full', human: { team: 0, role, auto: true }, level: 4, firstPoss: 0 }, simRng.fork()));
    S.s.humanId = role;
    G.scene = 'play';
  }
  function startup() { if (config.shot) startShot(); else startDemoBg(); }
  startup();
  if (config.dev) G.dev = { startMatch, go, startLesson, openThink, resume: resumeMatch, quit: leaveMatch, persist: persistMatch };   // tester hooks (debug builds / ?dev=1 only)

  return {
    // Menus, Rules, About, settings, Learn and Watch & Learn are free; only real play counts against the preview.
    isPreviewExempt: () => !(G.scene === 'play' && G.mode === 'ai') || G.paused || G.pauseMenu || !!G.think || (S && (S.s.phase === 'dead' || S.s.phase === 'over')),
    update(dt, input) {
      setPress(input.pointer);
      G.t += dt;
      for (let i = delayed.length - 1; i >= 0; i--) { delayed[i].t -= dt; if (delayed[i].t <= 0) { delayed[i].f(); delayed.splice(i, 1); } }
      if (G.scene !== 'play') S.update(dt, {});
      switch (G.scene) {
        case 'title': updateFlowScene(dt, input, handleTitle, 'title'); break;
        case 'setup': updateSetup(dt, input); break;
        case 'settings': updateFlowScene(dt, input, handleSettings, 'settings'); break;
        case 'learn': updateFlowScene(dt, input, handleLearn, 'learn'); break;
        case 'lesson': updateFlowScene(dt, input, handleLesson, 'lesson'); break;
        case 'quiz': updateFlowScene(dt, input, handleQuiz, 'quiz'); break;
        case 'lessonresult': updateFlowScene(dt, input, handleLessonResult, 'lessonresult'); break;
        case 'result': updateFlowScene(dt, input, handleResult, 'result'); break;
        case 'demolimit': updateFlowScene(dt, input, (id) => { if (id === 'menu') go('title'); }, 'demolimit'); break;
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
          if (G.think && !G.think.silent) renderThink(ctx, G, view);
          if (G.pauseMenu) MN.renderPause(ctx, G);
          break;
        default: break;
      }
    },
    getState: () => G,
  };
}

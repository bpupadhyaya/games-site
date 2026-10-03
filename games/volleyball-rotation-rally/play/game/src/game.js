// Volleyball: the game shell. Scenes, input (one-finger stick + press + flick), persistence, preview wiring, Learn, Watch & Learn.
// The match itself lives in sim.js.
import { createSim } from './sim.js';
import { W, H, TEXT_SCALES, THINK_STEPS, REF_BACK, REF_NEXT, TEXT_DEC, TEXT_INC, SETUP_PINS, inRect } from './layout.js';
import { setPress } from './ui.js';
import { ABOUT, HOWTO, RULES, LESSONS, QUIZ, ROLE_TUT } from './content.js';
import * as MN from './menus.js';
import { renderHud, renderFallback, hudRects, renderThink, watchHit, ROT_CLOSE } from './hud.js';
import { ROLES, MODES } from './consts.js';
import { clamp } from './util.js';
import { tmLabel } from './physics.js';

export const meta = { width: W, height: H };
const DEMO_MATCH_CAP = 2;
const SAVE_VERSION = 1;
const STICK_R = 80, STICK_DEAD = 12, FLICK_PX = 46, FLICK_REF = 120;

export function createGame(env) {
  const { rng, audio, storage, config } = env;
  const demo = !!config.demo;
  const G = {
    scene: 'title', mode: 'none', demo, loaded: false,
    settings: { textIdx: 0, sound: true, women: false, thinkIdx: 1, assist: 2, liberoServes: false },
    setup: { role: 'libero', opp: 3, mode: 'best3', watch: false, watchA: 3, lastMode: 'ai' },
    ui: { scroll: 0, drag: null }, page: 0, back: 'title', setupMsg: '', restoreMsg: '', pageList: null, pageTitle: '',
    learn: { cur: 0, qi: 0, qscore: 0, done: {}, result: null, tally: null, goal: '', lessonN: 0 },
    saved: null, record: { demoMatches: 0 },
    sim: null, women: false, paused: false, pauseMenu: false, think: null, thinkRects: null, feedback: null, showRot: false,
    watch: { phase: 'think', timer: 0, paused: false, holdId: -1 }, t: 0, viewW: 720, viewH: 1280,
  };
  let aboutList = ABOUT;
  if (typeof fetch === 'function') {
    fetch('./vendor3d/LICENSES.md').then((r) => (r.status >= 400 ? '' : r.text())).then((t) => {
      const paras = String(t).split(/\n\s*\n/).map((x) => x.replace(/^#+\s*/gm, '').replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);
      if (paras.length) aboutList = [...ABOUT, { title: 'Credits and licences', p: paras }];
    }).catch(() => {});
  }
  let S = null, evSeen = 0, snap = null;
  const simRng = rng.fork();
  const roleOf = (id) => ROLES.find((r) => r.id === id) || ROLES[4];

  // ---- persistence -------------------------------------------------------------------------------
  const saveSettings = () => { storage.set('settings', G.settings); storage.set('learn', { done: G.learn.done }); storage.set('record', G.record); };
  const metaOfSave = (d) => ({ roleName: roleOf(d.setup.role).name, setNo: d.match.setNo, pts: [...d.match.pts] });
  const validSave = (d) => d && d.v === SAVE_VERSION && d.setup && d.match && Array.isArray(d.match.pts) && Array.isArray(d.match.sets) && Array.isArray(d.match.rot) && MODES[d.setup.mode] && ROLES.some((r) => r.id === d.setup.role);
  const persistMatch = () => {
    if (!S || G.mode !== 'ai' || S.s.match.over) return;
    const m = S.s.match;
    const d = { v: SAVE_VERSION, setup: { ...G.setup, lastMode: 'ai' }, women: G.women, match: { setNo: m.setNo, sets: [...m.sets], pts: [...m.pts], setScores: m.setScores.map((x) => [...x]), firstServer: m.firstServer, serving: m.serving, rallies: m.rallies, rot: [S.s.teams[0].rot.slice(), S.s.teams[1].rot.slice()], rotN: [S.s.teams[0].rotN, S.s.teams[1].rotN] } };
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
    G.settings.assist = clamp(G.settings.assist | 0, 0, 2);
    if (G.scene === 'title') G.women = !!G.settings.women;
    G.loaded = true;
    audio.setMuted?.(!G.settings.sound);
  });

  // ---- sound ---------------------------------------------------------------------------------------
  const tone = (o) => { if (G.settings.sound) audio.tone(o); };
  const sfx = {
    tick: () => tone({ freq: 760, dur: 0.04, type: 'triangle', vol: 0.05 }),
    bump: (q) => tone({ freq: 150 + q * 60, to: 90, dur: 0.1, type: 'sine', vol: 0.16 }),
    set: () => tone({ freq: 420, to: 330, dur: 0.06, type: 'triangle', vol: 0.08 }),
    spike: () => { tone({ freq: 130, to: 55, dur: 0.2, type: 'sine', vol: 0.22 }); tone({ freq: 1500, to: 300, dur: 0.08, type: 'sawtooth', vol: 0.05 }); },
    serve: () => tone({ freq: 180, to: 80, dur: 0.12, type: 'sine', vol: 0.18 }),
    block: () => tone({ freq: 110, to: 60, dur: 0.18, type: 'triangle', vol: 0.2 }),
    bounce: () => tone({ freq: 220, to: 120, dur: 0.1, type: 'sine', vol: 0.12 }),
    net: () => tone({ freq: 300, to: 200, dur: 0.12, type: 'triangle', vol: 0.08 }),
    point: (win) => (win ? [0, 4, 7].forEach((n, i) => tone({ freq: 523 * Math.pow(2, n / 12), dur: 0.18 + i * 0.04, type: 'triangle', vol: 0.09 })) : [0, -3].forEach((n, i) => tone({ freq: 392 * Math.pow(2, n / 12), dur: 0.22, type: 'triangle', vol: 0.07 }))),
    whistle: () => tone({ freq: 2400, to: 2100, dur: 0.25, type: 'sine', vol: 0.05 }),
  };
  const delayed = [];
  const later = (f) => delayed.push({ t: 0.35, f });

  // ---- match lifecycle -------------------------------------------------------------------------------
  const setSim = (sim) => { S = sim; G.sim = sim.s; evSeen = 0; G.feedback = null; G.think = null; G.showRot = false; };
  const startDemoBg = () => { setSim(createSim({ mode: 'quick', levels: [3, 3], role: null, firstServer: 0, women: G.women }, simRng.fork())); G.mode = 'none'; };
  function startMatch(kind, opts = {}) {
    const st = G.setup;
    G.women = !!G.settings.women;
    let cfg;
    if (kind === 'ai') {
      if (demo && G.record.demoMatches >= DEMO_MATCH_CAP && !opts.resume) { G.scene = 'demolimit'; G.ui.scroll = 0; return; }
      cfg = { mode: demo ? 'quick' : st.mode, role: roleOf(st.role).type, levels: [3, st.opp], women: G.women, assist: G.settings.assist, liberoServes: G.settings.liberoServes };
    } else if (kind === 'watch') cfg = { mode: 'quick', role: null, levels: [st.watchA, st.opp], women: G.women, watch: true };
    else if (kind === 'drill') { const l = opts.lesson; cfg = { mode: 'quick', role: roleOf(l.role).type, levels: [3, 2], women: G.women, assist: G.settings.assist, drill: l.drill, firstServer: l.drill.server ?? 0 }; }
    if (opts.resume) { cfg.resume = opts.resume; cfg.mode = G.setup.mode; }
    G.mode = kind;
    if (kind !== 'drill') G.setup.lastMode = kind;
    setSim(createSim(cfg, simRng.fork()));
    G.scene = 'play'; G.paused = !!opts.paused; G.pauseMenu = !!opts.paused; G.ui.scroll = 0; G.watch = { phase: 'think', timer: 0, paused: false, holdId: -1 };
    if (kind === 'ai') { if (demo && !opts.resume) { G.record.demoMatches++; saveSettings(); } if (!opts.resume) persistMatch(); }
  }
  const resumeMatch = () => {
    if (!snap) return;
    const d = JSON.parse(JSON.stringify(snap));
    Object.assign(G.setup, d.setup); G.settings.women = !!d.women;
    startMatch('ai', { resume: d.match, paused: true });
  };
  const leaveMatch = () => { persistMatch(); G.scene = 'title'; G.mode = 'none'; G.paused = false; G.pauseMenu = false; G.think = null; G.showRot = false; G.ui.scroll = 0; G.women = !!G.settings.women; startDemoBg(); };

  // ---- learn --------------------------------------------------------------------------------------------
  function startLesson(lessonOverride) {
    const l = lessonOverride || LESSONS[G.learn.cur];
    if (l.quiz) { G.learn.qi = 0; G.learn.qscore = 0; G.scene = 'quiz'; G.ui.scroll = 0; return; }
    G.learn.tally = { n: 0, ok: 0, rally: { q: null, tm: null, blocked: false, landIn: null } }; G.learn.goal = l.goal; G.learn.lessonN = l.n;
    startMatch('drill', { lesson: l });
  }
  function drillEvent(e) {
    const l = LESSONS[G.learn.cur], T = G.learn.tally;
    if (!T || !l) return;
    const r = T.rally;
    if (e.type === 'touch' && e.team === 0) {
      if (e.kind === 'receive' && l.id === 'receive' && r.q === null) r.q = e.q;
      if (e.kind === 'set' && l.id === 'set' && r.q === null) r.q = e.q;
      if (e.kind === 'attack') r.tm = e.tm;
    }
    if (e.type === 'touch' && e.team === 1 && e.kind === 'attack') r.oppAttack = true;
    if (e.type === 'block' && e.team === 0) r.blocked = true;
    if (e.type === 'land' && l.id === 'serve') r.landIn = e.in && e.side === 1;
    if (e.type === 'point') {
      let ok = false;
      if (l.id === 'serve') ok = r.landIn === true;
      else if (l.id === 'receive') ok = r.q !== null && r.q >= 0.5;
      else if (l.id === 'set') ok = r.q !== null && r.q >= 0.55;
      else if (l.id === 'spike') ok = r.tm !== null && r.tm >= 0.6;
      else if (l.id === 'block') ok = r.blocked;
      const tried = l.id === 'serve' ? r.landIn !== null : l.id === 'block' ? !!r.oppAttack : l.id === 'spike' ? r.tm !== null : r.q !== null;
      if (!tried) { T.rally = { q: null, tm: null, blocked: false, landIn: null }; return; }      // the rally ended before your skill came up: it does not count
      T.n++; if (ok) T.ok++;
      G.feedback = { t: S.s.t, text: ok ? 'Good' : 'Not this time', col: ok ? '#7fe8d6' : '#ffb59a', x: 0, z: -3 };
      T.rally = { q: null, tm: null, blocked: false, landIn: null };
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
      if (G.scene !== 'play' && G.scene !== 'none') continue;
      if (G.mode === 'drill') drillEvent(e);
      if (e.type === 'touch') {
        const mine = s.userId >= 0 && e.pid === s.userId;
        if (e.kind === 'attack') sfx.spike(); else if (e.kind === 'serve') sfx.serve(); else if (e.kind === 'set') sfx.set(); else sfx.bump(e.q || 0.5);
        if (mine) { const lab = e.auto ? 'NO PRESS' : tmLabel(e.tm); G.feedback = { t: s.t, text: lab, col: e.auto ? '#ff9a86' : e.tm >= 0.9 ? '#7fe8d6' : e.tm >= 0.7 ? '#ffe9a0' : e.tm >= 0.45 ? '#fff6e4' : '#ff9a86', x: e.c.x, z: e.c.z }; }
      } else if (e.type === 'block') sfx.block();
      else if (e.type === 'land') sfx.bounce();
      else if (e.type === 'netHit' || e.type === 'cord') sfx.net();
      else if (e.type === 'point') {
        sfx.whistle();
        const mine = s.userId >= 0 ? e.winner === 0 : true;
        later(() => sfx.point(mine));
        if (G.mode === 'ai') persistMatch();
      } else if (e.type === 'matchEnd') {
        if (G.mode === 'ai' || G.mode === 'watch') { if (G.mode === 'ai') { clearSave(); if (e.winner === 0) { G.record.matchWins = (G.record.matchWins || 0) + 1; saveSettings(); } } G.scene = 'result'; G.ui.scroll = 0; }
      }
    }
  }

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

  // ---- the one-finger controls ------------------------------------------------------------------------
  // A touch on the court is a stick (drag) and a press (lift). A quick flick as you lift chooses the direction.
  const gest = { on: false, x0: 0, y0: 0, t0: 0, hist: [], moved: 0 };
  function startGesture(ptr) { gest.on = true; gest.x0 = ptr.x; gest.y0 = ptr.y; gest.t0 = G.t; gest.hist = [{ x: ptr.x, y: ptr.y, t: G.t }]; gest.moved = 0; }
  function stickVec(ptr) {
    const dx = ptr.x - gest.x0, dy = ptr.y - gest.y0, d = Math.hypot(dx, dy);
    gest.moved = Math.max(gest.moved, d);
    if (d < STICK_DEAD) return { mx: 0, mz: 0 };
    const k = Math.min(1, (d - STICK_DEAD) / (STICK_R - STICK_DEAD));
    // the camera looks from behind the near baseline: screen right = world -x, screen up = world +z
    return { mx: -dx / d * k, mz: -dy / d * k };
  }
  function flickOf() {
    const h = gest.hist; if (h.length < 2) return null;
    const last = h[h.length - 1]; let ref = h[0];
    for (const p of h) if (G.t - p.t <= 0.16) { ref = p; break; }
    const dx = last.x - ref.x, dy = last.y - ref.y, d = Math.hypot(dx, dy);
    if (d < FLICK_PX) return null;
    return { lat: clamp(-dx / FLICK_REF, -1, 1), fwd: clamp(-dy / FLICK_REF, -1, 1) };
  }
  function playPointer(ptr, rects) {
    const s = S.s, lay = rects.lay;
    if (ptr.pressed) {
      const x = ptr.x, y = ptr.y;
      if (G.showRot) { if (inRect(ROT_CLOSE, x, y)) G.showRot = false; return; }
      if (inRect(lay.util[1], x, y)) { G.paused = true; G.pauseMenu = true; G.ui.scroll = 0; persistMatch(); S.setMove(0, 0); gest.on = false; return; }
      if (inRect(lay.util[0], x, y)) { openThink(); return; }
      if (inRect(lay.util[2], x, y)) { G.showRot = true; return; }
      for (let i = 0; i < rects.cx.list.length; i++) if (inRect(lay.choices[i].rect, x, y)) { applyPick(rects.cx.list[i].id); sfx.tick(); return; }
      if (y > lay.barTop - 4) return;
      startGesture(ptr);
    }
    if (gest.on) {
      if (ptr.down) {
        gest.hist.push({ x: ptr.x, y: ptr.y, t: G.t }); if (gest.hist.length > 12) gest.hist.shift();
        const v = stickVec(ptr); S.setMove(v.mx, v.mz);
      }
      if (ptr.released) {
        const flick = flickOf();
        S.setMove(0, 0);
        const pr = s.prompt;
        if (pr) S.press(pr.kind === 'serveWait' ? null : flick);
        gest.on = false;
      }
    }
    if (!ptr.down && gest.on) { gest.on = false; S.setMove(0, 0); }
  }
  function playKeys(keys) {
    const s = S.s;
    let mx = 0, mz = 0;
    const dn = keys.down;
    if (dn.has('ArrowLeft') || dn.has('KeyA')) mx += 1;
    if (dn.has('ArrowRight') || dn.has('KeyD')) mx -= 1;
    if (dn.has('ArrowUp') || dn.has('KeyW')) mz += 1;
    if (dn.has('ArrowDown') || dn.has('KeyS')) mz -= 1;
    if (!gest.on) S.setMove(mx, mz);
    if (keys.pressed.has('Space') || keys.pressed.has('Enter')) { const pr = s.prompt; if (pr) S.press(pr.kind === 'serveWait' ? null : (mx || mz ? { lat: mx, fwd: mz } : null)); }
  }
  function applyPick(id) {
    const [, k, v] = id.split(':');
    if (k === 'serve') S.choose({ serve: v }); else if (k === 'shot') S.choose({ shot: v }); else if (k === 'set') S.choose({ set: v });
  }
  function openThink() {
    if (S.s.userId < 0) return;
    const sug = S.suggest();
    G.think = { title: sug ? 'Think: ' + sug.title : 'Think', lines: sug ? [sug.reason] : ['Nothing to decide right now. Get ready: move towards where the ball will come down and watch the ring.'], choice: sug ? sug.choice : null, kind: sug ? sug.kind : null };
  }
  function useThink() {
    const t = G.think; if (!t || !t.choice) return;
    if (t.kind === 'serve') S.choose({ serve: t.choice.type });
    else if (t.kind === 'set') S.choose({ set: t.choice.target });
    else if (t.kind === 'attack') S.choose({ shot: t.choice.shot });
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
  const refresh = () => { G.women = !!G.settings.women; };
  function handleTitle(id) {
    if (!id) return;
    sfx.tick();
    if (id === 'continue') resumeMatch();
    else if (id === 'play') { G.setup.watch = false; if (G.setup.mode === 'quick') G.setup.mode = 'best3'; go('setup'); G.setupMsg = ''; }
    else if (id === 'quick') { G.setup.watch = false; G.setup.mode = 'quick'; go('setup'); G.setupMsg = ''; }
    else if (id === 'watch') { G.setup.watch = true; go('setup'); G.setupMsg = ''; }
    else if (id === 'learn') go('learn');
    else if (id === 'howto') { G.back = 'title'; G.pageList = HOWTO; G.pageTitle = 'How to Play'; go('pages'); }
    else if (id === 'rules') { G.back = 'title'; G.pageList = RULES; G.pageTitle = 'Rules'; go('pages'); }
    else if (id === 'about') { G.back = 'title'; G.pageList = aboutList; G.pageTitle = 'About'; go('pages'); }
    else if (id === 'settings') go('settings');
    else if (id === 'sound') { G.settings.sound = !G.settings.sound; audio.setMuted?.(!G.settings.sound); saveSettings(); }
  }
  function handleSetup(id) {
    if (!id) return;
    const st = G.setup;
    sfx.tick();
    if (id.startsWith('role-')) st.role = id.slice(5);
    else if (id === 'tutorial') { G.back = 'roleend'; G.pageList = ROLE_TUT[st.role].pages; G.pageTitle = ROLE_TUT[st.role].title; go('pages'); }
    else if (id.startsWith('opp')) st.opp = +id.slice(3);
    else if (id.startsWith('wa')) st.watchA = +id.slice(2);
    else if (id.startsWith('len-')) st.mode = id.slice(4);
    else if (id === 'ev-m') { G.settings.women = false; saveSettings(); refresh(); }
    else if (id === 'ev-f') { G.settings.women = true; saveSettings(); refresh(); }
    else if (id === 'start') {
      if (demo && st.opp > 2 && !st.watch) { G.setupMsg = 'The free demo has the first two rivals.'; return; }
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
    else if (id.startsWith('as-')) st.assist = +id.slice(3);
    else if (id === 'lib-toggle') st.liberoServes = !st.liberoServes;
    else if (id === 'think-dec') st.thinkIdx = Math.max(0, st.thinkIdx - 1);
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
  function handleRoleEnd(id) {
    if (!id) return;
    sfx.tick();
    if (id === 'rt-back') go('setup');
    else if (id === 'practice') {
      const r = ROLE_TUT[G.setup.role];
      const base = LESSONS.find((l) => l.drill && l.drill.kind === r.drill) || LESSONS[0];
      G.learn.cur = LESSONS.indexOf(base);
      startLesson({ ...base, role: G.setup.role });
    }
  }
  function handlePause(id) {
    if (!id) return;
    sfx.tick();
    if (id === 'resume') { G.paused = false; G.pauseMenu = false; }
    else if (id === 'p-rules') { G.back = 'play'; G.pageList = RULES; G.pageTitle = 'Rules'; go('pages'); }
    else if (id === 'p-howto') { G.back = 'play'; G.pageList = HOWTO; G.pageTitle = 'How to Play'; go('pages'); }
    else if (id === 'p-sound') { G.settings.sound = !G.settings.sound; audio.setMuted?.(!G.settings.sound); saveSettings(); }
    else if (id === 'p-txt-dec') { G.settings.textIdx = Math.max(0, G.settings.textIdx - 1); G.ui.scroll = 0; saveSettings(); }
    else if (id === 'p-txt-inc') { G.settings.textIdx = Math.min(TEXT_SCALES.length - 1, G.settings.textIdx + 1); G.ui.scroll = 0; saveSettings(); }
    else if (id === 'quit') leaveMatch();
  }
  const updatePages = (input) => {
    const ptr = input.pointer, keys = input.keys;
    const n = MN.pageCount();
    const close = () => { G.scene = G.back === 'play' ? 'play' : G.back === 'roleend' ? 'roleend' : 'title'; G.page = 0; G.ui.scroll = 0; };
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
    if (G.mode === 'shot') { S.update(dt); processEvents(); return; }
    if (G.pauseMenu) { MN.ensureLayout(G, 'pause'); updateFlowScene(dt, input, handlePause, null); S.setMove(0, 0); return; }
    if (G.think) {
      S.setMove(0, 0);
      if (ptr.pressed && G.thinkRects) {
        if (G.thinkRects.use && inRect(G.thinkRects.use, ptr.x, ptr.y)) { useThink(); G.think = null; sfx.tick(); }
        else if (inRect(G.thinkRects.close, ptr.x, ptr.y)) { G.think = null; sfx.tick(); }
      }
      return;
    }
    if (G.mode === 'watch') {
      if (ptr.pressed) {
        const i = watchHit(G, ptr.x, ptr.y);
        if (i === 0) { G.watch.paused = !G.watch.paused; sfx.tick(); }
        else if (i === 1) { G.settings.thinkIdx = Math.max(0, G.settings.thinkIdx - 1); saveSettings(); }
        else if (i === 2) { G.settings.thinkIdx = Math.min(THINK_STEPS.length - 1, G.settings.thinkIdx + 1); saveSettings(); }
        else if (i === 3) { leaveMatch(); return; }
      }
      if (keys.pressed.has('KeyP') || keys.pressed.has('Space')) G.watch.paused = !G.watch.paused;
      if (!updateWatch(dt)) return;
      S.update(dt); processEvents();
      return;
    }
    const rects = hudRects(G, S);
    playPointer(ptr, rects);
    playKeys(keys);
    if (keys.pressed.has('KeyP') || keys.pressed.has('Escape')) { G.paused = true; G.pauseMenu = true; G.ui.scroll = 0; persistMatch(); S.setMove(0, 0); return; }
    if (keys.pressed.has('KeyT')) openThink();
    S.update(dt); processEvents();
  }

  // ?shot=1 (store screenshots): a real match played by a scripted player of the chosen role, frozen after N ticks, with the full HUD
  function startShot() {
    G.women = false; G.mode = 'shot'; G.setup.lastMode = 'shot';
    const role = ROLES.find((r) => r.id === new URLSearchParams(globalThis.location.search).get('role')) || ROLES[1];
    setSim(createSim({ mode: 'best3', levels: [3, 3], role: role.type, women: false, bot: { sigma: 0.09 } }, simRng.fork()));
    G.scene = 'play';
  }
  G.requestPause = () => { if (G.scene === 'play' && (G.mode === 'ai' || G.mode === 'drill') && !G.pauseMenu) { G.paused = true; G.pauseMenu = true; G.ui.scroll = 0; persistMatch(); S.setMove(0, 0); gest.on = false; } else if (G.scene === 'play' && G.mode === 'watch') G.watch.paused = true; };
  function startup() { G.women = false; if (config.shot) startShot(); else startDemoBg(); }
  startup();

  function renderWatchCard(ctx) {
    const h = S.s.hold, w = G.watch;
    const title = h.kind === 'serve' ? 'Serve' : h.kind === 'set' ? 'Set' : 'Attack';
    const lines = w.phase === 'think' ? [`Look at where the other team stands, then decide the ${title.toLowerCase()}. The choice is revealed when the timer ends.`] : [h.decision.reason];
    renderThink(ctx, G, (w.phase === 'think' ? 'Think: ' : 'Reveal: ') + title, lines, null);
  }

  return {
    // Menus, Rules, About, settings, Learn, lessons and Watch & Learn are free; only real play counts against the preview.
    isPreviewExempt: () => !(G.scene === 'play' && G.mode === 'ai') || G.paused || G.pauseMenu || !!G.think || G.showRot || (S && S.s.phase === 'dead'),
    update(dt, input) {
      setPress(input.pointer);
      G.t += dt;
      for (let i = delayed.length - 1; i >= 0; i--) { delayed[i].t -= dt; if (delayed[i].t <= 0) { delayed[i].f(); delayed.splice(i, 1); } }
      if (G.scene !== 'play') { if (!(G.scene === 'pages' && G.back === 'play')) S.update(dt); S.setMove(0, 0); if (gest.on) gest.on = false; }
      switch (G.scene) {
        case 'title': updateFlowScene(dt, input, handleTitle, 'title'); break;
        case 'setup': updateSetup(dt, input); break;
        case 'settings': updateFlowScene(dt, input, handleSettings, 'settings'); break;
        case 'learn': updateFlowScene(dt, input, handleLearn, 'learn'); break;
        case 'lesson': updateFlowScene(dt, input, handleLesson, 'lesson'); break;
        case 'quiz': updateFlowScene(dt, input, handleQuiz, 'quiz'); break;
        case 'lessonresult': updateFlowScene(dt, input, handleLessonResult, 'lessonresult'); break;
        case 'roleend': updateFlowScene(dt, input, handleRoleEnd, 'roleend'); break;
        case 'result': updateFlowScene(dt, input, handleResult, 'result'); break;
        case 'demolimit': updateFlowScene(dt, input, (id) => { if (id === 'menu') go('title'); }, 'demolimit'); break;
        case 'pages': updatePages(input); break;
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
        case 'roleend': MN.renderRoleEnd(ctx, G); break;
        case 'result': MN.renderResult(ctx, G); break;
        case 'demolimit': MN.renderDemoLimit(ctx, G); break;
        case 'pages': MN.renderPages(ctx, G, G.pageList || ABOUT, G.pageTitle); break;
        case 'play':
          renderHud(ctx, G, S, { cssW: G.viewW, cssH: G.viewH });
          if (G.think) renderThink(ctx, G, G.think.title, G.think.lines, G.think.choice ? 'Use it' : null);
          else if (G.mode === 'watch' && S.s.hold && G.watch.phase !== 'act') renderWatchCard(ctx);
          if (G.pauseMenu) MN.renderPause(ctx, G);
          break;
        default: break;
      }
    },
    getState: () => G,
  };
}

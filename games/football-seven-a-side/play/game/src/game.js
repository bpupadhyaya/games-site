// Football: Seven a Side. The game shell: scenes, input, persistence, preview wiring, Learn, Watch & Learn. The match itself lives in sim.js.
import { createSim, dirOf } from './sim.js';
import { W, H, TEXT_SCALES, THINK_STEPS, REF_BACK, REF_NEXT, TEXT_DEC, TEXT_INC, SETUP_PINS, inRect, hudLayout } from './layout.js';
import { setPress } from './ui.js';
import { ABOUT, HOWTO, RULES, ROLE_GUIDE, LESSONS, QUIZ } from './content.js';
import * as MN from './menus.js';
import { renderHud, renderFallback, renderThinkBox, renderHold } from './hud.js';
import { createControls } from './controls.js';
import { initialCam } from './camera.js';
import { makeHint } from './hint.js';
import { setupDrill } from './drills.js';
import { makeBot } from './bot.js';
import { LEVELS, CHOICES, roleOf, ROLE_NAME, HALF_OPTIONS } from './consts.js';
import { clamp } from './util.js';

export const meta = { width: W, height: H };
const DEMO_MATCH_CAP = 2;
const SAVE_VERSION = 1;

export function createGame(env) {
  const { rng, audio, storage, config } = env;
  const demo = !!config.demo;
  const ctl = createControls();
  const G = {
    scene: 'title', mode: 'none', demo, loaded: false,
    settings: { textIdx: 0, sound: true, thinkIdx: 1, tags: true },
    setup: { role: 'ST', side: 'L', opp: 3, half: 180, watch: false, watchA: 3, watchB: 3, lastMode: 'play' },
    ui: { scroll: 0, drag: null, vel: 0 }, page: 0, back: 'title', pagesKey: 'about', setupMsg: '', restoreMsg: '',
    learn: { cur: 0, qi: 0, qscore: 0, done: {}, result: null, tally: null },
    saved: null, record: { demoMatches: 0, wins: 0, played: 0, coach: 0 },
    sim: null, cam: initialCam(), viewW: 720, viewH: 1280, paused: false, pauseMenu: false, think: null, thinkRects: null, banner: null, coach: null, ctxMsg: '',
    teamNames: ['You', 'Park Rovers'], roleName: '', thinkSec: 5, ctl, watch: { phase: 'think', timer: 0, paused: false, holdId: -1 }, watchRects: null, t: 0, lay: null,
  };
  G.thinkSec = THINK_STEPS[G.settings.thinkIdx];
  let aboutList = ABOUT;
  if (typeof fetch === 'function') {
    fetch('./vendor3d/LICENSES.md').then((r) => (r.status >= 400 ? '' : r.text())).then((t) => {
      const paras = String(t).split(/\n\s*\n/).map((x) => x.replace(/^#+\s*/gm, '').replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);
      if (paras.length) aboutList = [...ABOUT, { title: 'Credits and licences', p: paras }];
    }).catch(() => {});
  }
  let S = null, evSeen = 0, snap = null, simRng = rng.fork();
  const delayed = [];
  const later = (sec, f) => delayed.push({ t: sec, f });

  // ---- persistence -------------------------------------------------------------------------------------------------------------------
  const saveSettings = () => { storage.set('settings', { ...G.settings, setup: { role: G.setup.role, side: G.setup.side, opp: G.setup.opp, half: G.setup.half, watchA: G.setup.watchA, watchB: G.setup.watchB } }); storage.set('learn', { done: G.learn.done }); storage.set('record', G.record); };
  const roleLabel = () => { const r = roleOf(G.setup.role, G.setup.side); return `${ROLE_NAME[r]}${r === 'WL' || r === 'DL' ? ' (left)' : r === 'WR' || r === 'DR' ? ' (right)' : ''}`; };
  const validSave = (d) => d && d.v === SAVE_VERSION && Array.isArray(d.score) && d.score.length === 2 && (d.half === 1 || d.half === 2) && d.clock > 0 && d.setup && typeof d.setup.role === 'string';
  const persistMatch = () => {
    if (!S || G.mode !== 'play' || S.s.over) return;
    const s = S.s;
    const d = { v: SAVE_VERSION, setup: { ...G.setup, lastMode: 'play' }, score: [...s.score], half: s.half, clock: Math.max(1, s.clock), firstKick: s.firstKick, kickTeam: s.kickTeam, stats: s.stats, roleName: G.roleName, oppName: G.teamNames[1] };
    snap = d; G.saved = { roleName: d.roleName, score: d.score, half: d.half }; storage.set('match', d);
  };
  const clearSave = () => { snap = null; G.saved = null; storage.remove('match'); };
  Promise.all([storage.get('settings', null), storage.get('learn', null), storage.get('record', null), storage.get('match', null)]).then(([s, l, r, mch]) => {
    if (s) { const { setup, ...rest } = s; Object.assign(G.settings, rest); if (setup) Object.assign(G.setup, setup); }
    if (l && l.done) G.learn.done = l.done;
    if (r) Object.assign(G.record, r);
    if (validSave(mch)) { snap = mch; G.saved = { roleName: mch.roleName, score: mch.score, half: mch.half }; }
    G.settings.textIdx = clamp(G.settings.textIdx | 0, 0, TEXT_SCALES.length - 1);
    G.settings.thinkIdx = clamp(G.settings.thinkIdx | 0, 0, THINK_STEPS.length - 1);
    G.thinkSec = THINK_STEPS[G.settings.thinkIdx];
    if (!['ST', 'W', 'CM', 'D', 'GK'].includes(G.setup.role)) G.setup.role = 'ST';
    if (!HALF_OPTIONS.includes(G.setup.half)) G.setup.half = 180;
    G.loaded = true; MN.dropLayout();
    audio.setMuted?.(!G.settings.sound);
  });

  // ---- sound ---------------------------------------------------------------------------------------------------------------------------
  const tone = (o) => { if (G.settings.sound) audio.tone(o); };
  const sfx = {
    tick: () => tone({ freq: 760, dur: 0.04, type: 'triangle', vol: 0.05 }),
    kick: (p) => { tone({ freq: 150 + p * 70, to: 60, dur: 0.1, type: 'sine', vol: 0.12 + 0.12 * p }); tone({ freq: 1100, to: 300, dur: 0.035, type: 'square', vol: 0.02 + 0.02 * p }); },
    touch: () => tone({ freq: 190, to: 110, dur: 0.05, type: 'sine', vol: 0.05 }),
    bounce: (v) => tone({ freq: 140, to: 80, dur: 0.07, type: 'sine', vol: clamp(0.03 + v * 0.015, 0.03, 0.11) }),
    post: () => { tone({ freq: 880, to: 700, dur: 0.35, type: 'triangle', vol: 0.12 }); tone({ freq: 1320, to: 1000, dur: 0.3, type: 'sine', vol: 0.05 }); },
    net: () => { tone({ freq: 220, to: 120, dur: 0.25, type: 'triangle', vol: 0.06 }); tone({ freq: 90, to: 60, dur: 0.3, type: 'sine', vol: 0.1 }); },
    whistle: (long) => { tone({ freq: 2500, to: 2350, dur: long ? 0.7 : 0.28, type: 'sine', vol: 0.05 }); tone({ freq: 2620, to: 2470, dur: long ? 0.7 : 0.28, type: 'sine', vol: 0.03 }); },
    save: () => { tone({ freq: 240, to: 90, dur: 0.1, type: 'sine', vol: 0.14 }); },
    tackle: () => tone({ freq: 130, to: 60, dur: 0.12, type: 'triangle', vol: 0.12 }),
    cheer: () => [0, 4, 7, 12].forEach((n, i) => later(i * 0.07, () => tone({ freq: 392 * Math.pow(2, n / 12), dur: 0.5, type: 'sawtooth', vol: 0.035 }))),
    groan: () => tone({ freq: 300, to: 160, dur: 0.5, type: 'sawtooth', vol: 0.04 }),
  };

  // ---- the match lifecycle ----------------------------------------------------------------------------------------------------------------
  const kitNames = (a, b) => { const n = [LEVELS[a - 1].name, LEVELS[b - 1].name]; if (n[0] === n[1]) { n[0] += ' Blue'; n[1] += ' Red'; } return n; };
  const setSim = (sim) => { S = sim; G.sim = sim.s; evSeen = sim.s.evN; G.banner = null; G.think = null; G.coach = null; ctl.reset(); };
  const startDemoBg = () => {
    const sim = createSim({ levels: [3, 3], halfSec: 3600, watch: false }, simRng.fork());
    setSim(sim); G.mode = 'none'; G.teamNames = ['Blue', 'Red']; G.roleName = '';
  };
  function startMatch(kind, opts = {}) {
    const st = G.setup;
    let cfg;
    if (kind === 'play') {
      if (demo && G.record.demoMatches >= DEMO_MATCH_CAP) { G.scene = 'demolimit'; G.ui.scroll = 0; MN.dropLayout(); return; }
      const half = demo ? Math.min(120, st.half) : st.half;
      cfg = { levels: [3, demo ? Math.min(2, st.opp) : st.opp], halfSec: half, humanRole: roleOf(st.role, st.side), humanLevel: 3 };
      G.teamNames = ['You', LEVELS[(demo ? Math.min(2, st.opp) : st.opp) - 1].name];
      G.roleName = roleLabel();
    } else if (kind === 'watch') {
      cfg = { levels: [st.watchA, st.watchB], halfSec: 120, watch: true };
      G.teamNames = kitNames(st.watchA, st.watchB); G.roleName = '';
    } else if (kind === 'drill') {
      cfg = { levels: [3, 3], halfSec: 3600, humanRole: opts.drill.role, humanLevel: 3, drill: opts.drill, start: 'none' };
      G.teamNames = ['You', 'Drill']; G.roleName = ROLE_NAME[opts.drill.role];
    }
    if (opts.resume) cfg.resume = opts.resume;
    const sim = createSim(cfg, simRng.fork());
    if (kind === 'drill') setupDrill(sim, opts.drill);
    setSim(sim);
    G.mode = kind; G.setup.lastMode = kind;
    G.scene = 'play'; G.paused = !!opts.paused; G.pauseMenu = !!opts.paused; G.ui.scroll = 0; MN.dropLayout();
    G.watch = { phase: 'think', timer: 0, paused: false, holdId: -1 };
    if (kind === 'play') {
      if (demo && !opts.resume) { G.record.demoMatches++; saveSettings(); }
      if (!opts.resume) persistMatch();
      if (G.record.coach < 3 && !opts.resume) { G.coach = { text: coachText(roleOf(st.role, st.side)), until: 9 }; G.record.coach++; saveSettings(); }
    }
  }
  const coachText = (r) => ({
    GK: 'You are the goalkeeper. Move with the left thumb. Swipe on the pitch to dive when a shot comes, or hold the stick and press DIVE.',
    ST: 'You are the striker. Move with the left thumb, hold SHOOT then release to shoot, and press CALL when you are free.',
    CM: 'You are the central midfielder. Move with the left thumb. PASS to the glowing teammate, THROUGH for a runner, TACKLE to win the ball back.',
  }[r] || 'Move with the left thumb. With the ball: SHOOT, PASS, LOB or THROUGH. Without it: TACKLE, SLIDE or CALL.');
  const resumeMatch = () => {
    if (!snap) return;
    const d = JSON.parse(JSON.stringify(snap));
    Object.assign(G.setup, d.setup);
    startMatch('play', { resume: { score: d.score, half: d.half, clock: d.clock, firstKick: d.firstKick, kickTeam: d.kickTeam, stats: d.stats }, paused: true });
  };
  const leaveMatch = () => { persistMatch(); G.scene = 'title'; G.mode = 'none'; G.paused = false; G.pauseMenu = false; G.think = null; G.ui.scroll = 0; MN.dropLayout(); startDemoBg(); };

  // ---- learn -------------------------------------------------------------------------------------------------------------------------------
  function startLesson() {
    const l = LESSONS[G.learn.cur];
    if (l.quiz) { G.learn.qi = 0; G.learn.qscore = 0; G.scene = 'quiz'; G.ui.scroll = 0; MN.dropLayout(); return; }
    G.learn.tally = { n: 0, ok: 0 };
    startMatch('drill', { drill: { ...l.drill, role: l.role === 'D' ? 'DL' : l.role, n: l.n, id: l.id } });
  }
  function drillEvent(e) {
    const l = LESSONS[G.learn.cur], T = G.learn.tally;
    if (!T || !l) return;
    if (e.type === 'drillAttempt') {
      T.n++; if (e.ok) T.ok++;
      G.banner = { t: S.s.t, dur: 1.6, text: e.ok ? 'Good!' : (e.msg || 'Not this time'), col: e.ok ? 'rgba(31,157,143,0.85)' : 'rgba(168,48,31,0.8)' };
      sfx[e.ok ? 'cheer' : 'groan']();
    }
    if (e.type === 'drillDone') {
      G.learn.result = { score: T.ok, n: l.n, pass: T.ok >= l.need };
      if (G.learn.result.pass) { G.learn.done[l.id] = true; saveSettings(); }
      G.scene = 'lessonresult'; G.ui.scroll = 0; G.mode = 'none'; MN.dropLayout(); startDemoBg();
    }
  }

  // ---- events from the sim: sound, banners, saving -----------------------------------------------------------------------------------------------
  const SP_NAME = { kickoff: 'Kick-off', throw: 'Throw-in', goalkick: 'Goal kick', corner: 'Corner', free: 'Free kick', penalty: 'Penalty' };
  function processEvents() {
    const s = S.s;
    for (const e of s.events) {
      if (e.id < evSeen) continue;
      evSeen = e.id + 1;
      if (G.mode === 'drill') drillEvent(e);
      const mine = G.mode === 'play' ? e.team === 0 || (e.pid !== undefined && s.players[e.pid].team === 0) : true;
      switch (e.type) {
        case 'kick': sfx.kick(e.power || 0.5); break;
        case 'head': sfx.kick(0.4); break;
        case 'touch': sfx.touch(); break;
        case 'bounce': sfx.bounce(e.v); break;
        case 'post': case 'bar': sfx.post(); G.banner = { t: s.t, dur: 1.0, text: e.type === 'bar' ? 'Off the bar!' : 'Off the post!' }; break;
        case 'save': sfx.save(); if (G.mode === 'play' || G.mode === 'watch') G.banner = { t: s.t, dur: 1.0, text: e.kind === 'catch' ? 'Saved!' : 'Parried!' }; break;
        case 'tackle': if (e.ok) sfx.tackle(); break;
        case 'foul': sfx.whistle(false); G.banner = { t: s.t, dur: 1.3, text: 'Foul', sub: s.players[e.by].team === 0 ? 'Free kick to them' : 'Free kick to you' }; break;
        case 'out': sfx.whistle(false); break;
        case 'setpiece': if (G.mode !== 'drill') { G.banner = { t: s.t, dur: e.kind === 'kickoff' ? 1.2 : 1.1, text: SP_NAME[e.kind] }; if (e.kind === 'kickoff') sfx.whistle(true); } break;
        case 'goal': {
          sfx.net(); later(0.2, () => (e.team === 0 || G.mode === 'watch' ? sfx.cheer() : sfx.groan())); sfx.whistle(true);
          G.banner = { t: s.t, dur: 3.0, text: e.own ? 'Own goal' : 'GOAL!', sub: `${s.score[0]} - ${s.score[1]}`, big: true, col: e.team === 0 || G.mode === 'watch' ? 'rgba(31,157,143,0.82)' : 'rgba(168,48,31,0.82)' };
          if (G.mode === 'play') persistMatch();
          break;
        }
        case 'halftime': sfx.whistle(true); G.banner = { t: s.t, dur: 2.6, text: 'Half time', sub: `${s.score[0]} - ${s.score[1]}`, big: true }; if (G.mode === 'play') persistMatch(); break;
        case 'fulltime':
          sfx.whistle(true);
          if (G.mode === 'play' || G.mode === 'watch') {
            if (G.mode === 'play') { clearSave(); G.record.played++; if (e.winner === 0) G.record.wins++; saveSettings(); }
            later(1.6, () => { if (G.scene === 'play') { G.scene = 'result'; G.ui.scroll = 0; MN.dropLayout(); } });
          }
          break;
        default: break;
      }
    }
  }

  // ---- watch & learn --------------------------------------------------------------------------------------------------------------------------
  function updateWatch(dt) {
    const s = S.s, w = G.watch;
    if (w.paused) return false;
    if (s.hold) {
      if (w.holdId !== s.hold.n) { w.holdId = s.hold.n; w.phase = 'think'; w.timer = G.thinkSec; }
      w.timer -= dt;
      if (w.phase === 'think' && w.timer <= 0) { w.phase = 'reveal'; w.timer = 2; }
      else if (w.phase === 'reveal' && w.timer <= 0) { w.phase = 'act'; S.release(); return true; }
      return false;
    }
    return true;
  }

  // ---- the play update ---------------------------------------------------------------------------------------------------------------------------
  const touchList = (input) => {
    if (env.touches) { G.mtSeen = true; return env.touches.snapshot(); }
    const p = input.pointer;
    return p.down || p.pressed || p.released ? [{ id: 'ptr', x: p.x, y: p.y, down: p.down, pressed: p.pressed, released: p.released }] : [];
  };
  const openThink = () => {
    const p = S.s.human >= 0 ? S.s.players[S.s.human] : null;
    if (!p || S.s.phase === 'full') return;
    G.think = makeHint(S, p);
  };
  function updateThinkBox(list) {
    for (const t of list) if (t.pressed && G.thinkRects) {
      if (inRect(G.thinkRects.use, t.x, t.y) || inRect(G.thinkRects.close, t.x, t.y)) { G.think = null; ctl.reset(); sfx.tick(); }
    }
  }
  function updatePlay(dt, input) {
    const keys = input.keys, s = S.s;
    if (G.pauseMenu) { MN.ensureLayout(G, 'pause'); updateFlowScene(dt, input, handlePause, null); return; }
    const list = touchList(input);
    const lay = hudLayout(G.settings.textIdx);
    if (G.mode === 'watch') {
      for (const t of list) if (t.pressed && G.watchRects) {
        const R = G.watchRects;
        if (inRect(R.pause, t.x, t.y)) { G.watch.paused = !G.watch.paused; sfx.tick(); }
        else if (inRect(R.less, t.x, t.y)) { G.settings.thinkIdx = Math.max(0, G.settings.thinkIdx - 1); G.thinkSec = THINK_STEPS[G.settings.thinkIdx]; saveSettings(); }
        else if (inRect(R.more, t.x, t.y)) { G.settings.thinkIdx = Math.min(THINK_STEPS.length - 1, G.settings.thinkIdx + 1); G.thinkSec = THINK_STEPS[G.settings.thinkIdx]; saveSettings(); }
        else if (inRect(R.exit, t.x, t.y)) { leaveMatch(); return; }
      }
      if (keys.pressed.has('KeyP') || keys.pressed.has('Escape')) G.watch.paused = !G.watch.paused;
      if (!updateWatch(dt)) return;
      S.update(dt); processEvents();
      return;
    }
    if (G.think) { updateThinkBox(list); if (keys.pressed.has('KeyT') || keys.pressed.has('Escape')) G.think = null; return; }
    if (s.over) { S.update(dt); processEvents(); return; }
    if (!G.bot) ctl.feed(list, lay, dt);
    for (const u of ctl.ui) {
      if (u.id === 'pause') { G.paused = true; G.pauseMenu = true; G.ui.scroll = 0; MN.dropLayout(); persistMatch(); ctl.reset(); return; }
      if (u.id === 'think') { openThink(); ctl.reset(); return; }
    }
    if (keys.pressed.has('KeyP') || keys.pressed.has('Escape')) { G.paused = true; G.pauseMenu = true; G.ui.scroll = 0; MN.dropLayout(); persistMatch(); ctl.reset(); return; }
    if (keys.pressed.has('KeyT')) { openThink(); return; }
    const hp = s.human >= 0 ? s.players[s.human] : null;
    const kb = ctl.keys(keys);
    S.setInput(G.bot ? G.bot(S) : ctl.snapshot(kb, hp && hp.role === 'GK'));
    if (G.coach && s.t > G.coach.until) G.coach = null;
    S.update(dt);
    processEvents();
  }

  // ?shot=1 (store screenshots): a real match played by the computer with the human role highlighted, frozen after N ticks
  function startShot() {
    const sim = createSim({ levels: [3, 4], halfSec: 180, humanRole: 'ST', humanLevel: 4 }, simRng.fork());
    G.teamNames = ['You', LEVELS[3].name]; G.roleName = 'Striker';
    setSim(sim); G.mode = 'play'; G.scene = 'play'; G.setup.lastMode = 'play'; G.bot = makeBot();
  }

  // ---- menus ---------------------------------------------------------------------------------------------------------------------------------------
  function scrollFlow(ptr) {
    const d = G.ui.drag, mt = MN.flowMeta();
    d.moved = Math.max(d.moved, Math.abs(ptr.y - d.y0));
    if (d.moved >= 10 && mt.lay) { const max = Math.max(0, mt.lay.contentH - (mt.bottom - mt.top)); G.ui.scroll = clamp(d.s0 - (ptr.y - d.y0), 0, max); }
  }
  // keyboard + mouse wheel scrolling shared by every scrolling screen: arrows, PageUp/PageDown, Space, Home/End and the wheel
  const takeWheel = () => (env.touches && env.touches.takeWheel ? env.touches.takeWheel() : 0);
  function scrollKeys(input, cur, max, page) {
    const k = input.keys;
    let v = cur + takeWheel();
    if (k.down.has('ArrowDown')) v += 14;
    if (k.down.has('ArrowUp')) v -= 14;
    if (k.pressed.has('PageDown') || k.pressed.has('Space')) v += page;
    if (k.pressed.has('PageUp')) v -= page;
    if (k.pressed.has('Home')) v = 0;
    if (k.pressed.has('End')) v = max;
    return clamp(v, 0, max);
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
    if (input.keys.pressed.has('Equal') || input.keys.pressed.has('NumpadAdd')) { G.settings.textIdx = Math.min(TEXT_SCALES.length - 1, G.settings.textIdx + 1); MN.dropLayout(); saveSettings(); }
    if (input.keys.pressed.has('Minus') || input.keys.pressed.has('NumpadSubtract')) { G.settings.textIdx = Math.max(0, G.settings.textIdx - 1); MN.dropLayout(); saveSettings(); }
    G.ui.scroll = scrollKeys(input, G.ui.scroll, max, Math.max(200, (mt.bottom - mt.top) - 90));
  };
  const go = (scene) => { G.scene = scene; G.ui.scroll = 0; G.ui.vel = 0; G.page = 0; MN.dropLayout(); };
  function handleTitle(id) {
    if (!id) return;
    sfx.tick();
    if (id === 'continue') resumeMatch();
    else if (id === 'play') { G.setup.watch = false; go('setup'); G.setupMsg = ''; }
    else if (id === 'watch') { G.setup.watch = true; go('setup'); G.setupMsg = ''; }
    else if (id === 'learn') go('learn');
    else if (id === 'howto') { G.back = 'title'; G.pagesKey = 'howto'; go('howto'); }
    else if (id === 'rules') { G.back = 'title'; G.pagesKey = 'rules'; go('rules'); }
    else if (id === 'about') { G.back = 'title'; go('about'); }
    else if (id === 'settings') go('settings');
    else if (id === 'sound') { G.settings.sound = !G.settings.sound; audio.setMuted?.(!G.settings.sound); saveSettings(); MN.dropLayout(); }
  }
  function handleSetup(id) {
    if (!id) return;
    const st = G.setup;
    sfx.tick();
    if (id.startsWith('role-')) { st.role = id.slice(5); MN.dropLayout(); }
    else if (id.startsWith('side-')) { st.side = id.slice(5); MN.dropLayout(); }
    else if (id.startsWith('opp')) st.opp = +id.slice(3);
    else if (id.startsWith('wb')) st.watchB = +id.slice(2);
    else if (id.startsWith('wa')) st.watchA = +id.slice(2);
    else if (id.startsWith('half')) { if (!(demo && +id.slice(4) > 120)) st.half = +id.slice(4); }
    else if (id === 'roleguide') { G.back = 'setup'; G.pagesKey = `role:${st.role}`; go('roleguide'); return; }
    else if (id === 'start') {
      if (demo && st.opp > 2 && !st.watch) { G.setupMsg = 'The free demo has the first two opponents.'; return; }
      saveSettings(); startMatch(st.watch ? 'watch' : 'play');
    } else if (id === 'back') go('title');
    if (id !== 'start') saveSettings();
  }
  function handleSettings(id) {
    if (!id) return;
    sfx.tick();
    const st = G.settings;
    if (id === 'set-sound') { st.sound = !st.sound; audio.setMuted?.(!st.sound); }
    else if (id === 'txt-dec') { st.textIdx = Math.max(0, st.textIdx - 1); G.ui.scroll = 0; }
    else if (id === 'txt-inc') { st.textIdx = Math.min(TEXT_SCALES.length - 1, st.textIdx + 1); G.ui.scroll = 0; }
    else if (id === 'set-tags') st.tags = st.tags === false;
    else if (id === 'think-dec') st.thinkIdx = Math.max(0, st.thinkIdx - 1);
    else if (id === 'think-inc') st.thinkIdx = Math.min(THINK_STEPS.length - 1, st.thinkIdx + 1);
    else if (id === 'restore') { G.restoreMsg = 'Checking...'; env.monetization.restore().then(() => { G.restoreMsg = env.monetization.owns('unlock_game') ? 'Purchase restored.' : 'No earlier purchase found.'; MN.dropLayout(); }).catch(() => { G.restoreMsg = 'Could not reach the store.'; MN.dropLayout(); }); }
    else if (id === 'back') { go('title'); G.restoreMsg = ''; }
    G.thinkSec = THINK_STEPS[st.thinkIdx];
    MN.dropLayout(); saveSettings();
  }
  function handleResult(id) {
    if (!id) return;
    sfx.tick();
    if (id === 'again') startMatch(G.setup.lastMode === 'watch' ? 'watch' : 'play');
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
    } else { G.ui.scroll = 0; MN.dropLayout(); }
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
    if (id === 'resume') { G.paused = false; G.pauseMenu = false; ctl.reset(); }
    else if (id === 'p-rules') { G.back = 'play'; G.pagesKey = 'rules'; go('rules'); }
    else if (id === 'p-howto') { G.back = 'play'; G.pagesKey = 'howto'; go('howto'); }
    else if (id === 'p-role') { G.back = 'play'; G.pagesKey = `role:${G.setup.role}`; go('roleguide'); }
    else if (id === 'p-sound') { G.settings.sound = !G.settings.sound; audio.setMuted?.(!G.settings.sound); saveSettings(); MN.dropLayout(); }
    else if (id === 'p-txt-dec') { G.settings.textIdx = Math.max(0, G.settings.textIdx - 1); G.ui.scroll = 0; saveSettings(); MN.dropLayout(); }
    else if (id === 'p-txt-inc') { G.settings.textIdx = Math.min(TEXT_SCALES.length - 1, G.settings.textIdx + 1); G.ui.scroll = 0; saveSettings(); MN.dropLayout(); }
    else if (id === 'quit') leaveMatch();
  }
  const pagesList = () => {
    if (G.scene === 'rules') return [RULES, 'Rules'];
    if (G.scene === 'howto') return [HOWTO, 'How to Play'];
    if (G.scene === 'about') return [aboutList, 'About'];
    const r = (G.pagesKey || 'role:ST').slice(5);
    return [ROLE_GUIDE[r] || ROLE_GUIDE.ST, 'Role guide'];
  };
  const updatePages = (input) => {
    const ptr = input.pointer, keys = input.keys;
    const dm = MN.docMeta();
    const close = () => { G.scene = G.back === 'play' ? 'play' : G.back === 'setup' ? 'setup' : 'title'; G.page = 0; G.ui.scroll = 0; G.ui.drag = null; MN.dropLayout(); };
    const down = () => { if (G.ui.scroll >= dm.max - 2) close(); else G.ui.scroll = clamp(G.ui.scroll + dm.step, 0, dm.max); };
    const up = () => { if (G.ui.scroll <= 2) close(); else G.ui.scroll = clamp(G.ui.scroll - dm.step, 0, dm.max); };
    if (ptr.pressed) {
      if (inRect(REF_NEXT, ptr.x, ptr.y)) down();
      else if (inRect(REF_BACK, ptr.x, ptr.y)) up();
      else if (inRect(TEXT_DEC, ptr.x, ptr.y)) { G.settings.textIdx = Math.max(0, G.settings.textIdx - 1); G.ui.scroll = 0; saveSettings(); }
      else if (inRect(TEXT_INC, ptr.x, ptr.y)) { G.settings.textIdx = Math.min(TEXT_SCALES.length - 1, G.settings.textIdx + 1); G.ui.scroll = 0; saveSettings(); }
      else if (ptr.y >= dm.top - 10 && ptr.y <= dm.bottom + 10) G.ui.drag = { y0: ptr.y, s0: G.ui.scroll, v: 0, ly: ptr.y };
    }
    // drag / swipe anywhere on the page, with a little momentum after the finger lifts
    const d = G.ui.drag;
    if (d && ptr.down) { const ny = clamp(d.s0 - (ptr.y - d.y0), 0, dm.max); d.v = (ny - G.ui.scroll) * 0.6 + d.v * 0.4; G.ui.scroll = ny; }
    if (d && ptr.released) { G.ui.drag = null; G.ui.vel = Math.abs(d.v) > 3 ? d.v * 60 : 0; }
    const before = G.ui.scroll; G.ui.scroll = scrollKeys(input, G.ui.scroll, dm.max, dm.step); if (G.ui.scroll !== before) G.ui.vel = 0;
    if (!G.ui.drag && G.ui.vel) { G.ui.scroll = clamp(G.ui.scroll + G.ui.vel * (1 / 60), 0, dm.max); G.ui.vel *= 0.92; if (Math.abs(G.ui.vel) < 12) G.ui.vel = 0; }
    if (keys.pressed.has('ArrowRight')) down();
    if (keys.pressed.has('ArrowLeft')) up();
    if (keys.pressed.has('Escape')) close();
  };
  const updateSetup = (dt, input) => {
    const ptr = input.pointer, k = input.keys;
    if (k.pressed.has('Enter')) { handleSetup('start'); return; }
    if (k.pressed.has('Escape')) { handleSetup('back'); return; }
    if (ptr.pressed && (inRect(SETUP_PINS.start, ptr.x, ptr.y) || inRect(SETUP_PINS.back, ptr.x, ptr.y))) { handleSetup(inRect(SETUP_PINS.start, ptr.x, ptr.y) ? 'start' : 'back'); return; }
    updateFlowScene(dt, input, handleSetup, 'setup');
  };

  function startup() { if (config.shot) startShot(); else startDemoBg(); }
  startup();

  return {
    // Menus, Rules, About, settings, Learn, Watch & Learn and pauses are free: only real play of a match counts against the preview.
    isPreviewExempt: () => !(G.scene === 'play' && G.mode === 'play') || G.paused || G.pauseMenu || !!G.think || !S || S.s.over || S.s.phase !== 'play',
    update(dt, input) {
      setPress(input.pointer);
      G.t += dt;
      for (let i = delayed.length - 1; i >= 0; i--) { delayed[i].t -= dt; if (delayed[i].t <= 0) { delayed[i].f(); delayed.splice(i, 1); } }
      if (G.scene !== 'play' && S) { S.update(dt); S.setInput(null); }
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
        case 'howto': case 'about': case 'rules': case 'roleguide': updatePages(input); break;
        case 'play': updatePlay(dt, input); break;
        default: break;
      }
    },
    render(ctx, view) {
      G.viewW = (view && view.cssW) || 720; G.viewH = (view && view.cssH) || 1280;
      ctx.clearRect(0, 0, W, H);
      G.noGL = !!(view && view.noGL); MN.setNoGL(G.noGL);
      if (G.noGL && S) renderFallback(ctx, G);
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
        case 'howto': case 'about': case 'rules': case 'roleguide': { const [list, header] = pagesList(); MN.renderPages(ctx, G, list, header); break; }
        case 'play': {
          renderHud(ctx, G, view);
          const lay = G.lay;
          if (G.think) renderThinkBox(ctx, G, lay);
          if (G.mode === 'watch' && S.s.hold) renderHold(ctx, G, lay);
          if (G.pauseMenu) MN.renderPause(ctx, G);
          break;
        }
        default: break;
      }
    },
    getState: () => G,
    autoPause: () => { if (G.scene === 'play' && G.mode === 'watch') G.watch.paused = true; if (G.scene === 'play' && G.mode === 'play' && !G.pauseMenu && !G.think && S && !S.s.over) { G.paused = true; G.pauseMenu = true; G.ui.scroll = 0; MN.dropLayout(); persistMatch(); ctl.reset(); } },
  };
}

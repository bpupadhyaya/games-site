// Chogan: the game shell. Scenes, input (two thumbs), persistence, preview wiring, Learn, Watch & Learn and the Think hint.
// The match itself lives in sim.js (pure, fixed 60 Hz); the 3D picture lives in view3d/ and only reads the state exposed here.
import { createSim } from './sim.js';
import { live, syncSize, sizeKey, TEXT_SCALES, THINK_STEPS, refLayout, setupPins, inRect, inCircle, playLayout } from './layout.js';
import { rigFor, screenDir } from './camera.js';
import { setPress } from './ui.js';
import { ABOUT, HOWTO, RULES, LESSONS, QUIZ, ROLE_INFO } from './content.js';
import * as MN from './menus.js';
import { renderHud, renderFallback, watchHit, STICK_R } from './hud.js';
import { planShot, positionFor } from './ai.js';
import { drillConfig, startDrill, updateDrill } from './drills.js';
import { clamp, hyp } from './util.js';
import { PERIOD_SECS, PERIODS, REACH, HW, HL } from './consts.js';

// Fluid viewport (kit 1.7): the short side is 720 units, the long side follows the screen. The kit keeps meta.width / meta.height live.
export const meta = { width: 720, height: 1280, fluid: { short: 720 } };
const DEMO_MATCH_CAP = 2;
const SAVE_VERSION = 1;

export function createGame(env) {
  const { rng, audio, storage, config } = env;
  const demo = !!config.demo;
  const G = {
    scene: 'title', mode: 'none', demo, loaded: false,
    settings: { textIdx: 0, sound: true, thinkIdx: 1 },
    setup: { role: 0, opp: 2, lenIdx: 1, watch: false, watchA: 3, lastMode: 'match' },
    ui: { scroll: 0, drag: null }, page: 0, back: 'title', setupMsg: '', restoreMsg: '', roleTut: 0,
    learn: { cur: 0, qi: 0, qscore: 0, done: {}, result: null, order: [0, 1, 2] },
    saved: null, record: { demoMatches: 0 },
    sim: null, paused: false, pauseMenu: false, think: null, thinkRects: null, drill: null,
    watch: { phase: 'think', timer: 0, paused: false, holdId: -1 }, t: 0, aimDir: 0,
    c: { stick: null, swing: false, hookEdge: false, sprintOn: false, bind: {}, kbSwing: false, out: { sx: 0, sz: 0, sprint: false, swing: false, hook: false } },
  };
  let aboutList = ABOUT;
  if (typeof fetch === 'function') {
    fetch('./vendor3d/LICENSES.md').then((r) => (r.status >= 400 ? '' : r.text())).then((t) => {
      const paras = String(t).split(/\n\s*\n/).map((x) => x.replace(/^#+\s*/gm, '').replace(/\s*\n\s*/g, ' ').trim()).filter((x) => x && !/fetch\(|keep it as is|LICENSES\.md/.test(x));
      if (paras.length) aboutList = [...ABOUT, { title: 'Credits and licences', p: paras }];
    }).catch(() => {});
  }
  let S = null, evSeen = 0, simRng = rng.fork(), snap = null, lastSize = '';

  // ---- persistence ----------------------------------------------------------------------------------------------------
  const saveSettings = () => { storage.set('settings', G.settings); storage.set('learn', { done: G.learn.done }); storage.set('record', G.record); storage.set('setup', { role: G.setup.role, opp: G.setup.opp, lenIdx: G.setup.lenIdx }); };
  const metaOfSave = (d) => ({ role: d.role, period: d.snap.period, score: [...d.snap.score] });
  const validSave = (d) => d && d.v === SAVE_VERSION && d.snap && Array.isArray(d.snap.score) && d.snap.period >= 1 && d.snap.period <= PERIODS && d.role >= 0 && d.role < 3;
  const persistMatch = () => {
    if (!S || G.mode !== 'match' || S.s.over) return;
    const d = { v: SAVE_VERSION, role: G.setup.role, opp: G.setup.opp, lenIdx: G.setup.lenIdx, snap: S.snapshot() };
    snap = d; G.saved = metaOfSave(d); storage.set('match', d);
  };
  const clearSave = () => { snap = null; G.saved = null; storage.remove('match'); };
  Promise.all([storage.get('settings', null), storage.get('learn', null), storage.get('record', null), storage.get('match', null), storage.get('setup', null)]).then(([s, l, r, mch, su]) => {
    if (s) Object.assign(G.settings, s);
    if (l && l.done) G.learn.done = l.done;
    if (r) Object.assign(G.record, r);
    if (su) { G.setup.role = clamp(su.role | 0, 0, 2); G.setup.opp = clamp(su.opp | 0, 1, 5); G.setup.lenIdx = clamp(su.lenIdx | 0, 0, 2); }
    if (validSave(mch)) { snap = mch; G.saved = metaOfSave(mch); }
    G.settings.textIdx = clamp(G.settings.textIdx | 0, 0, TEXT_SCALES.length - 1);
    G.settings.thinkIdx = clamp(G.settings.thinkIdx | 0, 0, THINK_STEPS.length - 1);
    G.loaded = true;
    MN.invalidateLayout();
    audio.setMuted?.(!G.settings.sound);
  });

  // ---- sound -----------------------------------------------------------------------------------------------------------
  const tone = (o) => { if (G.settings.sound) audio.tone(o); };
  const sfx = {
    tick: () => tone({ freq: 760, dur: 0.04, type: 'triangle', vol: 0.05 }),
    hit: (q) => { tone({ freq: 240 + q * 120, to: 90, dur: 0.1, type: 'triangle', vol: 0.2 }); tone({ freq: 1400, to: 400, dur: 0.05, type: 'square', vol: 0.03 }); },
    swish: () => tone({ freq: 900, to: 300, dur: 0.12, type: 'sawtooth', vol: 0.025 }),
    bounce: (p) => tone({ freq: 180 + p * 80, to: 100, dur: 0.08, type: 'sine', vol: 0.08 }),
    board: () => tone({ freq: 130, to: 70, dur: 0.12, type: 'triangle', vol: 0.12 }),
    goal: () => [0, 4, 7, 12].forEach((n, i) => tone({ freq: 523 * Math.pow(2, n / 12), dur: 0.22 + i * 0.04, type: 'triangle', vol: 0.09 })),
    whistle: () => tone({ freq: 2400, to: 2100, dur: 0.28, type: 'sine', vol: 0.05 }),
    hook: () => tone({ freq: 330, to: 160, dur: 0.1, type: 'square', vol: 0.05 }),
  };

  // ---- match lifecycle -----------------------------------------------------------------------------------------------
  const setSim = (sim) => { S = sim; G.sim = sim.s; evSeen = sim.s.evId; G.think = null; G.endT = 0; };
  const startDemoBg = () => { setSim(createSim({ human: -1, levels: [3, 3], mateLevel: 3, periods: 1, periodSecs: 900 }, simRng.fork())); G.mode = 'none'; G.drill = null; };
  function startMatch(kind, opts = {}) {
    const st = G.setup;
    let cfg;
    if (kind === 'match') {
      if (demo && G.record.demoMatches >= DEMO_MATCH_CAP) { G.scene = 'demolimit'; G.ui.scroll = 0; MN.invalidateLayout(); return; }
      cfg = { human: st.role, levels: [3, st.opp], mateLevel: 3, periods: demo ? 2 : PERIODS, periodSecs: demo ? 60 : PERIOD_SECS[st.lenIdx] };
    } else if (kind === 'watch') {
      cfg = { human: -1, levels: [st.watchA, st.opp], mateLevel: st.watchA, periods: 2, periodSecs: 60, watch: true };
    } else cfg = drillConfig(opts.drill);
    G.mode = kind; G.setup.lastMode = kind;
    setSim(createSim(cfg, simRng.fork()));
    if (opts.resume) S.restore(opts.resume);
    G.drill = null; G.c.swing = false; G.c.stick = null; G.c.bind = {};
    G.scene = 'play'; G.paused = !!opts.paused; G.pauseMenu = !!opts.paused; G.ui.scroll = 0; G.think = null;
    G.watch = { phase: 'think', timer: 0, paused: false, holdId: -1 };
    if (kind === 'match') { if (demo && !opts.resume) { G.record.demoMatches++; saveSettings(); } if (!opts.resume) persistMatch(); }
    if (kind === 'drill') G.drill = startDrill(G, S);
    MN.invalidateLayout();
  }
  const resumeMatch = () => {
    if (!snap) return;
    const d = JSON.parse(JSON.stringify(snap));
    G.setup.role = d.role; G.setup.opp = d.opp; G.setup.lenIdx = d.lenIdx;
    startMatch('match', { resume: d.snap, paused: true });
  };
  const leaveMatch = () => { persistMatch(); G.scene = 'title'; G.mode = 'none'; G.paused = false; G.pauseMenu = false; G.think = null; G.ui.scroll = 0; G.drill = null; startDemoBg(); MN.invalidateLayout(); };

  // ---- events: sound, results ------------------------------------------------------------------------------------------
  const delayed = [];
  const later = (f) => delayed.push({ t: 0.35, f });
  function processEvents() {
    const s = S.s;
    for (const e of s.events) {
      if (e.id < evSeen) continue;
      evSeen = e.id + 1;
      if (e.type === 'hit') sfx.hit(e.q || 0.5);
      else if (e.type === 'miss') sfx.swish();
      else if (e.type === 'bounce') sfx.bounce(e.p || 0.5);
      else if (e.type === 'board' || e.type === 'post') sfx.board();
      else if (e.type === 'hook' || e.type === 'hooked') sfx.hook();
      else if (e.type === 'goal') { sfx.whistle(); if (G.mode !== 'drill') later(() => sfx.goal()); }
      else if (e.type === 'foul' || e.type === 'period' || e.type === 'end' || e.type === 'throw') sfx.whistle();
      if ((e.type === 'period' || e.type === 'goal') && G.mode === 'match') persistMatch();
    }
    if (s.phase === 'end' && !G.endT) G.endT = s.t;
    if (s.phase === 'end' && s.t - G.endT > 2.2 && (G.mode === 'match' || G.mode === 'watch')) {
      if (G.mode === 'match') { clearSave(); G.record.matches = (G.record.matches || 0) + 1; if (s.winner === 0) G.record.wins = (G.record.wins || 0) + 1; saveSettings(); }
      G.scene = 'result'; G.ui.scroll = 0; G.endT = 0; MN.invalidateLayout();
    }
  }

  // ---- learn -------------------------------------------------------------------------------------------------------------
  const shuffled3 = () => { const a = [0, 1, 2]; for (let i = 2; i > 0; i--) { const j = Math.floor(rng.next() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  function startLesson() {
    const l = LESSONS[G.learn.cur];
    if (l.quiz) { G.learn.qi = 0; G.learn.qscore = 0; G.learn.order = shuffled3(); G.scene = 'quiz'; G.ui.scroll = 0; MN.invalidateLayout(); return; }
    startMatch('drill', { drill: l.id });
  }
  function finishDrill() {
    const l = LESSONS[G.learn.cur], d = G.drill;
    G.learn.result = { score: d.score, n: l.n, pass: d.score >= l.need };
    if (G.learn.result.pass) { G.learn.done[l.id] = true; saveSettings(); }
    G.scene = 'lessonresult'; G.mode = 'none'; G.drill = null; G.ui.scroll = 0; startDemoBg(); MN.invalidateLayout();
  }

  // ---- Think hint ----------------------------------------------------------------------------------------------------------
  const stub = { next: () => 0.5 };
  function openThink() {
    const s = S.s, me = s.riders.find((r) => r.human);
    if (!me) return;
    const b = s.ball;
    let t;
    if (s.phase === 'throw' || s.phase === 'reset') {
      t = { title: `Get set: ${ROLE_INFO[me.role].name}`, text: ROLE_INFO[me.role].long[0], marker: { x: me.rest.x, z: me.rest.z, label: 'start' } };
    } else {
      const opp = s.riders.find((o) => o.team !== me.team && o.sw.ph === 'wind' && hyp(o.x - me.x, o.z - me.z) < 3.6);
      const loc = S.local(me, b.x, b.z);
      let best = 0;
      const plan = planShot(s, me, stub);
      for (const k of ['R', 'B', 'L']) best = Math.max(best, S.envQ(k, loc.f, (k === 'L' ? -1 : 1) * loc.r, b.y));
      if (opp && me.hook.cool <= 0) t = { title: 'Hook now', text: `A rival is winding up a stroke only ${Math.round(hyp(opp.x - me.x, opp.z - me.z))} m away. Press HOOK to knock his mallet away before he strikes.`, marker: { x: opp.x, z: opp.z, label: 'rival' } };
      else if (best > 0) t = { title: 'Strike now', text: `The ball is in reach (the ring is green). Hold SWING, steer toward the aim marker and let go. ${plan.why}`, aim: { x: plan.ax, z: plan.az, fx: b.x, fz: b.z } };
      else if (s.ai[me.team].chaser === me.id) {
        const sh = Math.sin(plan.ang), ch = Math.cos(plan.ang), E = REACH.R;
        const T = { x: b.x - (ch * E.latI + sh * E.fI), z: b.z - (-sh * E.latI + ch * E.fI) };
        t = { title: 'Ride to the ball', text: `You are the closest to the ball. Ride to the marked spot so the ball ends up on your right, then swing. ${plan.why}`, marker: { x: clamp(T.x, -HW + 1, HW - 1), z: clamp(T.z, -HL + 2, HL - 2), label: 'ride here' }, aim: { x: plan.ax, z: plan.az, fx: b.x, fz: b.z } };
      } else {
        const pf = positionFor(s, me, s.riders.filter((o) => o.team === me.team && o.id !== me.id));
        t = { title: `Position: ${ROLE_INFO[me.role].name}`, text: `${pf.why} A team-mate is closer to the ball and will play it.`, marker: { x: pf.x, z: pf.z, label: 'go here' } };
      }
    }
    G.think = t;
  }

  // ---- Watch & Learn -------------------------------------------------------------------------------------------------------
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

  // ---- controls: two thumbs, with a keyboard and single-pointer fallback ---------------------------------------------------
  const pointersOf = (input) => {
    if (env.touches) return env.touches();
    const p = input.pointer, out = [];
    if (p.down || p.released || p.pressed) out.push({ id: 'mouse', x: p.x, y: p.y, down: p.down, fresh: p.pressed, up: p.released && !p.down });
    return out;
  };
  function readControls(input, L) {
    const Z = L.stickZone, rig = rigFor(G.viewW && G.viewH ? G.viewW / G.viewH : live.w / live.h);
    const c = G.c, keys = input.keys;
    c.hookEdge = false;
    let uiAction = null;
    for (const t of pointersOf(input)) {
      let role = c.bind[t.id];
      if (t.fresh && !role) {
        if (inCircle(L.sw, t.x, t.y, 28)) role = 'swing';
        else if (inCircle(L.hook, t.x, t.y, 22)) { role = 'hook'; c.hookEdge = true; }
        else if (inRect(L.think, t.x, t.y)) { role = 'ui'; uiAction = 'think'; }
        else if (inRect(L.pause, t.x, t.y)) { role = 'ui'; uiAction = 'pause'; }
        else if (inRect(Z, t.x, t.y) && !Object.values(c.bind).includes('stick')) {
          role = 'stick';
          c.stick = { id: t.id, x0: clamp(t.x, Z.x + STICK_R + 14, Z.x + Z.w - STICK_R + 20), y0: clamp(t.y, Z.y + 40, L.yb - STICK_R - 14), dx: 0, dz: 0, mag: 0 };
        } else role = 'none';
        c.bind[t.id] = role;
      }
      if (role === 'stick' && c.stick && c.stick.id === t.id) {
        const vx = (t.x - c.stick.x0) / STICK_R, vy = (t.y - c.stick.y0) / STICK_R;
        const m = Math.hypot(vx, vy), k = m > 1 ? 1 / m : 1;
        c.stick.dx = vx * k; c.stick.dz = -vy * k; c.stick.mag = Math.min(1, m);
      }
      if (t.up || !t.down) { if (role === 'stick') c.stick = null; delete c.bind[t.id]; }
    }
    // drop bindings of fingers that vanished without an 'up' (blur, cancel)
    const live = new Set(pointersOf(input).map((t) => t.id));
    for (const id of Object.keys(c.bind)) if (!live.has(id) && !live.has(+id)) { if (c.bind[id] === 'stick') c.stick = null; delete c.bind[id]; }
    const kd = keys.down;
    c.kbSwing = kd.has('Space') || kd.has('KeyJ');
    c.swing = Object.values(c.bind).includes('swing') || c.kbSwing;
    const kx = (kd.has('ArrowRight') || kd.has('KeyD') ? 1 : 0) - (kd.has('ArrowLeft') || kd.has('KeyA') ? 1 : 0);
    const kz = (kd.has('ArrowUp') || kd.has('KeyW') ? 1 : 0) - (kd.has('ArrowDown') || kd.has('KeyS') ? 1 : 0);
    if (keys.pressed.has('KeyH') || keys.pressed.has('KeyK')) c.hookEdge = true;
    // the stick and the arrow keys are SCREEN directions (right / up); screenDir turns them into field directions for the live camera
    let sx = 0, sz = 0, mag = 0;
    if (c.stick) { const d = screenDir(rig, c.stick.dx, c.stick.dz); sx = d.x; sz = d.z; mag = c.stick.mag; }
    if (kx || kz) { const m = Math.hypot(kx, kz), sp = kd.has('ShiftLeft') || kd.has('ShiftRight'); const d = screenDir(rig, kx / m, kz / m); sx = d.x; sz = d.z; mag = sp ? 1 : 0.8; if (!sp) { sx *= 0.8; sz *= 0.8; } c.sprintOn = sp; }
    else if (mag > 0.93) c.sprintOn = true; else if (mag < 0.85) c.sprintOn = false;
    c.out = { sx, sz, sprint: c.sprintOn, swing: c.swing, hook: c.hookEdge };
    if (hyp(sx, sz) > 0.3) G.aimDir = Math.atan2(sx, sz);
    else { const me = S.s.riders.find((r) => r.human); if (me) G.aimDir = me.h; }
    if (keys.pressed.has('KeyT')) uiAction = 'think';
    if (keys.pressed.has('KeyP') || keys.pressed.has('Escape')) uiAction = 'pause';
    return uiAction;
  }

  // ---- menus -----------------------------------------------------------------------------------------------------------------
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
    const wh = env.wheel ? env.wheel() : 0; if (wh) G.ui.scroll = clamp(G.ui.scroll + wh, 0, max);
    if (input.keys.down.has('ArrowDown')) G.ui.scroll = clamp(G.ui.scroll + 14, 0, max);
    if (input.keys.down.has('ArrowUp')) G.ui.scroll = clamp(G.ui.scroll - 14, 0, max);
  };
  const go = (scene) => { G.scene = scene; G.ui.scroll = 0; G.page = 0; MN.invalidateLayout(); };
  function setText(v) { G.settings.textIdx = clamp(v, 0, TEXT_SCALES.length - 1); G.ui.scroll = 0; MN.invalidateLayout(); saveSettings(); }
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
    else if (id === 'sound') { G.settings.sound = !G.settings.sound; audio.setMuted?.(!G.settings.sound); saveSettings(); MN.invalidateLayout(); }
  }
  function handleSetup(id) {
    if (!id) return;
    const st = G.setup;
    sfx.tick();
    if (id.startsWith('role')) { st.role = +id.slice(4); MN.invalidateLayout(); saveSettings(); }
    else if (id === 'roletut') { G.roleTut = st.role; G.back = 'setup'; go('roletut'); }
    else if (id.startsWith('opp')) { st.opp = +id.slice(3); MN.invalidateLayout(); saveSettings(); }
    else if (id.startsWith('wa')) { st.watchA = +id.slice(2); MN.invalidateLayout(); }
    else if (id.startsWith('len')) { st.lenIdx = +id.slice(3); MN.invalidateLayout(); saveSettings(); }
    else if (id === 'start') {
      if (demo && st.opp > 2 && !st.watch) { G.setupMsg = 'The free demo has the first two rivals.'; return; }
      startMatch(st.watch ? 'watch' : 'match');
    } else if (id === 'back') go('title');
  }
  function handleSettings(id) {
    if (!id) return;
    sfx.tick();
    const st = G.settings;
    if (id === 'set-sound') { st.sound = !st.sound; audio.setMuted?.(!st.sound); }
    else if (id === 'txt-dec') setText(st.textIdx - 1);
    else if (id === 'txt-inc') setText(st.textIdx + 1);
    else if (id === 'think-dec') st.thinkIdx = Math.max(0, st.thinkIdx - 1);
    else if (id === 'think-inc') st.thinkIdx = Math.min(THINK_STEPS.length - 1, st.thinkIdx + 1);
    else if (id === 'restore') { G.restoreMsg = 'Checking...'; env.monetization.restore().then(() => { G.restoreMsg = env.monetization.owns('unlock_game') ? 'Purchase restored.' : 'No earlier purchase found.'; MN.invalidateLayout(); }).catch(() => { G.restoreMsg = 'Could not reach the store.'; MN.invalidateLayout(); }); }
    else if (id === 'back') { go('title'); G.restoreMsg = ''; }
    saveSettings(); MN.invalidateLayout();
  }
  function handleResult(id) {
    if (!id) return;
    sfx.tick();
    if (id === 'again') startMatch(G.setup.lastMode === 'watch' ? 'watch' : 'match');
    else if (id === 'new') { if (G.setup.lastMode === 'watch') startMatch('watch'); else { go('setup'); startDemoBg(); } }
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
    } else { G.learn.order = shuffled3(); G.ui.scroll = 0; MN.invalidateLayout(); }
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
    else if (id === 'p-txt-dec') setText(G.settings.textIdx - 1);
    else if (id === 'p-txt-inc') setText(G.settings.textIdx + 1);
    else if (id === 'quit') leaveMatch();
    MN.invalidateLayout();
  }
  const refList = () => (G.scene === 'howto' ? [HOWTO, 'How to Play'] : G.scene === 'about' ? [aboutList, 'About'] : G.scene === 'rules' ? [RULES, 'Rules'] : [roleTutList(), 'Your role']);
  const refPrepare = () => { const [list, header] = refList(); MN.refPrepare(G, list, header); };
  const roleTutList = () => { const r = ROLE_INFO[G.roleTut]; return [{ title: `${r.num}  ${r.name}`, p: r.long }, { title: 'Controls for every role', p: [HOWTO[1].p[0], HOWTO[2].p[0], HOWTO[3].p[0]] }]; };
  const updatePages = (input) => {
    refPrepare();
    const ptr = input.pointer, keys = input.keys, rm = MN.refMeta(), view = rm.vh, R = refLayout();
    const close = () => { G.scene = G.back === 'play' ? 'play' : G.back === 'setup' ? 'setup' : 'title'; G.page = 0; G.ui.scroll = 0; G.ui.drag = null; MN.invalidateLayout(); };
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
    const wh = env.wheel ? env.wheel() : 0; if (wh) setS(G.ui.scroll + wh);
    if (keys.down.has('ArrowDown')) setS(G.ui.scroll + 16);
    if (keys.down.has('ArrowUp')) setS(G.ui.scroll - 16);
    if (keys.pressed.has('PageDown') || keys.pressed.has('Space')) setS(G.ui.scroll + view * 0.85);
    if (keys.pressed.has('PageUp')) setS(G.ui.scroll - view * 0.85);
    if (keys.pressed.has('End')) setS(rm.max);
    if (keys.pressed.has('Home')) setS(0);
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

  // ---- the play update ----------------------------------------------------------------------------------------------------------
  function openPause() { G.paused = true; G.pauseMenu = true; G.ui.scroll = 0; G.c.stick = null; G.c.bind = {}; persistMatch(); MN.invalidateLayout(); }
  function updatePlay(dt, input) {
    const L = playLayout(G.settings.textIdx);
    if (G.mode === 'shot') { S.update(dt, null); processEvents(); return; }
    if (G.pauseMenu) { MN.ensureLayout(G, 'pause'); updateFlowScene(dt, input, handlePause, null); return; }
    if (G.mode === 'watch') {
      const ptr = input.pointer;
      if (ptr.pressed) {
        const i = watchHit(ptr.x, ptr.y);
        if (i === 0) { G.watch.paused = !G.watch.paused; sfx.tick(); }
        else if (i === 1) { G.settings.thinkIdx = Math.max(0, G.settings.thinkIdx - 1); saveSettings(); }
        else if (i === 2) { G.settings.thinkIdx = Math.min(THINK_STEPS.length - 1, G.settings.thinkIdx + 1); saveSettings(); }
        else if (i === 3) { leaveMatch(); return; }
      }
      if (input.keys.pressed.has('KeyP') || input.keys.pressed.has('Escape')) G.watch.paused = !G.watch.paused;
      if (!updateWatch(dt)) return;
      S.update(dt, null); processEvents(); return;
    }
    const act = readControls(input, L);
    if (G.think) {
      const ptr = input.pointer;
      if ((ptr.pressed && G.thinkRects && inRect(G.thinkRects.close, ptr.x, ptr.y)) || input.keys.pressed.has('Enter')) { G.think = null; sfx.tick(); }
      return;
    }
    if (act === 'pause') { openPause(); return; }
    if (act === 'think') { if (G.mode === 'match') openThink(); else if (G.mode === 'drill') G.think = { title: 'Hint', text: LESSONS[G.learn.cur].intro.join(' '), marker: null }; return; }
    S.update(dt, G.c.out);
    processEvents();
    if (G.mode === 'drill' && G.drill) { updateDrill(G, S); if (G.drill.done) finishDrill(); }
  }

  // ?shot=1 (store screenshots): a real match, played by the computer for the user's rider too, frozen by the screenshot script
  function startShot() {
    G.mode = 'shot'; G.setup.lastMode = 'shot';
    setSim(createSim({ human: 0, levels: [3, 3], mateLevel: 3, periods: 4, periodSecs: 90, autoHuman: true }, simRng.fork()));
    S.s.riders[0].level = 3;
    G.scene = 'play';
  }
  if (config.shot) startShot(); else startDemoBg();

  return {
    // Menus, Rules, About, settings, Learn, Watch & Learn, pause and result screens are free; only real match play counts against the preview.
    isPreviewExempt: () => !(G.scene === 'play' && G.mode === 'match') || G.paused || G.pauseMenu || !!G.think || (S && ['goal', 'break', 'end', 'reset'].includes(S.s.phase)),
    update(dt, input) {
      syncSize(meta.width, meta.height);
      // a rotation or resize: a held finger is released cleanly (the stick, SWING and HOOK re-appear in their new places); the match keeps going
      const sk = sizeKey();
      if (sk !== lastSize) { if (lastSize) { G.c.stick = null; G.c.bind = {}; G.c.swing = false; G.ui.drag = null; MN.invalidateLayout(); } lastSize = sk; }
      setPress(input.pointer);
      G.t += dt;
      for (let i = delayed.length - 1; i >= 0; i--) { delayed[i].t -= dt; if (delayed[i].t <= 0) { delayed[i].f(); delayed.splice(i, 1); } }
      if (G.scene !== 'play') { S.update(dt, null); if (S.s.over && G.mode === 'none') startDemoBg(); }
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
        case 'quiz': updateFlowScene(dt, input, handleQuiz, 'quiz'); break;
        case 'lessonresult': updateFlowScene(dt, input, handleLessonResult, 'lessonresult'); break;
        case 'result': updateFlowScene(dt, input, handleResult, 'result'); break;
        case 'demolimit': updateFlowScene(dt, input, (id) => { if (id === 'menu') go('title'); }, 'demolimit'); break;
        case 'howto': case 'about': case 'rules': case 'roletut': updatePages(input); break;
        case 'play': updatePlay(dt, input); break;
        default: break;
      }
    },
    render(ctx, view) {
      syncSize(meta.width, meta.height);
      G.viewW = (view && view.cssW) || live.w; G.viewH = (view && view.cssH) || live.h; G.vw = live.w; G.vh = live.h;
      ctx.clearRect(0, 0, live.w, live.h);
      G.artRect = null;
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
        case 'roletut': MN.renderPages(ctx, G, roleTutList(), 'Your role'); break;
        case 'play':
          renderHud(ctx, G, S, { cssW: G.viewW, cssH: G.viewH });
          if (G.pauseMenu) MN.renderPause(ctx, G);
          break;
        default: break;
      }
    },
    getState: () => G,
  };
}

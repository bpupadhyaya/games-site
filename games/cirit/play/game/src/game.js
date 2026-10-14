// Cirit: the game shell. Scenes, input (two thumbs), persistence, preview wiring, the Festival Cup, Learn drills, Watch & Learn and Think.
// The match itself lives in sim.js (pure, fixed 60 Hz); the 3D picture lives in view3d/ and only reads the state exposed here.
import { createSim } from './sim.js';
import { live, syncSize, sizeKey, TEXT_SCALES, THINK_STEPS, refLayout, setupPins, inRect, inCircle, playLayout } from './layout.js';
import { rigFor, camTarget, unproject, fromVirtual } from './camera.js';
import { setPress } from './ui.js';
import { ABOUT, HOWTO, RULES, LESSONS, THINK_TIPS } from './content.js';
import * as MN from './menus.js';
import { renderHud, renderFallback, watchHit, proj } from './hud.js';
import { planThrow, incoming } from './ai.js';
import { previewArc } from './ballistics.js';
import { clamp } from './util.js';
import { BOUTS, CUP, LEVELS, LANES, REACH_MAX, COSTUMES } from './consts.js';

// Fluid viewport (kit 1.7): the short side is 720 units, the long side follows the screen. The kit keeps meta.width / meta.height live.
export const meta = { width: 720, height: 1280, fluid: { short: 720 } };
const DEMO_MATCH_CAP = 2;
const SAVE_VERSION = 1;
const laneNear = (x) => { let b = 0; for (let i = 1; i < 3; i++) if (Math.abs(x - LANES[i]) < Math.abs(x - LANES[b])) b = i; return b; };

export function createGame(env) {
  const { rng, audio, storage, config } = env;
  const demo = !!config.demo;
  const G = {
    scene: 'title', mode: 'none', demo, loaded: false,
    settings: { textIdx: 0, sound: true, thinkIdx: 1, guide: 0 },
    setup: { mode: 'cup', opp: 2, boutsIdx: 1, costume: 0, order: [0, 1, 2], practice: 'attack', watchA: 3, lastMode: 'cup' },
    ui: { scroll: 0, drag: null }, page: 0, back: 'title', setupMsg: '', restoreMsg: '',
    learn: { cur: 0, done: {}, result: null },
    cup: { stage: 0, over: false, champion: false },
    saved: null, record: { demoMatches: 0 }, owned: false, restoreBusy: false,
    sim: null, cam: { z: -30, span: 20 }, rig: null, look: { costume: [0, 1], horses: [[0, 1, 2], [2, 1, 0]] }, rivalName: 'Rivals',
    paused: false, pauseMenu: false, think: null, thinkRects: null, drill: null, myRider: null,
    watch: { phase: 'think', timer: 0, paused: false, holdId: -1 }, t: 0, pops: [], banner: null, practiceLabel: '',
    aim: { show: false, lane: 1, z: 0, active: false, out: false }, arc: null, ghost: null,
    c: { thr: 0.6, bind: {}, aim: null, swipe: null, out: {}, kbLead: 0, kbLane: 0 },
  };
  // premium ownership mirrors the kit (restore, purchase, iap.changed): the Settings restore row reads G.owned
  const syncOwned = () => { const o = !!(env.monetization && env.monetization.owns('unlock_game')); if (o !== G.owned) { G.owned = o; MN.invalidateLayout(); } };
  syncOwned();
  if (env.monetization && env.monetization.onChange) env.monetization.onChange(syncOwned);
  let aboutList = ABOUT;
  if (typeof fetch === 'function') {
    fetch('./vendor3d/LICENSES.md').then((r) => (r.status >= 400 ? '' : r.text())).then((t) => {
      const paras = String(t).split(/\n\s*\n/).map((x) => x.replace(/^#+\s*/gm, '').replace(/\s*\n\s*/g, ' ').trim()).filter((x) => x && !/fetch\(|keep it as is|LICENSES\.md/.test(x));
      if (paras.length) aboutList = [...ABOUT, { title: 'Credits and licences', p: paras }];
    }).catch(() => {});
  }
  let S = null, evSeen = 0, simRng = rng.fork(), snap = null, lastSize = '';

  // ---- persistence ----------------------------------------------------------------------------------------------------
  const saveSettings = () => {
    storage.set('settings', G.settings); storage.set('learn', { done: G.learn.done }); storage.set('record', G.record); storage.set('cup', G.cup);
    storage.set('setup', { mode: G.setup.mode, opp: G.setup.opp, boutsIdx: G.setup.boutsIdx, costume: G.setup.costume, order: G.setup.order, practice: G.setup.practice, watchA: G.setup.watchA });
  };
  const validSave = (d) => d && d.v === SAVE_VERSION && d.setup && Array.isArray(d.score) && d.bout >= 0 && d.bout < 10 && (d.mode === 'cup' || d.mode === 'friendly');
  const saveLabel = (d) => `${d.mode === 'cup' ? CUP[Math.min(2, d.cupStage || 0)].name : 'Friendly'} · bout ${d.bout + 1} · ${d.score[0]}-${d.score[1]}`;
  const persistMatch = () => {
    if (!S || (G.mode !== 'cup' && G.mode !== 'friendly') || S.s.over) return;
    const s = S.s;
    const d = { v: SAVE_VERSION, mode: G.mode, setup: { ...G.setup, order: [...G.setup.order] }, cupStage: G.cup.stage, bout: s.bout, score: [...s.score], stats: s.stats };
    snap = d; G.saved = { label: saveLabel(d) }; storage.set('match', d);
  };
  const clearSave = () => { snap = null; G.saved = null; storage.remove('match'); };
  Promise.all([storage.get('settings', null), storage.get('learn', null), storage.get('record', null), storage.get('match', null), storage.get('setup', null), storage.get('cup', null)]).then(([s, l, r, mch, su, cup]) => {
    if (s) Object.assign(G.settings, s);
    if (l && l.done) G.learn.done = l.done;
    if (r) Object.assign(G.record, r);
    if (cup && typeof cup.stage === 'number') G.cup = { stage: clamp(cup.stage | 0, 0, 3), over: !!cup.over, champion: !!cup.champion };
    if (su) {
      G.setup.mode = ['cup', 'friendly', 'practice', 'watch'].includes(su.mode) ? su.mode : 'cup';
      G.setup.opp = clamp(su.opp | 0 || 2, 1, 5); G.setup.boutsIdx = clamp(su.boutsIdx | 0, 0, 2); G.setup.costume = clamp(su.costume | 0, 0, COSTUMES.length - 1);
      if (Array.isArray(su.order) && su.order.length === 3 && [...su.order].sort().join() === '0,1,2') G.setup.order = su.order;
      G.setup.practice = su.practice === 'defend' ? 'defend' : 'attack'; G.setup.watchA = clamp(su.watchA | 0 || 3, 1, 5);
    }
    if (validSave(mch)) { snap = mch; G.saved = { label: saveLabel(mch) }; }
    G.settings.textIdx = clamp(G.settings.textIdx | 0, 0, TEXT_SCALES.length - 1);
    G.settings.thinkIdx = clamp(G.settings.thinkIdx | 0, 0, THINK_STEPS.length - 1);
    G.settings.guide = clamp(G.settings.guide | 0, 0, 2);
    G.loaded = true;
    MN.invalidateLayout();
    audio.setMuted?.(!G.settings.sound);
  });

  // ---- sound -----------------------------------------------------------------------------------------------------------
  const tone = (o) => { if (G.settings.sound) audio.tone(o); };
  const sfx = {
    tick: () => tone({ freq: 760, dur: 0.04, type: 'triangle', vol: 0.05 }),
    whoosh: () => tone({ freq: 700, to: 180, dur: 0.22, type: 'sawtooth', vol: 0.035 }),
    thock: (q) => { tone({ freq: 220 + q * 90, to: 80, dur: 0.12, type: 'triangle', vol: 0.22 }); tone({ freq: 1300, to: 380, dur: 0.05, type: 'square', vol: 0.03 }); },
    bull: () => [0, 4, 7, 12].forEach((n, i) => tone({ freq: 523 * Math.pow(2, n / 12), dur: 0.2 + i * 0.04, type: 'triangle', vol: 0.09 })),
    dodge: () => tone({ freq: 440, to: 880, dur: 0.18, type: 'sine', vol: 0.08 }),
    miss: () => tone({ freq: 260, to: 140, dur: 0.14, type: 'sine', vol: 0.05 }),
    lean: () => tone({ freq: 300, to: 200, dur: 0.1, type: 'triangle', vol: 0.06 }),
    whistle: () => tone({ freq: 2400, to: 2100, dur: 0.28, type: 'sine', vol: 0.05 }),
    win: () => [0, 4, 7, 12, 16].forEach((n, i) => tone({ freq: 392 * Math.pow(2, n / 12), dur: 0.26 + i * 0.03, type: 'triangle', vol: 0.09 })),
  };

  // ---- match lifecycle -----------------------------------------------------------------------------------------------
  const delayed = [];
  const later = (f, t = 0.3) => delayed.push({ t, f });
  const rivalCostume = (c) => (c + 1) % COSTUMES.length;
  const shuffled = () => { const a = [0, 1, 2]; for (let i = 2; i > 0; i--) { const j = Math.floor(simRng.next() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const setSim = (sim) => { S = sim; G.sim = sim.s; evSeen = sim.s.evId; G.think = null; G.endT = 0; G.pops = []; G.banner = null; G.aim.show = false; G.arc = null; };
  const startDemoBg = () => { G.look = { costume: [G.setup.costume, rivalCostume(G.setup.costume)], horses: [[0, 1, 2], [2, 1, 0]] }; setSim(createSim({ human: -1, levels: [3, 3], bouts: 3, lineups: [[0, 1, 2], [2, 1, 0]], first: 0 }, simRng.fork())); G.mode = 'none'; G.drill = null; };
  function startMatch(kind, opts = {}) {
    const st = G.setup;
    let cfg;
    if (kind === 'cup' || kind === 'friendly') {
      if (demo && G.record.demoMatches >= DEMO_MATCH_CAP) { G.scene = 'demolimit'; G.ui.scroll = 0; MN.invalidateLayout(); return; }
      const lvl = kind === 'cup' ? CUP[Math.min(2, G.cup.stage)].lvl : st.opp;
      const bouts = kind === 'cup' ? 3 : demo ? 2 : BOUTS[st.boutsIdx];
      cfg = { human: 0, levels: [3, lvl], bouts, lineups: [[...st.order], opts.resume ? opts.resume.rival : shuffled()], first: kind === 'cup' ? G.cup.stage % 2 : 0 };
      G.rivalName = LEVELS[lvl - 1].name;
      G.look = { costume: [st.costume, rivalCostume(st.costume)], horses: cfg.lineups };
      G.practiceLabel = '';
    } else if (kind === 'watch') {
      cfg = { human: -1, levels: [st.watchA, st.opp], bouts: 2, lineups: [[0, 1, 2], [2, 1, 0]], watch: true };
      G.rivalName = LEVELS[st.opp - 1].name; G.look = { costume: [st.costume, rivalCostume(st.costume)], horses: cfg.lineups }; G.practiceLabel = '';
    } else if (kind === 'practice') {
      cfg = { human: 0, levels: [3, st.opp], bouts: 1, lineups: [[st.order[0], 1, 2], [2, 1, 0]], practice: { mode: st.practice, steady: false } };
      G.rivalName = LEVELS[st.opp - 1].name; G.look = { costume: [st.costume, rivalCostume(st.costume)], horses: cfg.lineups }; G.practiceLabel = st.practice === 'attack' ? 'Practice · chase' : 'Practice · flee';
    } else {
      const l = opts.lesson;
      cfg = { human: 0, levels: [3, l.lvl], bouts: 1, lineups: [[0, 1, 2], [2, 1, 0]], practice: { mode: l.mode, steady: l.id === 'pace' || l.id === 'lead' } };
      G.rivalName = LEVELS[l.lvl - 1].name; G.look = { costume: [st.costume, rivalCostume(st.costume)], horses: cfg.lineups }; G.practiceLabel = l.title;
    }
    G.mode = kind; G.setup.lastMode = kind;
    setSim(createSim(cfg, simRng.fork()));
    if (opts.resume) S.resumeAt(opts.resume.bout, opts.resume.score, opts.resume.stats);
    G.drill = null; G.c.bind = {}; G.c.aim = null; G.c.swipe = null; G.c.thr = 0.62;
    G.scene = 'play'; G.paused = !!opts.paused; G.pauseMenu = !!opts.paused; G.ui.scroll = 0; G.think = null;
    G.watch = { phase: 'think', timer: 0, paused: false, holdId: -1 };
    if ((kind === 'cup' || kind === 'friendly') && demo && !opts.resume) { G.record.demoMatches++; saveSettings(); }
    if (kind === 'drill') G.drill = { id: opts.lesson.id, label: opts.lesson.title, score: 0, need: opts.lesson.need, n: opts.lesson.n, timer: 0, band: opts.lesson.id === 'pace' ? [0.62, 0.84] : null, left: opts.lesson.id === 'pace' ? undefined : opts.lesson.n, done: false };
    snapCam();
    MN.invalidateLayout();
  }
  const resumeMatch = () => {
    if (!snap) return;
    const d = JSON.parse(JSON.stringify(snap));
    Object.assign(G.setup, d.setup);
    G.cup.stage = d.cupStage || 0;
    startMatch(d.mode, { resume: { bout: d.bout, score: d.score, stats: d.stats, rival: shuffled() }, paused: true });
  };
  const leaveMatch = () => { persistMatch(); G.scene = 'title'; G.mode = 'none'; G.paused = false; G.pauseMenu = false; G.think = null; G.ui.scroll = 0; G.drill = null; startDemoBg(); MN.invalidateLayout(); };

  // ---- camera ----------------------------------------------------------------------------------------------------------
  const aspectNow = () => ((G.viewW && G.viewH) ? G.viewW / G.viewH : live.w / live.h);
  const camExt = () => (G.aim.show ? G.aim.z : null);
  function snapCam() { const t = camTarget(S.s, aspectNow()); G.cam.z = t.z; G.cam.span = t.span; }
  function updateCam(dt) {
    if (G.dev && G.dev.cam) { const o = G.dev.cam, s = S.s, r = s.riders[o.rider === undefined || o.rider === 'chaser' ? s.chaser : o.rider === 'runner' ? s.runner : +o.rider]; G.cam.z = r.z + (o.dz || 0); G.cam.span = o.span; G.cam.ly = o.ly; return; }
    const t = camTarget(S.s, aspectNow(), camExt());
    if (live.land) t.z -= S.s.dir * t.span * 0.06;       // the pace bar covers the left edge: keep the riders clear of it
    const kz = 1 - Math.exp(-dt * 5.5), ks = 1 - Math.exp(-dt * 2.5);
    G.cam.z += (t.z - G.cam.z) * kz; G.cam.span += (t.span - G.cam.span) * ks;
  }
  const refreshRig = () => { G.rig = rigFor(aspectNow(), G.cam); };

  // ---- events: sound, popups, results ------------------------------------------------------------------------------------
  const pop = (text, x, y, col, o = {}) => G.pops.push({ text, x, y, col, age: 0, life: o.life || 1.3, sub: o.sub, big: o.big });
  const banner = (text, sub, life = 1.7) => { G.banner = { text, sub, age: 0, life }; };
  function matchDone() {
    const s = S.s;
    if (G.mode === 'cup' || G.mode === 'friendly') {
      clearSave(); G.record.matches = (G.record.matches || 0) + 1; if (s.winner === 0) G.record.wins = (G.record.wins || 0) + 1;
      if (G.mode === 'cup') {
        if (s.winner === 0) { G.cup.stage++; if (G.cup.stage >= 3) { G.cup.over = true; G.cup.champion = true; } }
        else { G.cup.over = true; G.cup.champion = false; }
      }
      saveSettings();
    }
    if (s.winner === 0 && G.mode !== 'watch') later(() => sfx.win(), 0.2);
    G.scene = 'result'; G.ui.scroll = 0; G.endT = 0; MN.invalidateLayout();
  }
  function processEvents() {
    const s = S.s;
    const mine = (e) => G.mode === 'watch' || e.team === 0 || (e.rider !== undefined && s.riders[e.rider] && s.riders[e.rider].team === 0);
    for (const e of s.events) {
      if (e.id < evSeen) continue;
      evSeen = e.id + 1;
      if (e.type === 'release') sfx.whoosh();
      else if (e.type === 'hit') {
        const q = e.q === 'bull' ? 'BULLSEYE' : e.q === 'solid' ? 'HIT' : 'GLANCING';
        const p = proj(G, e.x, 2.4, e.z) || { x: live.w / 2, y: live.h * 0.4 };
        const fromMe = e.team === 0 || G.mode === 'watch';
        const sub = e.style.map((st) => (st === 'fast' ? 'Full gallop' : st === 'long' ? 'Long throw' : 'Streak')).join(' · ');
        pop(`${q} +${e.pts}`, p.x, p.y, fromMe ? '#ffd97a' : '#ff9a8a', { sub, big: e.q === 'bull' });
        sfx.thock(e.q === 'bull' ? 1 : e.q === 'solid' ? 0.6 : 0.3); if (e.q === 'bull') later(() => sfx.bull(), 0.15);
        if (G.drill && e.team === 0 && G.drill.id !== 'pace' && G.drill.id !== 'dodge') G.drill.score++;
      } else if (e.type === 'dodge') {
        const p = proj(G, e.x, 2.4, e.z) || { x: live.w / 2, y: live.h * 0.4 };
        pop(e.lean ? `LEAN DODGE +${e.pts}` : `DODGED +${e.pts}`, p.x, p.y, e.team === 0 || G.mode === 'watch' ? '#7fe8d6' : '#ffb0a0');
        sfx.dodge();
        if (G.drill && G.drill.id === 'dodge' && e.team === 0) G.drill.score++;
      } else if (e.type === 'miss') {
        const p = proj(G, e.x, 2.0, e.z);
        if (p && mine(e)) pop('MISS', p.x, p.y, '#e0d6c4', { life: 0.9 });
        sfx.miss();
      } else if (e.type === 'lean') sfx.lean();
      else if (e.type === 'pass') {
        sfx.whistle();
        const mineC = G.mode === 'watch' ? null : s.riders[s.chaser].team === 0;
        banner(G.mode === 'watch' ? `${s.chaser < 3 ? 'Left' : 'Right'} chases` : mineC ? 'You chase!' : 'You flee!', mineC === null ? null : mineC ? 'Drag the ring ahead of him, release to throw' : 'Leave the red ring: lane, pace or LEAN', 1.9);
      } else if (e.type === 'passEnd') { if (!s.cfg.practice && s.pass === 0) banner('Wheel away!', null, 1.4); }
      else if (e.type === 'boutEnd') { persistMatch(); banner(`Bout over  ${e.score[0]} – ${e.score[1]}`, null, 1.8); sfx.whistle(); }
      else if (e.type === 'end') sfx.whistle();
    }
    if (s.phase === 'end' && !G.endT) G.endT = s.t;
    if (s.phase === 'end' && s.t - G.endT > 2.2 && (G.mode === 'cup' || G.mode === 'friendly' || G.mode === 'watch')) matchDone();
  }

  // ---- drills --------------------------------------------------------------------------------------------------------------
  function startLesson() { startMatch('drill', { lesson: LESSONS[G.learn.cur] }); }
  function finishDrill() {
    const l = LESSONS[G.learn.cur], d = G.drill;
    G.learn.result = { score: l.id === 'pace' ? Math.min(l.need, Math.floor(d.timer)) : d.score, n: l.id === 'pace' ? l.need : l.n, pass: d.score >= l.need };
    if (G.learn.result.pass) { G.learn.done[l.id] = true; saveSettings(); }
    G.scene = 'lessonresult'; G.mode = 'none'; G.drill = null; G.ui.scroll = 0; startDemoBg(); MN.invalidateLayout();
  }
  function updateDrill(dt) {
    const d = G.drill, s = S.s;
    if (!d || d.done) return;
    if (d.id === 'pace') {
      const [a, b] = d.band;
      if (G.c.thr >= a && G.c.thr <= b && s.phase === 'pass') d.timer += dt;
      d.score = Math.floor(d.timer);
      if (d.timer >= d.need || s.t > 90) { d.done = true; finishDrill(); }
      return;
    }
    const thrown = d.id === 'dodge' ? s.stats[1].throws : s.stats[0].throws;
    d.left = Math.max(0, d.n - thrown);
    const flying = s.javs.some((j) => j.state === 'fly') || s.riders.some((r) => r.sw.ph !== 'idle');
    if (d.score >= d.need || (thrown >= d.n && !flying && s.t > 1)) { if (!d.fin) d.fin = s.t; if (s.t - d.fin > 0.9) { d.done = true; finishDrill(); } }
  }

  // ---- hints -----------------------------------------------------------------------------------------------------------------
  function openThink() {
    const s = S.s, me = G.myRider;
    if (!me) return;
    const ch = s.riders[s.chaser], ru = s.riders[s.runner];
    let t;
    if (me.role === 'chase') {
      const p = planThrow(s, ch, ru, 1);
      const gap = s.dir * (ru.z - ch.z);
      if (gap > 16) t = { title: 'Close up first', text: `${THINK_TIPS.close} He is ${gap.toFixed(0)} m ahead now.` };
      else t = { title: 'Throw now', text: `${p.why} ${me.javs} javelin${me.javs === 1 ? '' : 's'} left.`, aim: { z: p.z, lane: p.lane } };
    } else if (me.role === 'run') {
      const th = incoming(s, me);
      if (ch.sw.ph === 'wind' || th) t = { title: 'Incoming', text: `${THINK_TIPS.flee} ${th ? `It reaches you in ${th.t.toFixed(1)} s.` : ''}` };
      else t = { title: 'Keep moving', text: `The rival is ${Math.abs(s.dir * (ru.z - ch.z)).toFixed(0)} m behind. Change lane or pace now and then so he cannot lead you, and keep stamina for the end of the pass.` };
    } else t = { title: 'Get ready', text: 'The riders are coming out. When the pass starts, chase and throw or flee and dodge.' };
    G.think = t;
  }

  // ---- Watch & Learn -------------------------------------------------------------------------------------------------------
  function updateWatch(dt) {
    const s = S.s, w = G.watch;
    if (w.paused) return false;
    if (s.hold && !s.hold.go) {
      if (w.holdId !== s.hold.id) { w.holdId = s.hold.id; w.phase = 'think'; w.timer = THINK_STEPS[G.settings.thinkIdx]; }
      w.timer -= dt;
      if (w.phase === 'think' && w.timer <= 0) { w.phase = 'reveal'; w.timer = 2; }
      else if (w.phase === 'reveal' && w.timer <= 0) { w.phase = 'act'; S.release(); return true; }
      return false;
    }
    return true;
  }

  // ---- controls: two thumbs, with keyboard and single-pointer fallbacks -------------------------------------------------------
  const pointersOf = (input) => {
    if (env.touches) return env.touches();
    const p = input.pointer, out = [];
    if (p.down || p.released || p.pressed) out.push({ id: 'mouse', x: p.x, y: p.y, down: p.down, fresh: p.pressed, up: p.released && !p.down });
    return out;
  };
  const toGround = (vx, vy) => {
    const W = G.viewW || 720, H = G.viewH || 1280;
    if (!G.rig) return null;
    const c = fromVirtual(vx, vy, W, H, live.w, live.h);
    return unproject(G.rig, W, H, c.u, c.v, 0);
  };
  function defaultAim(s, ch, ru) {
    const q = G.settings.guide === 0 ? 1 : 0;
    const p = planThrow(s, ch, ru, q);
    return { z: p.z, lane: p.lane };
  }
  function readControls(input, L, dt) {
    const s = S.s, c = G.c, keys = input.keys, me = G.myRider;
    const out = { thr: c.thr, laneStep: 0, lean: false, throw: null };
    let uiAction = null;
    const role = me ? me.role : 'idle';
    const ch = s.riders[s.chaser], ru = s.riders[s.runner];
    const canAim = role === 'chase' && s.phase === 'pass' && me.javs > 0 && me.sw.ph === 'idle';
    const def = role === 'chase' ? defaultAim(s, ch, ru) : null;
    const pts = pointersOf(input);
    for (const t of pts) {
      let r = c.bind[t.id];
      if (t.fresh && !r) {
        if (inRect(L.pause, t.x, t.y)) { r = 'ui'; uiAction = 'pause'; }
        else if (inRect(L.think, t.x, t.y)) { r = 'ui'; uiAction = 'think'; }
        else if (role === 'run' && inCircle(L.lean, t.x, t.y, 24)) { r = 'lean'; out.lean = true; }
        else if (inRect(L.trackZone, t.x, t.y)) r = 'pace';
        else if (inRect(L.aimZone, t.x, t.y)) {
          r = role === 'chase' ? 'aim' : 'swipe';
          if (r === 'aim') c.aim = { id: t.id, x0: t.x, y0: t.y, dx: 0, dz: 0, t0: G.t };
          else c.swipe = { id: t.id, y0: t.y, x0: t.x, t0: G.t, moved: 0 };
        } else r = 'none';
        c.bind[t.id] = r;
      }
      if (r === 'pace') c.thr = clamp(1 - (t.y - L.track.y) / L.track.h, 0, 1);
      if (r === 'aim' && c.aim && c.aim.id === t.id && def) {
        // the ring follows the finger: its screen position is the default ring's position plus the finger's travel
        const s0 = proj(G, LANES[def.lane], 0.03, def.z);
        if (s0) {
          const p0 = toGround(s0.x, s0.y), p1 = toGround(s0.x + (t.x - c.aim.x0), s0.y + (t.y - c.aim.y0));
          if (p0 && p1) { c.aim.dx = p1.x - p0.x; c.aim.dz = p1.z - p0.z; }
        }
        c.aim.cancel = t.y > L.yb - 60;
      }
      if (r === 'swipe' && c.swipe && c.swipe.id === t.id) {
        const dy = t.y - c.swipe.y0;
        c.swipe.moved = Math.max(c.swipe.moved, Math.abs(dy), Math.abs(t.x - c.swipe.x0));
        if (Math.abs(dy) >= 56) { out.laneStep = dy < 0 ? -1 : 1; c.swipe.y0 = t.y; c.swipe.stepped = true; }
      }
      if (t.up || !t.down) {
        if (r === 'aim' && c.aim && c.aim.id === t.id) {
          if (canAim && !c.aim.cancel && def) {
            const x = LANES[def.lane] + c.aim.dx;
            out.throw = { z: def.z + c.aim.dz, lane: laneNear(x) };
            if (s.dir * (ru.z - ch.z) > REACH_MAX) { out.throw = null; pop('Too far', live.w / 2, live.h * 0.4, '#e0d6c4', { life: 0.8 }); }
          }
          c.aim = null;
        }
        if (r === 'swipe' && c.swipe && c.swipe.id === t.id) {
          if (!c.swipe.stepped && c.swipe.moved < 24 && G.t - c.swipe.t0 < 0.45) out.lean = true;
          c.swipe = null;
        }
        delete c.bind[t.id];
      }
    }
    const alive = new Set(pts.map((t) => t.id));
    for (const id of Object.keys(c.bind)) if (!alive.has(id) && !alive.has(+id)) { if (c.bind[id] === 'aim') c.aim = null; if (c.bind[id] === 'swipe') c.swipe = null; delete c.bind[id]; }
    // keyboard
    const kd = keys.down, kp = keys.pressed;
    if (kd.has('KeyW') || kd.has('ShiftLeft') || kd.has('ShiftRight')) c.thr = clamp(c.thr + dt * 0.9, 0, 1);
    if (kd.has('KeyS') || kd.has('ControlLeft') || kd.has('ControlRight')) c.thr = clamp(c.thr - dt * 0.9, 0, 1);
    if (role === 'chase') {
      if (kp.has('ArrowUp')) c.kbLane = clamp((c.kbLane || 0) - 1, -2, 2);
      if (kp.has('ArrowDown')) c.kbLane = clamp((c.kbLane || 0) + 1, -2, 2);
      if (kd.has('ArrowRight')) c.kbLead += 9 * dt * s.dir;
      if (kd.has('ArrowLeft')) c.kbLead -= 9 * dt * s.dir;
      if (kp.has('Space') && canAim && def) {
        out.throw = { z: def.z + c.kbLead, lane: clamp(def.lane + c.kbLane, 0, 2) }; c.kbLane = 0; c.kbLead = 0;
      }
    } else {
      if (kp.has('ArrowUp')) out.laneStep = -1;
      if (kp.has('ArrowDown')) out.laneStep = 1;
      if (kp.has('Space')) out.lean = true;
    }
    if (kp.has('KeyT')) uiAction = 'think';
    if (kp.has('KeyP') || kp.has('Escape')) uiAction = 'pause';
    out.thr = c.thr;
    // the aim ring state for the HUD
    G.aim.show = !!canAim;
    if (canAim && def) {
      let dx = 0, dz = 0, active = false;
      if (c.aim && !c.aim.cancel) { dx = c.aim.dx; dz = c.aim.dz; active = true; }
      else if (!c.aim) { dz = c.kbLead; dx = (c.kbLane || 0) * 2.6; }
      const x = LANES[def.lane] + dx;
      G.aim.lane = laneNear(x); G.aim.z = def.z + dz; G.aim.active = active;
      G.aim.out = s.dir * (ru.z - ch.z) > REACH_MAX;
      G.arc = G.settings.guide < 2 ? previewArc(s, ch, { z: G.aim.z, lane: G.aim.lane }) : null;
      G.ghost = G.settings.guide === 0 ? def : null;
    } else { G.arc = null; G.ghost = null; }
    c.out = out;
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
  const openSetup = (mode) => { G.setup.mode = mode; G.setupMsg = ''; if (mode === 'cup' && G.cup.over) G.cup = { stage: 0, over: false, champion: false }; go('setup'); };
  function handleTitle(id) {
    if (!id) return;
    sfx.tick();
    if (id === 'continue') resumeMatch();
    else if (id === 'cup') openSetup('cup');
    else if (id === 'friendly') openSetup('friendly');
    else if (id === 'practice') openSetup('practice');
    else if (id === 'watch') openSetup('watch');
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
    if (id.startsWith('cos')) { st.costume = +id.slice(3); G.look = { costume: [st.costume, rivalCostume(st.costume)], horses: G.look.horses }; MN.invalidateLayout(); saveSettings(); }
    else if (id.startsWith('ord')) { const k = +id.slice(3), a = st.order; if (k > 0) [a[k - 1], a[k]] = [a[k], a[k - 1]]; else a.push(a.shift()); MN.invalidateLayout(); saveSettings(); }
    else if (id.startsWith('hor')) { const i = +id.slice(3); st.order = [i, ...[0, 1, 2].filter((x) => x !== i)]; MN.invalidateLayout(); saveSettings(); }
    else if (id.startsWith('opp')) { st.opp = +id.slice(3); MN.invalidateLayout(); saveSettings(); }
    else if (id.startsWith('wa')) { st.watchA = +id.slice(2); MN.invalidateLayout(); }
    else if (id.startsWith('len')) { st.boutsIdx = +id.slice(3); MN.invalidateLayout(); saveSettings(); }
    else if (id === 'pr-attack') { st.practice = 'attack'; MN.invalidateLayout(); saveSettings(); }
    else if (id === 'pr-defend') { st.practice = 'defend'; MN.invalidateLayout(); saveSettings(); }
    else if (id === 'start') {
      if (demo && st.mode === 'friendly' && st.opp > 2) { G.setupMsg = 'The free demo has the first two rivals.'; return; }
      startMatch(st.mode);
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
    else if (id === 'restore' && !G.restoreBusy) {
      G.restoreBusy = true; G.restoreMsg = 'Checking with the store...';
      env.monetization.restore().then(() => { G.restoreMsg = env.monetization.owns('unlock_game') ? 'Purchase restored.' : 'No earlier purchase found.'; })
        .catch(() => { G.restoreMsg = 'Could not reach the store. Try again later.'; })
        .then(() => { G.restoreBusy = false; G.owned = !!env.monetization.owns('unlock_game'); MN.invalidateLayout(); });
    }
    else if (id === 'back') { go('title'); G.restoreMsg = ''; }
    saveSettings(); MN.invalidateLayout();
  }
  function handleResult(id) {
    if (!id) return;
    sfx.tick();
    const m = G.setup.lastMode;
    if (id === 'next') startMatch('cup');
    else if (id === 'again') { if (m === 'cup') { G.cup = { stage: 0, over: false, champion: false }; saveSettings(); } startMatch(m === 'drill' || m === 'none' || m === 'shot' ? G.setup.mode : m); }
    else if (id === 'new') { openSetup(m === 'watch' || m === 'friendly' || m === 'cup' ? m : G.setup.mode); startDemoBg(); }
    else if (id === 'menu') { go('title'); startDemoBg(); }
  }
  function handleLearn(id) {
    if (!id) return;
    sfx.tick();
    if (id === 'back') go('title');
    else if (id.startsWith('lesson') && id !== 'lesson-go' && id !== 'lesson-back') { G.learn.cur = +id.slice(6); go('lesson'); }
  }
  function handleLesson(id) { if (!id) return; sfx.tick(); if (id === 'lesson-go') startLesson(); else if (id === 'lesson-back') go('learn'); }
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
  const refList = () => (G.scene === 'howto' ? [HOWTO, 'How to Play'] : G.scene === 'about' ? [aboutList, 'About'] : [RULES, 'Rules']);
  const refPrepare = () => { const [list, header] = refList(); MN.refPrepare(G, list, header); };
  const updatePages = (input) => {
    refPrepare();
    const ptr = input.pointer, keys = input.keys, rm = MN.refMeta(), view = rm.vh, R = refLayout();
    const close = () => { G.scene = G.back === 'play' ? 'play' : 'title'; G.page = 0; G.ui.scroll = 0; G.ui.drag = null; MN.invalidateLayout(); };
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
  function openPause() { G.paused = true; G.pauseMenu = true; G.ui.scroll = 0; G.c.bind = {}; G.c.aim = null; G.c.swipe = null; persistMatch(); MN.invalidateLayout(); }
  function updatePlay(dt, input) {
    const L = playLayout(G.settings.textIdx);
    const s = S.s;
    G.myRider = G.mode === 'watch' || G.mode === 'shot' ? null : s.riders[s.act[0]];
    if (G.mode === 'shot') { if (G.dev && G.dev.freeze) return; S.update(dt, null); processEvents(); updateCam(dt); return; }
    if (G.pauseMenu) {
      if (input.keys.pressed.has('Escape') || input.keys.pressed.has('KeyP')) { G.paused = false; G.pauseMenu = false; MN.invalidateLayout(); return; }
      MN.ensureLayout(G, 'pause'); updateFlowScene(dt, input, handlePause, null); return;
    }
    if (G.mode === 'watch') {
      const ptr = input.pointer;
      if (ptr.pressed) {
        const i = watchHit(L, ptr.x, ptr.y);
        if (i === 0) { G.watch.paused = !G.watch.paused; sfx.tick(); }
        else if (i === 1) { G.settings.thinkIdx = Math.max(0, G.settings.thinkIdx - 1); saveSettings(); }
        else if (i === 2) { G.settings.thinkIdx = Math.min(THINK_STEPS.length - 1, G.settings.thinkIdx + 1); saveSettings(); }
        else if (i === 3) { leaveMatch(); return; }
        else if (inRect(L.pause, ptr.x, ptr.y)) { G.watch.paused = !G.watch.paused; sfx.tick(); }
      }
      if (input.keys.pressed.has('KeyP') || input.keys.pressed.has('Escape')) G.watch.paused = !G.watch.paused;
      if (!G.watch.paused) updateCam(dt);
      if (!updateWatch(dt)) return;
      S.update(dt, null); processEvents();
      return;
    }
    const act = readControls(input, L, dt);
    if (G.think) {
      const ptr = input.pointer;
      if ((ptr.pressed && G.thinkRects && inRect(G.thinkRects.close, ptr.x, ptr.y)) || input.keys.pressed.has('Enter') || input.keys.pressed.has('Escape')) { G.think = null; sfx.tick(); }
      return;
    }
    if (act === 'pause') { openPause(); return; }
    if (act === 'think') { openThink(); return; }
    S.update(dt, { 0: G.c.out });
    processEvents();
    updateCam(dt);
    if (G.mode === 'drill' && G.drill) updateDrill(dt);
  }

  // ?shot=1 (store screenshots): a real match, played by the computer for the user's rider too, frozen by the screenshot script
  function startShot() {
    G.mode = 'shot'; G.setup.lastMode = 'shot';
    G.look = { costume: [0, 1], horses: [[0, 1, 2], [2, 1, 0]] };
    setSim(createSim({ human: -1, levels: [4, 4], bouts: 3, lineups: [[0, 1, 2], [2, 1, 0]] }, simRng.fork()));
    G.scene = 'play'; G.rivalName = 'Rivals';
    snapCam();
  }
  if (config.shot) startShot(); else startDemoBg();
  snapCam();
  // developer tools (only with ?dev=1): fast-forward the sim and pin the camera for close-up screenshots
  if (config.dev) {
    G.dev = {
      cam: null, freeze: false,
      to(tick) { while (S.s.tick < tick) S.update(1 / 60, null); processEvents(); snapCam(); },
      skip(n) { for (let i = 0; i < n; i++) S.update(1 / 60, null); processEvents(); if (!G.dev.cam) snapCam(); },
      until(type, max = 3000, delay = 0) { const id0 = S.s.evId; for (let i = 0; i < max; i++) { S.update(1 / 60, null); if (S.s.events.some((e) => e.id >= id0 && e.type === type)) { for (let k = 0; k < delay; k++) S.update(1 / 60, null); break; } } processEvents(); updateCam(1 / 60); return S.s.tick; },
    };
  }

  return {
    // Menus, Rules, About, settings, Learn, Watch & Learn, practice, pause and result screens are free; only real play (cups, friendlies and practice rides) counts against the preview.
    isPreviewExempt: () => !(G.scene === 'play' && (G.mode === 'cup' || G.mode === 'friendly' || G.mode === 'practice')) || G.paused || G.pauseMenu || !!G.think || (S && ['intro', 'wheel', 'outro', 'end', 'reset'].includes(S.s.phase)),
    update(dt, input) {
      syncSize(meta.width, meta.height);
      const sk = sizeKey();
      if (sk !== lastSize) { if (lastSize) { G.c.bind = {}; G.c.aim = null; G.c.swipe = null; G.ui.drag = null; MN.invalidateLayout(); } lastSize = sk; }
      setPress(input.pointer);
      G.t += dt;
      for (let i = delayed.length - 1; i >= 0; i--) { delayed[i].t -= dt; if (delayed[i].t <= 0) { delayed[i].f(); delayed.splice(i, 1); } }
      for (const p of G.pops) p.age += dt;
      G.pops = G.pops.filter((p) => p.age < p.life);
      if (G.banner) { G.banner.age += dt; if (G.banner.age >= G.banner.life) G.banner = null; }
      if (G.scene !== 'play') { S.update(dt, null); updateCam(dt); if (S.s.over && G.mode === 'none') startDemoBg(); }
      refreshRig();
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
      refreshRig();
    },
    render(ctx, view) {
      syncSize(meta.width, meta.height);
      G.viewW = (view && view.cssW) || live.w; G.viewH = (view && view.cssH) || live.h; G.vw = live.w; G.vh = live.h;
      refreshRig();
      ctx.clearRect(0, 0, live.w, live.h);
      if (view && view.noGL) renderFallback(ctx, G, S);
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
        case 'about': MN.renderPages(ctx, G, aboutList, 'About'); break;
        case 'rules': MN.renderPages(ctx, G, RULES, 'Rules'); break;
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

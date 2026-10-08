// Rugby Conversion - the game shell. Scenes, input, persistence, preview wiring, Learn, Watch & Learn, the ladder and the shootout. The kick lives in sim.js.
import { createSim, windAt } from './sim.js';
import { W, H, setSize, TEXT_SCALES, THINK_STEPS, readerLayout, setupPins, inRect, hudLayout, watchLayout, host } from './layout.js';
import { goalXAt } from './camera.js';
import { setPress } from './ui.js';
import { ABOUT, HOWTO, RULES, LESSONS, QUIZ } from './content.js';
import * as MN from './menus.js';
import { renderPlayHud, renderThink, watchHit, hudCam, aimTrack, powerTrack } from './hud.js';
import { advice, decide } from './ai.js';
import { clamp } from './util.js';
import { LEVELS, GROUNDS, RIVALS, RUN_Q, TILTS, SHOOTOUT_KICKS, DEMO_RUN_CAP, AIM_MAX } from './consts.js';

// Fluid viewport (kit 1.7): the short side is 720 units, the long side follows the screen; the kit keeps meta.width / meta.height live.
export const meta = { width: 720, height: 1280, fluid: { short: 720 } };
const D2R = Math.PI / 180;
const WATCH_LEVELS = [1, 4, 8, 6, 11, 14, 3, 9, 13, 17, 2, 12, 16, 7, 19];
const HUMAN_MODES = ['ladder', 'shootout', 'practice', 'lesson'];

export function createGame(env) {
  const { rng, audio, storage, config } = env;
  const demo = !!config.demo;
  const G = {
    scene: 'title', mode: 'none', demo, loaded: false,
    settings: { textIdx: 0, sound: true, women: false, thinkIdx: 1 },
    ladder: { done: 0, stars: 0, starsOf: new Array(24).fill(0), next: 0 },
    record: { demoRuns: 0, beaten: {}, rivalsBeaten: 0, bestStreak: 0 },
    prac: { d: 30, sx: 0, ws: 4, dir: 2, gust: true },
    ui: { scroll: 0, drag: null, pd: null }, page: 0, back: 'title', restoreMsg: '',
    learn: { cur: 0, qi: 0, qscore: 0, done: {}, result: null },
    S: null, sim: null, sess: null, ground: GROUNDS[1], result: null,
    paused: false, pauseMenu: false, think: null, thinkRects: null, thinkScroll: 0, humanTurn: true,
    watch: { phase: 'think', timer: 0, paused: false, adv: null, dec: null, n: 0 },
    t: 0, viewW: 720, viewH: 1280, lessonTitle: '', sig: '', ai: null, pressX: 0, cam: null, lastSet: { power: 0.7, tilt: 1 }, shotKind: '',
  };
  let aboutList = ABOUT;
  if (typeof fetch === 'function') {
    fetch('./vendor3d/LICENSES.md').then((r) => (r.status >= 400 ? '' : r.text())).then((t) => {
      const paras = String(t).split(/\n\s*\n/).map((x) => x.replace(/^#+\s*/gm, '').replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);
      if (paras.length) aboutList = [...ABOUT, { title: 'Credits and licences', p: paras }];
    }).catch(() => {});
  }
  const simRng = rng.fork(), aiRng = rng.fork(), spotRng = rng.fork();
  let S = null, evSeen = 0;

  // ---- persistence ------------------------------------------------------------------------------------
  const refreshLadder = () => {
    const L = G.ladder; let done = 0; while (done < 24 && L.starsOf[done] > 0) done++;
    L.done = done; L.next = Math.min(23, done); L.stars = L.starsOf.reduce((a, b) => a + b, 0);
  };
  const saveAll = () => { storage.set('settings', G.settings); storage.set('learn', { done: G.learn.done }); storage.set('record', G.record); storage.set('ladder', { starsOf: G.ladder.starsOf }); storage.set('prac', G.prac); };
  Promise.all([storage.get('settings', null), storage.get('learn', null), storage.get('record', null), storage.get('ladder', null), storage.get('prac', null)]).then(([s, l, r, ld, pr]) => {
    if (s) Object.assign(G.settings, s);
    if (l && l.done) G.learn.done = l.done;
    if (r) Object.assign(G.record, r);
    if (ld && Array.isArray(ld.starsOf)) G.ladder.starsOf = ld.starsOf.slice(0, 24).map((v) => clamp(v | 0, 0, 3)).concat(new Array(24).fill(0)).slice(0, 24);
    if (pr) { G.prac.d = clamp(pr.d | 0 || 30, 10, 48); G.prac.sx = clamp(pr.sx | 0, -30, 30); G.prac.ws = clamp(pr.ws | 0, 0, 14); G.prac.dir = clamp(pr.dir | 0, 0, 7); G.prac.gust = !!pr.gust; }
    G.settings.textIdx = clamp(G.settings.textIdx | 0, 0, TEXT_SCALES.length - 1);
    G.settings.thinkIdx = clamp(G.settings.thinkIdx | 0, 0, THINK_STEPS.length - 1);
    refreshLadder();
    G.record.rivalsBeaten = Object.keys(G.record.beaten || {}).length;
    G.loaded = true; G.sig = `l${G.ladder.stars}`;
    audio.setMuted?.(!G.settings.sound);
  });

  // ---- sound ------------------------------------------------------------------------------------------
  const tone = (o) => { if (G.settings.sound) audio.tone(o); };
  let murmurIn = 0;
  // haptics hook: main.js supplies env.haptic(kind, ms) (native shell bridge when present, else vibrate)
  const buzz = (kind, ms) => { if (G.settings.sound && env.haptic) env.haptic(kind, ms); };
  const cheer = (k) => { for (let i = 0; i < 5; i++) tone({ freq: 190 + i * 57, to: 150 + i * 41, dur: 1.0 + 0.7 * k, type: 'sawtooth', vol: 0.014 * k + 0.004 }); };
  const groan = () => { for (let i = 0; i < 3; i++) tone({ freq: 220 - i * 20, to: 120 - i * 10, dur: 0.9, type: 'sawtooth', vol: 0.012 }); };
  const murmur = (dt) => { murmurIn -= dt; if (murmurIn <= 0) { murmurIn = 1.7; for (let i = 0; i < 3; i++) tone({ freq: 130 + i * 41, to: 120 + i * 33, dur: 1.9, type: 'sawtooth', vol: 0.0045 }); } };
  const sfx = {
    tick: () => tone({ freq: 760, dur: 0.04, type: 'triangle', vol: 0.05 }),
    beat: (i) => tone({ freq: 440 + i * 110, dur: 0.07, type: 'triangle', vol: 0.12 }),
    cue: () => tone({ freq: 1040, dur: 0.12, type: 'sine', vol: 0.12 }),
    kick: (v) => { tone({ freq: 150, to: 60, dur: 0.12, type: 'sine', vol: 0.22 }); tone({ freq: 620, to: 220, dur: 0.05, type: 'square', vol: 0.03 * Math.min(1, v / 25) }); },
    clang: () => { tone({ freq: 880, to: 840, dur: 0.5, type: 'triangle', vol: 0.12 }); tone({ freq: 1320, to: 1250, dur: 0.4, type: 'sine', vol: 0.06 }); },
    goal: () => [0, 4, 7, 12].forEach((n, i) => tone({ freq: 523 * Math.pow(2, n / 12), dur: 0.2 + i * 0.05, type: 'triangle', vol: 0.09 })),
    miss: () => tone({ freq: 330, to: 200, dur: 0.3, type: 'triangle', vol: 0.07 }),
    whistle: () => tone({ freq: 2400, to: 2100, dur: 0.25, type: 'sine', vol: 0.05 }),
  };
  function processEvents() {
    for (const e of S.s.events) {
      if (e.id < evSeen) continue;
      evSeen = e.id + 1;
      if (G.scene !== 'play') continue;
      switch (e.type) {
        case 'beat': sfx.beat(e.i); break;
        case 'cue': sfx.cue(); buzz('light', 8); break;
        case 'strike': sfx.kick(e.speed || 25); buzz('medium', 22); break;
        case 'touch': sfx.clang(); buzz('heavy', [30, 40, 30]); break;
        case 'result': if (e.out === 'goal') { buzz('success', [18, 40, 18]); sfx.goal(); cheer(e.close ? 1 : 0.8); } else { sfx.miss(); groan(); } sfx.whistle(); break;
        default: break;
      }
    }
  }

  // ---- a kick -----------------------------------------------------------------------------------------
  const specOf = (l) => ({ sx: l.sx, d: l.d, ws: l.ws, dir: l.dir, gust: l.gust, win: l.win, noise: l.noise });
  function newSim() { S = createSim({ mode: 'practice' }, simRng.fork()); G.S = S; G.sim = S.s; evSeen = 0; }
  function beginKick(spec, who = 'you', keep = true) {
    S.setSpot(spec, who);
    if (keep) { S.s.power = G.lastSet.power; S.s.tilt = G.lastSet.tilt; }
    G.think = null; G.humanTurn = who === 'you' && G.mode !== 'watch'; G.ui.pd = null;
    G.ai = null;
    evSeen = S.s.evId;
  }
  function startDemoBg() { newSim(); S.setSpot({ sx: 6, d: 30, ws: 3, dir: 1.0, gust: 0.1, win: 1.3, noise: 1 }, 'you'); G.mode = 'none'; G.ground = GROUNDS[1]; }

  function guardDemo() {
    if (!demo) return true;
    if (G.record.demoRuns >= DEMO_RUN_CAP) { G.scene = 'demolimit'; G.ui.scroll = 0; return false; }
    G.record.demoRuns++; saveAll(); return true;
  }
  function startLadder(n) {
    if (!guardDemo()) return;
    newSim();
    const l = LEVELS[n - 1];
    G.mode = 'ladder'; G.sess = { kind: 'ladder', level: l, kick: 0, goals: 0, results: [] }; G.ground = GROUNDS[l.tier];
    G.lastSet = { power: 0.7, tilt: 1 };
    beginKick(specOf(l)); G.scene = 'play'; G.paused = false; G.pauseMenu = false; G.ui.scroll = 0;
  }
  function roundSpec(round) {
    const r = spotRng;
    const d = clamp(22 + round * 3 + r.int(8), 20, 44), sx = Math.round(r.range(-14, 14)), ws = Math.round(r.range(1, 8)), dir = (r.int(8) * 45 + (r.chance(0.5) ? 0 : 22)) * D2R;
    return { sx, d, ws, dir, gust: 0.18, win: 1.1, noise: 1 };
  }
  function startShootout(id) {
    if (!guardDemo()) return;
    newSim();
    const rival = RIVALS[id - 1];
    G.mode = 'shootout'; G.sess = { kind: 'shootout', rival, round: 1, turn: 0, score: [0, 0], goals: 0, spec: null, log: [] }; G.ground = GROUNDS[3];
    G.lastSet = { power: 0.7, tilt: 1 };
    G.sess.spec = roundSpec(1);
    beginKick(G.sess.spec, 'you'); G.sess.spec.ph = S.s.wind.ph; G.sess.spec.period = S.s.wind.period;
    G.scene = 'play'; G.paused = false; G.pauseMenu = false; G.ui.scroll = 0;
  }
  function startPractice() {
    if (!guardDemo()) return;
    newSim();
    const p = G.prac;
    G.mode = 'practice'; G.sess = { kind: 'practice', kicks: 0, goals: 0 }; G.ground = GROUNDS[1];
    G.lastSet = { power: 0.7, tilt: 1 };
    beginKick({ sx: p.sx, d: p.d, ws: p.ws, dir: p.dir * 45 * D2R, gust: p.gust ? 0.2 : 0, win: 1.2, noise: 1 });
    G.scene = 'play'; G.paused = false; G.pauseMenu = false; G.ui.scroll = 0;
  }
  function startLesson() {
    const l = LESSONS[G.learn.cur];
    if (l.quiz) { G.learn.qi = 0; G.learn.qscore = 0; G.scene = 'quiz'; G.ui.scroll = 0; return; }
    newSim();
    G.lessonTitle = l.title.replace(/^\d+\. /, '');
    G.mode = 'lesson'; G.sess = { kind: 'lesson', lesson: l, kick: 0, goals: 0, rule: l.rule, ghost: !!l.ghost }; G.ground = GROUNDS[0];
    G.lastSet = { power: 0.7, tilt: 1 };
    beginKick(l.kicks[0]); G.scene = 'play'; G.paused = false; G.pauseMenu = false; G.ui.scroll = 0;
  }
  function startWatch() {
    newSim();
    G.mode = 'watch'; G.sess = { kind: 'watch', n: 0 }; G.ground = GROUNDS[2];
    G.watch = { phase: 'think', timer: 0, paused: false, adv: null, dec: null, n: 0, pressAt: 0 };
    watchNext(); G.scene = 'play'; G.paused = false; G.pauseMenu = false; G.ui.scroll = 0;
  }
  function watchNext() {
    const l = LEVELS[WATCH_LEVELS[G.watch.n % WATCH_LEVELS.length] - 1];
    G.ground = GROUNDS[l.tier];
    beginKick(specOf(l), 'you', false);
    G.humanTurn = false;
    G.watch.adv = null; G.watch.dec = null; G.watch.phase = 'think'; G.watch.n++; G.watchScroll = 0;
  }
  const leave = () => { G.scene = 'title'; G.mode = 'none'; G.paused = false; G.pauseMenu = false; G.think = null; G.ui.scroll = 0; G.sess = null; startDemoBg(); };

  // ---- what happens after a kick ------------------------------------------------------------------------
  function finishLadder() {
    const se = G.sess, pass = se.goals >= se.level.need;
    if (pass) { G.ladder.starsOf[se.level.n - 1] = Math.max(G.ladder.starsOf[se.level.n - 1], se.goals); refreshLadder(); G.sig = `l${G.ladder.stars}`; saveAll(); }
    const n = se.level.n, buttons = [];
    if (pass && n < 24 && !(demo && n >= 3)) buttons.push({ id: 'next', label: `Level ${n + 1}`, primary: true });
    buttons.push({ id: 'again', label: pass ? 'Play again' : 'Try again', primary: !pass || n >= 24 || (demo && n >= 3) });
    buttons.push({ id: 'map', label: 'Ladder', row: 60, dark: true }, { id: 'menu', label: 'Main menu', row: 60, dark: true });
    G.result = { kind: 'ladder', level: n, title: pass ? `Level ${n} cleared` : `Level ${n}: not this time`, stars: se.goals, lines: [`${se.goals} goals from 3 kicks`, `${se.level.d} m · ${GROUNDS[se.level.tier].name}`, pass ? 'Next level is open.' : 'You need 2 goals to move on.'], buttons };
    G.scene = 'result'; G.ui.scroll = 0; G.mode = 'none'; G.sig = `r${n}${se.goals}`;
  }
  function nextShootoutKick() {
    const se = G.sess;
    if (se.turn === 0) {
      // the rival kicks the same spot in the same wind
      se.turn = 1;
      beginKick({ ...se.spec }, 'rival', false);
      G.humanTurn = false;
      G.ai = { t: 0, dec: decide(se.spec, { ws: se.spec.ws, dir: se.spec.dir }, se.rival, aiRng), stage: 0 };
      return;
    }
    // a pair is complete
    se.round++;
    const done = se.round > SHOOTOUT_KICKS && se.score[0] !== se.score[1];
    if (done) { finishShootout(); return; }
    se.turn = 0;
    se.spec = roundSpec(Math.min(se.round, 7));
    beginKick(se.spec, 'you'); se.spec.ph = S.s.wind.ph; se.spec.period = S.s.wind.period;
    G.humanTurn = true;
  }
  function finishShootout() {
    const se = G.sess, win = se.score[0] > se.score[1];
    if (win) {
      G.record.beaten = { ...(G.record.beaten || {}), [se.rival.id]: true };
      G.record.rivalsBeaten = Object.keys(G.record.beaten).length; saveAll();
    }
    const buttons = [{ id: 'again', label: 'Rematch', primary: true }, { id: 'map', label: 'Other rivals', row: 61, dark: true }, { id: 'menu', label: 'Main menu', row: 61, dark: true }];
    G.result = { kind: 'shootout', title: win ? 'You win the shootout!' : `${se.rival.name} wins`, big: `${se.score[0] * 2} – ${se.score[1] * 2}`, lines: [`You ${se.score[0]} goals · ${se.rival.name} ${se.score[1]} goals`, win ? 'Rival beaten.' : 'Take your time with the wind and try again.'], buttons, rivalId: se.rival.id };
    G.scene = 'result'; G.ui.scroll = 0; G.mode = 'none'; G.sig = `s${se.rival.id}${win ? 1 : 0}`;
  }
  function afterKick() {
    const se = G.sess, sh = S.s.shot, goal = !!sh && sh.outcome === 'goal';
    G.lastSet = { power: S.s.power, tilt: S.s.tilt };
    if (G.mode === 'ladder') {
      se.kick++; if (goal) se.goals++;
      if (se.kick >= 3) finishLadder(); else beginKick(specOf(se.level));
    } else if (G.mode === 'practice') {
      se.kicks++; if (goal) se.goals++;
      const sp = S.s.spot, w = S.s.wind;
      beginKick({ sx: sp.sx, d: sp.d, ws: w.ws, dir: w.dir, gust: w.gust, win: S.s.win, noise: S.s.noise, ph: w.ph, period: w.period });
    } else if (G.mode === 'lesson') {
      se.kick++;
      const ok = se.rule === 'strikes' ? sh && (sh.quality === 'perfect' || sh.quality === 'good') : goal;
      if (ok) se.goals++; else if (se.rule === 'strikes') se.goals = 0;
      if (se.kick >= 3) {
        const l = se.lesson;
        G.learn.result = { score: se.goals, n: 3, pass: se.goals >= l.need };
        if (G.learn.result.pass) { G.learn.done[l.id] = true; saveAll(); }
        G.scene = 'lessonresult'; G.ui.scroll = 0; G.mode = 'none'; startDemoBg();
      } else beginKick(l_kick(se, se.kick));
    } else if (G.mode === 'shootout') {
      if (goal) se.score[se.turn]++;
      nextShootoutKick();
    } else if (G.mode === 'watch') { watchNext(); }
  }
  const l_kick = (se, i) => se.lesson.kicks[i];

  // ---- watch & learn ---------------------------------------------------------------------------------------
  function updateWatch(dt) {
    const w = G.watch, s = S.s;
    if (w.paused) return;
    if (s.phase === 'ready') {
      if (!w.adv) {
        w.adv = advice(s.spot, { ws: s.wind.ws, dir: s.wind.dir });
        w.dec = decide(s.spot, { ws: s.wind.ws, dir: s.wind.dir }, { wind: 0.02, time: 0.025 }, aiRng);
        w.dec.e = Math.max(-0.12, w.dec.e);
        w.phase = 'think'; w.timer = THINK_STEPS[G.settings.thinkIdx];
      }
      S.update(dt, {});
      w.timer -= dt;
      if (w.phase === 'think' && w.timer <= 0) { w.phase = 'reveal'; w.timer = 2; S.setAim(w.adv.aimX); S.setPower(w.adv.power); S.setTilt(w.adv.tilt); }
      else if (w.phase === 'reveal' && w.timer <= 0) { w.phase = 'act'; S.startRunup(); w.pressAt = RUN_Q + w.dec.e; }
      processEvents();
      return;
    }
    if (s.phase === 'runup') {
      const c = {};
      if (!s.press && s.runT + dt >= w.pressAt) c.press = true;
      S.update(dt, c);
    } else if (s.phase === 'done') { afterKick(); return; } else S.update(dt, {});
    processEvents();
  }

  // ---- the computer rival's kick ---------------------------------------------------------------------------
  function updateRival(dt) {
    const a = G.ai, s = S.s;
    if (!a) { S.update(dt, {}); return; }
    if (s.phase === 'ready') {
      a.t += dt;
      if (a.stage === 0 && a.t > 1.3) { a.stage = 1; S.setAim(a.dec.aimX); S.setPower(a.dec.power); S.setTilt(a.dec.tilt); }
      if (a.stage === 1 && a.t > 2.4) { a.stage = 2; S.startRunup(); }
      S.update(dt, {});
    } else if (s.phase === 'runup') {
      const c = {}; if (!s.press && s.runT + dt >= a.dec.pressAt) c.press = true;
      S.update(dt, c);
    } else S.update(dt, {});
    processEvents();
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
    if (input.keys.pressed.has('Equal') || input.keys.pressed.has('NumpadAdd')) { G.settings.textIdx = Math.min(TEXT_SCALES.length - 1, G.settings.textIdx + 1); saveAll(); }
    if (input.keys.pressed.has('Minus') || input.keys.pressed.has('NumpadSubtract')) { G.settings.textIdx = Math.max(0, G.settings.textIdx - 1); saveAll(); }
    scrollKeys(input, max, mt.lay ? mt.bottom - mt.top : 1000);
  };
  const go = (scene) => { G.scene = scene; G.ui.scroll = 0; G.page = 0; MN.ensureLayout(G, '-'); };
  function handleTitle(id) {
    if (!id) return;
    sfx.tick();
    if (id === 'ladder') go('ladder');
    else if (id === 'shootout') go('shootout');
    else if (id === 'practice') go('practice');
    else if (id === 'watch') startWatch();
    else if (id === 'learn') go('learn');
    else if (id === 'howto') { G.back = 'title'; go('howto'); }
    else if (id === 'rules') { G.back = 'title'; go('rules'); }
    else if (id === 'about') { G.back = 'title'; go('about'); }
    else if (id === 'settings') go('settings');
    else if (id === 'sound') { G.settings.sound = !G.settings.sound; audio.setMuted?.(!G.settings.sound); saveAll(); }
  }
  function handleLadder(id) {
    if (!id) return;
    sfx.tick();
    if (id === 'back') go('title');
    else if (id.startsWith('lvl')) { const n = +id.slice(3); if (n - 1 <= G.ladder.done && !(demo && n > 3)) startLadder(n); }
  }
  function handleShootout(id) {
    if (!id) return;
    sfx.tick();
    if (id === 'back') go('title');
    else if (id.startsWith('riv')) { const n = +id.slice(3); if (!(demo && n > 1)) startShootout(n); }
  }
  function handlePractice(id) {
    if (!id) return;
    sfx.tick();
    const p = G.prac;
    if (id === 'd-') p.d = Math.max(10, p.d - 2); else if (id === 'd+') p.d = Math.min(48, p.d + 2);
    else if (id === 's-') p.sx = Math.max(-30, p.sx - 3); else if (id === 's+') p.sx = Math.min(30, p.sx + 3);
    else if (id === 'w-') p.ws = Math.max(0, p.ws - 1); else if (id === 'w+') p.ws = Math.min(14, p.ws + 1);
    else if (id === 'a-') p.dir = (p.dir + 7) % 8; else if (id === 'a+') p.dir = (p.dir + 1) % 8;
    else if (id === 'gust') p.gust = !p.gust;
    else if (id === 'start') { saveAll(); startPractice(); return; }
    else if (id === 'back') { go('title'); return; }
    saveAll(); G.sig = `p${p.d}${p.sx}${p.ws}${p.dir}${p.gust}`;
  }
  function handleSettings(id) {
    if (!id) return;
    sfx.tick();
    const st = G.settings;
    if (id === 'set-sound') { st.sound = !st.sound; audio.setMuted?.(!st.sound); }
    else if (id === 'txt-dec') { st.textIdx = Math.max(0, st.textIdx - 1); G.ui.scroll = 0; }
    else if (id === 'txt-inc') { st.textIdx = Math.min(TEXT_SCALES.length - 1, st.textIdx + 1); G.ui.scroll = 0; }
    else if (id === 'set-men') st.women = false;
    else if (id === 'set-women') st.women = true;
    else if (id === 'think-dec') st.thinkIdx = Math.max(0, st.thinkIdx - 1);
    else if (id === 'think-inc') st.thinkIdx = Math.min(THINK_STEPS.length - 1, st.thinkIdx + 1);
    else if (id === 'restore') { G.restoreMsg = 'Checking...'; env.monetization.restore().then(() => { G.restoreMsg = env.monetization.owns('unlock_game') ? 'Purchase restored.' : 'No earlier purchase found.'; }).catch(() => { G.restoreMsg = 'Could not reach the store.'; }); }
    else if (id === 'back') { go('title'); G.restoreMsg = ''; }
    saveAll();
  }
  function handleResult(id) {
    if (!id) return;
    sfx.tick();
    const r = G.result || {};
    if (r.kind === 'ladder') {
      if (id === 'next') startLadder(r.level + 1); else if (id === 'again') startLadder(r.level);
      else if (id === 'map') go('ladder'); else if (id === 'menu') go('title');
    } else if (r.kind === 'shootout') {
      if (id === 'again') startShootout(r.rivalId); else if (id === 'map') go('shootout'); else if (id === 'menu') go('title');
    }
  }
  function handleLearn(id) {
    if (!id) return;
    sfx.tick();
    if (id === 'back') go('title');
    else if (id.startsWith('lesson') && id !== 'lesson-go' && id !== 'lesson-back') { G.learn.cur = +id.slice(6); G.back = 'learn'; go('lesson'); }
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
      if (G.learn.result.pass) { G.learn.done[l.id] = true; saveAll(); }
      go('lessonresult');
    } else G.ui.scroll = 0;
  }
  function handleLessonResult(id) {
    if (!id) return;
    sfx.tick();
    if (id === 'lr-again') startLesson();
    else if (id === 'lr-next') { G.learn.cur = Math.min(LESSONS.length - 1, G.learn.cur + 1); G.back = 'learn'; go('lesson'); }
    else if (id === 'lr-list') go('learn');
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
    else if (id === 'quit') leave();
  }
  const wheel = env.wheel || null;
  const scrollKeys = (input, max, viewH) => {
    const k = input.keys;
    let sc = G.ui.scroll;
    if (k.down.has('ArrowDown')) sc += 14;
    if (k.down.has('ArrowUp')) sc -= 14;
    if (k.pressed.has('PageDown') || k.pressed.has('Space')) sc += viewH * 0.85;
    if (k.pressed.has('PageUp')) sc -= viewH * 0.85;
    if (k.pressed.has('Home')) sc = 0;
    if (k.pressed.has('End')) sc = max;
    if (wheel) sc += wheel.take();
    G.ui.scroll = clamp(sc, 0, max);
  };
  const updatePages = (input) => {
    const ptr = input.pointer, keys = input.keys;
    const list = G.scene === 'howto' ? HOWTO : G.scene === 'about' ? aboutList : RULES;
    MN.ensureDoc(G, list, G.scene === 'howto' ? 'How to Play' : G.scene === 'about' ? 'About' : 'Rules');
    const dm = MN.docMeta(), RL = readerLayout(), V = RL.view;
    const close = () => { G.scene = G.back === 'play' ? 'play' : 'title'; G.page = 0; G.ui.scroll = 0; G.ui.drag = null; };
    const textChanged = () => { G.ui.scroll = 0; saveAll(); };
    if (ptr.pressed) {
      if (inRect(RL.next, ptr.x, ptr.y)) { if (G.ui.scroll >= dm.max - 4) { close(); return; } G.ui.scroll = clamp(G.ui.scroll + dm.viewH * 0.85, 0, dm.max); }
      else if (inRect(RL.back, ptr.x, ptr.y)) { close(); return; }
      else if (inRect(RL.dec, ptr.x, ptr.y)) { G.settings.textIdx = Math.max(0, G.settings.textIdx - 1); textChanged(); }
      else if (inRect(RL.inc, ptr.x, ptr.y)) { G.settings.textIdx = Math.min(TEXT_SCALES.length - 1, G.settings.textIdx + 1); textChanged(); }
      else if (inRect({ x: V.x - 6, y: V.y - 20, w: V.w + 12, h: V.h + 40 }, ptr.x, ptr.y)) G.ui.drag = { y0: ptr.y, s0: G.ui.scroll };
    }
    if (G.ui.drag && ptr.down) G.ui.scroll = clamp(G.ui.drag.s0 - (ptr.y - G.ui.drag.y0), 0, dm.max);
    if (ptr.released) G.ui.drag = null;
    scrollKeys(input, dm.max, dm.viewH);
    if (keys.pressed.has('Escape')) close();
  };
  const updatePractice = (dt, input) => {
    const ptr = input.pointer, k = input.keys;
    if (k.pressed.has('Enter')) { handlePractice('start'); return; }
    if (k.pressed.has('Escape')) { handlePractice('back'); return; }
    const pins = setupPins();
    if (ptr.pressed && (inRect(pins.start, ptr.x, ptr.y) || inRect(pins.back, ptr.x, ptr.y))) { handlePractice(inRect(pins.start, ptr.x, ptr.y) ? 'start' : 'back'); return; }
    updateFlowScene(dt, input, handlePractice, 'practice');
  };

  // ---- the play update -------------------------------------------------------------------------------------
  function openThink() {
    const s = S.s;
    G.think = { adv: advice(s.spot, { ws: s.wind.ws, dir: s.wind.dir }) }; G.thinkScroll = 0;
  }
  const setAimFromPicture = (ptr) => {
    const cam = hudCam(G), d = G.ui.pd;
    S.setAim(clamp(d.aim0 + (goalXAt(cam, ptr.x) - goalXAt(cam, d.x0)), -AIM_MAX, AIM_MAX));
  };
  function updateHuman(dt, input) {
    const ptr = input.pointer, s = S.s, keys = input.keys;
    const lay = hudLayout(G.settings.textIdx, W, H), rw = lay.rows;
    const c = {};
    if (s.phase === 'ready') {
      const doKick = () => { S.startRunup(); G.ui.pd = null; sfx.tick(); };
      if (ptr.pressed) {
        const a = rw.aim, bw = Math.min(a.h, 86);
        if (inRect(lay.pause, ptr.x, ptr.y)) { G.paused = true; G.pauseMenu = true; G.ui.scroll = 0; sfx.tick(); return; }
        if (inRect(lay.think, ptr.x, ptr.y)) { openThink(); sfx.tick(); return; }
        if (inRect(rw.kick, ptr.x, ptr.y)) { doKick(); }
        else if (inRect({ x: a.x, y: a.y, w: bw, h: a.h }, ptr.x, ptr.y)) { S.nudgeAim(-0.25); sfx.tick(); }
        else if (inRect({ x: a.x + a.w - bw, y: a.y, w: bw, h: a.h }, ptr.x, ptr.y)) { S.nudgeAim(0.25); sfx.tick(); }
        else if (inRect(aimTrack(lay), ptr.x, ptr.y)) G.ui.pd = { kind: 'aimT' };
        else if (inRect(rw.power, ptr.x, ptr.y)) G.ui.pd = { kind: 'pow' };
        else if (inRect(rw.tilt, ptr.x, ptr.y)) {
          const gap = 8, bw2 = (rw.tilt.w - 2 * gap) / 3, i = clamp(Math.floor((ptr.x - rw.tilt.x) / (bw2 + gap)), 0, 2);
          S.setTilt(i); sfx.tick();
        } else if (!inRect(lay.panel, ptr.x, ptr.y) && !inRect(lay.wind, ptr.x, ptr.y) && !inRect(lay.spot, ptr.x, ptr.y)) G.ui.pd = { kind: 'pic', x0: ptr.x, aim0: s.aimX };
      }
      if (G.ui.pd && ptr.down) {
        const d = G.ui.pd;
        if (d.kind === 'aimT') { const tr = aimTrack(lay); S.setAim(((clamp((ptr.x - tr.x) / tr.w, 0, 1)) * 2 - 1) * AIM_MAX); }
        else if (d.kind === 'pow') { const tr = powerTrack(lay); S.setPower(0.3 + 0.7 * clamp((ptr.x - tr.x) / tr.w, 0, 1)); }
        else if (d.kind === 'pic') setAimFromPicture(ptr);
      }
      if (ptr.released) G.ui.pd = null;
      const sp = 5 * dt;
      if (keys.down.has('ArrowLeft')) S.setAim(s.aimX - sp);
      if (keys.down.has('ArrowRight')) S.setAim(s.aimX + sp);
      if (keys.pressed.has('ArrowLeft')) S.setAim(s.aimX - 0.2);
      if (keys.pressed.has('ArrowRight')) S.setAim(s.aimX + 0.2);
      if (keys.pressed.has('ArrowUp')) S.setPower(s.power + 0.02);
      if (keys.pressed.has('ArrowDown')) S.setPower(s.power - 0.02);
      if (keys.pressed.has('Digit1')) S.setTilt(0); if (keys.pressed.has('Digit2')) S.setTilt(1); if (keys.pressed.has('Digit3')) S.setTilt(2);
      if (keys.pressed.has('Enter') || keys.pressed.has('Space')) doKick();
      if (keys.pressed.has('KeyT')) { openThink(); return; }
      if (keys.pressed.has('KeyP') || keys.pressed.has('Escape')) { G.paused = true; G.pauseMenu = true; G.ui.scroll = 0; return; }
    } else if (s.phase === 'runup') {
      if (ptr.pressed && !inRect(lay.pause, ptr.x, ptr.y) && !inRect(lay.think, ptr.x, ptr.y)) { c.press = true; G.pressX = ptr.x; c.curl = 0; }
      else if (ptr.pressed && inRect(lay.pause, ptr.x, ptr.y)) { G.paused = true; G.pauseMenu = true; G.ui.scroll = 0; return; }
      if (s.press && ptr.down) c.curl = clamp((ptr.x - G.pressX) / 130, -1, 1);
      if (keys.pressed.has('Space') || keys.pressed.has('ArrowUp') || keys.pressed.has('Enter')) { c.press = true; c.curl = 0; }
      if (s.press && keys.down.has('ArrowLeft')) c.curl = -0.7; if (s.press && keys.down.has('ArrowRight')) c.curl = 0.7;
      if (keys.pressed.has('KeyP') || keys.pressed.has('Escape')) { G.paused = true; G.pauseMenu = true; G.ui.scroll = 0; return; }
    } else if (s.phase === 'result') {
      if (ptr.pressed || keys.pressed.has('Space') || keys.pressed.has('Enter')) S.skip();
    }
    S.update(dt, c);
    processEvents();
    if (S.s.phase === 'done') afterKick();
  }
  function updatePlay(dt, input) {
    const ptr = input.pointer, s = S.s;
    if (G.mode === 'shot') { shotStep(dt); return; }
    if (G.pauseMenu) { MN.ensureLayout(G, 'pause'); updateFlowScene(dt, input, handlePause, null); return; }
    if (G.think) {
      if (ptr.pressed && G.thinkRects && inRect(G.thinkRects.close, ptr.x, ptr.y)) { G.think = null; sfx.tick(); }
      if (input.keys.pressed.has('Enter') || input.keys.pressed.has('Escape')) G.think = null;
      const tv = G.thinkView;
      if (tv) {
        if (ptr.pressed && ptr.y >= tv.top - 10 && ptr.y <= tv.bottom + 10 && !(G.thinkRects && inRect(G.thinkRects.close, ptr.x, ptr.y))) G.ui.tdrag = { y0: ptr.y, s0: G.thinkScroll || 0 };
        if (G.ui.tdrag && ptr.down) G.thinkScroll = clamp(G.ui.tdrag.s0 - (ptr.y - G.ui.tdrag.y0), 0, tv.max);
        if (ptr.released) G.ui.tdrag = null;
        const k = input.keys; let sc = G.thinkScroll || 0;
        if (k.down.has('ArrowDown')) sc += 12; if (k.down.has('ArrowUp')) sc -= 12;
        if (k.pressed.has('PageDown')) sc += tv.vh * 0.85; if (k.pressed.has('PageUp')) sc -= tv.vh * 0.85;
        if (wheel) sc += wheel.take();
        G.thinkScroll = clamp(sc, 0, tv.max);
      }
      return;
    }
    if (G.mode === 'watch') {
      if (ptr.pressed) {
        const i = watchHit(ptr.x, ptr.y, G);
        if (i === 0) { G.watch.paused = !G.watch.paused; sfx.tick(); }
        else if (i === 1) { G.settings.thinkIdx = Math.max(0, G.settings.thinkIdx - 1); saveAll(); }
        else if (i === 2) { G.settings.thinkIdx = Math.min(THINK_STEPS.length - 1, G.settings.thinkIdx + 1); saveAll(); }
        else if (i === 3) { leave(); return; }
      }
      if (input.keys.pressed.has('KeyP') || input.keys.pressed.has('Escape')) G.watch.paused = !G.watch.paused;
      if (ptr.pressed && G.watchRect && inRect(G.watchRect, ptr.x, ptr.y)) G.ui.wd = { y0: ptr.y, s0: G.watchScroll || 0 };
      if (G.ui.wd && ptr.down) G.watchScroll = clamp(G.ui.wd.s0 - (ptr.y - G.ui.wd.y0), 0, G.watchMax || 0);
      if (ptr.released) G.ui.wd = null;
      if (wheel) G.watchScroll = clamp((G.watchScroll || 0) + wheel.take(), 0, G.watchMax || 0);
      updateWatch(dt);
      return;
    }
    if (G.mode === 'shootout' && s.who === 'rival') {
      if (ptr.pressed && inRect(hudLayout(G.settings.textIdx, W, H).pause, ptr.x, ptr.y)) { G.paused = true; G.pauseMenu = true; G.ui.scroll = 0; return; }
      updateRival(dt);
      if (S.s.phase === 'done') afterKick();
      return;
    }
    updateHuman(dt, input);
  }

  // ?shot=1 (store screenshots and dev): a real kick played by the computer, frozen at a chosen moment
  function startShot() {
    const kind = config.shotKind || 'ready';
    G.shotKind = kind;
    const l = LEVELS[((config.seed >>> 0) % 24)];
    newSim(); G.mode = 'shot'; G.ground = GROUNDS[l.tier]; G.sess = { kind: 'shot', level: l, kick: 0, goals: 0 };
    beginKick(specOf(l), 'you', false);
    const dec = decide(l, { ws: l.ws, dir: l.dir }, { wind: 0.02, time: 0.02 }, aiRng);
    S.setAim(dec.aimX); S.setPower(dec.power); S.setTilt(dec.tilt);
    G.shot = { dec, pressAt: RUN_Q, frozen: false };
    G.scene = kind === 'title' ? 'title' : 'play';
  }
  function shotStep(dt) {
    const sh = G.shot, s = S.s;
    if (sh.frozen) return;
    const kind = G.shotKind;
    if (kind === 'ready') { if (s.t > 0.2) sh.frozen = true; S.update(dt, {}); return; }
    if (s.phase === 'ready') { S.update(dt, {}); if (s.t > 0.3) S.startRunup(); return; }
    const c = {}; if (s.phase === 'runup' && !s.press && s.runT + dt >= sh.pressAt) c.press = true;
    S.update(dt, c); processEvents();
    if (kind === 'at' && s.rc >= (config.shotAt || 2)) sh.frozen = true;
    if (kind === 'runup' && s.runT >= 1.95) sh.frozen = true;
    if (kind === 'flight' && s.phase === 'flight' && s.kickT >= 0.8) sh.frozen = true;
    if (kind === 'result' && s.phase === 'result' && s.resultT >= 0.7) sh.frozen = true;
    if (s.phase === 'done') sh.frozen = true;
  }

  let sizeKey = '';
  function syncSize() {
    setSize(meta.width, meta.height);
    { const hl = hudLayout(G.settings.textIdx, W, H); meta.previewBadge = hl.wide ? { x: hl.panel.x - 12, y: host.t + 8, align: 'right' } : { x: hl.pause.x + hl.pause.w, y: hl.pause.y + hl.pause.h + 4, align: 'right' }; }
    const k = `${W}x${H}`;
    if (k !== sizeKey) { if (sizeKey) { G.ui.drag = null; G.ui.tdrag = null; G.ui.pd = null; } sizeKey = k; G.size = k; }
  }
  if (config.dev) G.dev = { startLadder, startShootout, startPractice, startWatch, finishLadder, startLesson };
  syncSize();
  startDemoBg();
  if (config.shot) startShot();
  else if (config.dev && config.devScene) {      // dev only: jump straight to a screen (?scene=rules&tx=4)
    if (config.devText != null) G.settings.textIdx = clamp(config.devText | 0, 0, 4);
    const sc = config.devScene;
    if (sc === 'play') startPractice(); else if (sc === 'shoot1') startShootout(1); else if (sc.startsWith('lesson-')) { G.learn.cur = +sc.slice(7); startLesson(); } else if (sc === 'ladder1') startLadder(1); else if (sc === 'watch') startWatch(); else if (sc === 'pause') { startPractice(); G.paused = true; G.pauseMenu = true; } else if (sc === 'think') { startPractice(); openThink(); }
    else if (sc === 'result') { startLadder(1); G.sess.goals = 3; G.sess.kick = 3; finishLadder(); } else { G.back = 'title'; go(sc); }
  }

  return {
    // Menus, Rules, About, settings, Learn, Watch & Learn, pause, Think and the result screens are free; only real play counts against the preview.
    isPreviewExempt: () => !(G.scene === 'play' && HUMAN_MODES.includes(G.mode) && G.mode !== 'lesson') || G.paused || G.pauseMenu || !!G.think || !S || S.s.phase === 'result' || S.s.phase === 'done' || (G.mode === 'shootout' && S.s.who === 'rival'),
    update(dt, input) {
      syncSize();
      setPress(input.pointer);
      G.t += dt;
      if (G.scene === 'play' && wheel && !G.think && !G.pauseMenu) wheel.take();
      if (G.scene === 'play' && !G.paused && !G.pauseMenu && S && G.mode !== 'none' && !(G.mode === 'watch' && G.watch.paused) && !G.think) murmur(dt);
      if (G.scene !== 'play') S.update(dt, {});
      switch (G.scene) {
        case 'title': {
          const lt = MN.getLockTap(), pp = input.pointer;
          if (lt && pp.pressed && pp.x >= lt.x && pp.x <= lt.x + lt.w && pp.y >= lt.y && pp.y <= lt.y + lt.h) { G.lockDown = G.t + 0.25; env.openArcforgeHome?.(); break; }
          updateFlowScene(dt, input, handleTitle, 'title'); break;
        }
        case 'ladder': updateFlowScene(dt, input, handleLadder, 'ladder'); break;
        case 'shootout': updateFlowScene(dt, input, handleShootout, 'shootout'); break;
        case 'practice': updatePractice(dt, input); break;
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
      syncSize();
      G.viewW = (view && view.cssW) || 720; G.viewH = (view && view.cssH) || 1280;
      ctx.clearRect(0, 0, W, H);
      switch (G.scene) {
        case 'title': if (view && view.noGL) renderTitleFallback(ctx); MN.renderTitle(ctx, G); break;
        case 'ladder': MN.renderLadder(ctx, G); break;
        case 'shootout': MN.renderShootout(ctx, G); break;
        case 'practice': MN.renderPractice(ctx, G); break;
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
          if (!config.nohud) renderPlayHud(ctx, G, view);
          if (G.think) renderThink(ctx, G);
          if (G.pauseMenu) MN.renderPause(ctx, G);
          break;
        default: break;
      }
    },
    autoPause() {
      if (G.scene === 'play' && S && G.mode !== 'watch' && G.mode !== 'shot' && !G.pauseMenu && !G.think) { G.paused = true; G.pauseMenu = true; G.ui.scroll = 0; }
      else if (G.scene === 'play' && G.mode === 'watch') G.watch.paused = true;
    },
    getState: () => G,
  };
  function renderTitleFallback(ctx) { const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#2b5f94'); g.addColorStop(0.5, '#4f8fc0'); g.addColorStop(0.51, '#2f8a4a'); g.addColorStop(1, '#1d5a30'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
}

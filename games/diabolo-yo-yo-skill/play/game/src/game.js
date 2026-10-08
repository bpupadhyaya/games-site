// Spin and String: state and flow. Physics lives in phys.js, tricks / judge / scoring in tricks.js, the playing hand
// (Watch & Learn, Think, the ghost demo) in ai.js, drawing in hud.js / menus.js / art.js, the 3D scene in web/view3d.
// This is the only file that mutates `state`.
//
// Scenes: title, book, play (modes: trick, show, daily, free, watch), result, settings, howto / about / rules, demolimit.
// Hand: press anywhere in the play area and drag; the hand follows the finger relative to where it started, and returns to
// rest when the finger lifts. A quick flick throws, yanks or tosses. Everything the toy does comes from the physics.
import { TEXT_SCALES, THINK_STEPS, ACT_BTN, HINT_BTN, MENU_BTN, WATCH_BAR, REF_BACK, REF_NEXT, TEXT_DEC, TEXT_INC, LAY, relayout, inRect } from './layout.js';
import { createWorld, cloneWorld, stepWorld, setHand, YO, DB } from './phys.js';
import {
  TRICKS, TRICK_BY_ID, TOYS, tricksOf, newJudge, judgeStep, starsFor, trickOpen, totalStars, newShow, showTrick, showDrop, dailyFor, DAILY_DROPS,
} from './tricks.js';
import { newCtl, stepCtl, createPlanner, recordGhost } from './ai.js';
import { makeCam } from './cam.js';
import { renderPlay } from './hud.js';
import { renderTitle, renderBook, renderSettings, renderResult, renderPause, renderPages, renderDemoLimit, hitScreen, flowMeta, READER, refCloseRect, ensureLayout, resetMenus, lockupZone } from './menus.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import { setPress } from './ui.js';

export const wheelInput = { dy: 0 };
export const meta = { width: 720, height: 1280, fluid: { short: 720 } };
const DEMO_OPEN = 3, DEMO_SHOWS = 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const SHOT = (() => { try { return /[?&]shot=/.test(globalThis.location.search); } catch { return false; } })();
const ATTRACT = { yoyo: ['y-sleeper', 'y-walk', 'y-break', 'y-downup'], diabolo: ['d-toss', 'd-pend', 'd-side', 'd-toss'] };
const WHY = { dead: 'Not enough spin to climb back', spin: 'The spin ran out', slipped: 'It slipped off the string', missed: 'Missed the catch', tilt: 'It wobbled: more spin steadies it', floor: 'It hit the floor', stall: 'Out of spin on the way up' };

export function createGame(env) {
  const { rng, audio, storage, config, monetization } = env;
  resetMenus();
  const fx = rng.fork(), aiRng = rng.fork(), runRng = rng.fork();
  void fx;
  const state = {
    scene: 'title', back: 'title', t: 0, clock: 0, paused: false, pauseMenu: false, demo: !!config.demo, mode: 'free', toy: 'yoyo',
    settings: { sound: true, assist: 1, textIdx: 0, thinkIdx: 1, toy: 'yoyo' },
    record: { stars: {}, drops: {}, seen: {}, showBest: { yoyo: 0, diabolo: 0 }, shows: 0, demoShows: 0, daily: { day: 0, best: 0, done: false, streak: 0, last: 0 }, tricks: 0 },
    ui: { scroll: 0, drag: null, focusId: null }, page: 0, bookMsg: '', restoreMsg: '',
    w: createWorld('yoyo', 1), j: newJudge(), trickId: 'y-downup', show: newShow(), daily: null, drops: 0, dropTotal: 0,
    drag: null, tossT: -1, res: null, resT: 0, hint: null, learn: null, watch: null, ghost: null,
    pops: [], toast: '', toastT: 0, flash: 0, camTop: 1.6, thinkSecs: 5, loaded: false, att: null, spinSfx: 0,
  };
  let planner = null, camCache = { key: '', cam: null };

  // ---- persistence ------------------------------------------------------------------------------
  const save = () => { state.record.starTotal = totalStars(state.record); storage.set('settings', state.settings); storage.set('record', state.record); };
  Promise.all([storage.get('settings', null), storage.get('record', null)]).then(([s, r]) => {
    if (SHOT) { state.loaded = true; return; }
    if (s) Object.assign(state.settings, s);
    if (r) {
      Object.assign(state.record, r);
      state.record.stars = { ...(r.stars ?? {}) }; state.record.drops = { ...(r.drops ?? {}) }; state.record.seen = { ...(r.seen ?? {}) };
      state.record.showBest = { yoyo: 0, diabolo: 0, ...(r.showBest ?? {}) }; state.record.daily = { day: 0, best: 0, done: false, streak: 0, last: 0, ...(r.daily ?? {}) };
    }
    state.settings.textIdx = clamp(state.settings.textIdx | 0, 0, TEXT_SCALES.length - 1);
    state.settings.thinkIdx = clamp(state.settings.thinkIdx | 0, 0, THINK_STEPS.length - 1);
    state.settings.assist = clamp(state.settings.assist | 0, 0, 2);
    if (!TOYS.includes(state.settings.toy)) state.settings.toy = 'yoyo';
    state.thinkSecs = THINK_STEPS[state.settings.thinkIdx];
    state.loaded = true;
    audio.setMuted?.(!state.settings.sound);
    if (state.scene === 'title' && state.att && state.att.toy !== state.settings.toy) resetAttract();
  });

  // ---- sound ------------------------------------------------------------------------------------
  const tone = (o) => { if (state.settings.sound) audio.tone(o); };
  const sfx = {
    whirr: (wv) => tone({ freq: 70 + wv * 0.55, to: 66 + wv * 0.55, dur: 0.14, type: 'sawtooth', vol: 0.006 + 0.014 * clamp(wv / 380, 0, 1) }),
    throw: (v) => { tone({ freq: 300, to: 120, dur: 0.22, type: 'sawtooth', vol: 0.035 }); tone({ freq: 90, to: 60, dur: 0.18, type: 'sine', vol: 0.05 * clamp(v / 6, 0.3, 1) }); },
    snap: (v) => { tone({ freq: 1100, to: 380, dur: 0.07, type: 'triangle', vol: 0.05 + 0.05 * clamp(v / 6, 0, 1) }); tone({ freq: 150, to: 70, dur: 0.12, type: 'sine', vol: 0.06 }); },
    bind: () => tone({ freq: 220, to: 900, dur: 0.3, type: 'triangle', vol: 0.04 }),
    catch: (v) => { tone({ freq: 700, to: 420, dur: 0.07, type: 'triangle', vol: 0.07 }); tone({ freq: 170, to: 100, dur: 0.14, type: 'sine', vol: 0.05 + 0.06 * clamp(v / 6, 0, 1) }); },
    toss: () => tone({ freq: 260, to: 840, dur: 0.22, type: 'sawtooth', vol: 0.03 }),
    drop: () => tone({ freq: 330, to: 140, dur: 0.3, type: 'sawtooth', vol: 0.05 }),
    loop: () => tone({ freq: 1200, to: 1500, dur: 0.18, type: 'sine', vol: 0.05 }),
    tick: () => tone({ freq: 900, dur: 0.04, type: 'triangle', vol: 0.05 }),
    chime: (i = 0) => { tone({ freq: 523 * Math.pow(1.26, i), dur: 0.3, type: 'sine', vol: 0.12 }); tone({ freq: 1046 * Math.pow(1.26, i), dur: 0.22, type: 'sine', vol: 0.05 }); },
    win: () => [0, 4, 7, 12].forEach((n, i) => tone({ freq: 440 * Math.pow(2, n / 12), dur: 0.28 + i * 0.05, type: 'triangle', vol: 0.1 })),
  };
  const toast = (text, secs = 2.6) => { state.toast = text; state.toastT = secs; };
  const say = (text, x, y, o = {}) => { state.pops.push({ text, x, y, t: 0, max: o.max ?? 1.4, size: o.size, col: o.col }); if (state.pops.length > 6) state.pops.shift(); };

  // ---- the camera (shared with the 3D presenter through view3d()) -------------------------------
  const playScene = () => state.scene === 'play' || state.scene === 'result';
  const sceneRect = () => (playScene() ? LAY.stage : LAY.sceneRect);
  const getCam = () => {
    const top = Math.round(state.camTop * 20) / 20, toy = playScene() ? state.toy : (state.att ? state.att.toy : state.toy);
    const tight = !playScene() && !LAY.land, key = `${LAY.key}|${toy}|${top}|${playScene()}`;
    if (camCache.key !== key) camCache = { key, cam: makeCam(LAY.W, LAY.H, sceneRect(), toy, playScene() ? top : 1.6, tight) };
    return camCache.cam;
  };
  const toyOf = (w) => (w.toy === 'yoyo' ? w.yy : w.db);

  // ---- the title screen plays by itself --------------------------------------------------------
  function resetAttract() {
    const toy = state.settings.toy;
    state.att = { toy, w: createWorld(toy, 11), j: newJudge(), ctl: null, planner: null, idx: 0, wait: 0.8, rng: aiRng.fork(), id: '', last: 0 };
  }
  function updateAttract(dt) {
    const a = state.att;
    if (!a || a.toy !== state.settings.toy) { resetAttract(); return; }
    if (a.ctl) {
      stepCtl(a.w, a.ctl); stepWorld(a.w, dt);
      const ev = judgeStep(a.j, a.w);
      if (a.ctl.done || ev.some((e) => e.kind === 'drop')) { a.ctl = null; a.wait = 1.2; a.idx++; }
    } else if (a.planner) {
      stepWorld(a.w, dt);
      a.planner.step(1);
      if (a.planner.done) { const r = a.planner.result; a.planner = null; if (r) a.ctl = newCtl(r.kind, r.params); else { a.wait = 0.5; a.idx++; } }
    } else {
      stepWorld(a.w, dt);
      a.wait -= dt;
      if (a.wait <= 0) { const list = ATTRACT[a.toy]; a.id = list[a.idx % list.length]; a.planner = createPlanner(a.w, a.id, a.rng, { want: 1, maxTries: 60 }); }
    }
  }

  // ---- starting a game --------------------------------------------------------------------------
  const resetPlayBits = () => {
    state.drag = null; state.tossT = -1; state.res = null; state.resT = 0; state.hint = null; state.learn = null; state.watch = null; state.ghost = null;
    state.pops = []; state.toastT = 0; state.flash = 0; state.drops = 0; state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; planner = null;
    state.camTop = 1.6;
  };
  const freshWorld = (toy, seed) => {
    state.toy = toy; state.settings.toy = toy;
    state.w = createWorld(toy, seed ?? 1 + runRng.int(90000)); state.w.assist = state.settings.assist;
    state.j = newJudge(); state.j.last = state.w.eid;
    resetPlayBits();
    state.scene = 'play';
  };
  const demoOpen = (tr) => !state.demo || tricksOf(tr.toy).indexOf(tr) < DEMO_OPEN;
  const openTrick = (id) => {
    const tr = TRICK_BY_ID[id];
    if (!demoOpen(tr)) { state.bookMsg = 'That trick is in the full game.'; return; }
    freshWorld(tr.toy);
    state.mode = 'trick'; state.trickId = id;
    if (!state.record.seen[id]) { state.record.seen[id] = 1; save(); beginLearn(); } else toast(tr.tip, 4.2);
  };
  const startShow = (toy) => {
    if (state.demo && state.record.demoShows >= DEMO_SHOWS) { state.scene = 'demolimit'; state.ui.scroll = 0; return; }
    freshWorld(toy);
    state.mode = 'show'; state.show = newShow();
    if (state.demo) state.record.demoShows++;
    toast('Land tricks to score. A drop breaks your chain and costs a life.', 3.6);
  };
  const startDaily = () => {
    const day = config.day | 0, dl = dailyFor(day);
    state.daily = { ...dl, done: [], over: false };
    freshWorld(dl.toy, dl.seed);
    state.mode = 'daily'; state.show = newShow(); state.show.lives = DAILY_DROPS; state.show.time = 1e9;
    toast(`Today: ${dl.ids.map((i) => TRICK_BY_ID[i].name).join(', ')}`, 4.5);
  };
  const startFree = (toy) => { freshWorld(toy); state.mode = 'free'; toast('Free play. No goal. Try anything.', 3); };
  const startWatch = () => {
    freshWorld(state.settings.toy);
    state.mode = 'watch'; state.thinkSecs = THINK_STEPS[state.settings.thinkIdx];
    beginWatchTrick(null);
  };
  const leavePlay = () => { state.scene = 'title'; state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; state.hint = null; state.watch = null; state.learn = null; planner = null; state.res = null; state.ghost = null; state.camTop = 1.6; if (!state.att) resetAttract(); };

  // ---- plans, in words --------------------------------------------------------------------------
  const describePlan = (id, p) => {
    switch (id) {
      case 'y-downup': return 'Flick down to throw it, wait a moment, then flick up to bring it home.';
      case 'y-sleeper': return 'Flick down a short way, let your hand settle, keep still while it sleeps, then flick up.';
      case 'y-long': return 'Throw hard for lots of spin, keep your hand still for six seconds, then flick up.';
      case 'y-walk': return 'Flick down and hold your finger low so it lands. Slide right slowly, then flick up.';
      case 'y-break': return 'Flick out to the side. Let it swing wide, and flick up when it hangs low.';
      case 'y-around': return 'Flick forward hard and a little upward. It whips round the circle. Flick up when it hangs.';
      case 'y-double': return 'A very hard forward flick keeps it going for two circles. Flick up when it hangs low.';
      case 'd-spin': return 'Shake your finger left and right until the spin bar passes the mark, and hold it there.';
      case 'd-long': return 'Keep shaking with big, quick strokes until the spin bar is nearly full.';
      case 'd-pend': return 'Move your hand left and right in time with the swing, like pushing a swing.';
      case 'd-triple': return 'Spin, flick up, slide under, catch. Then straight away again, three times.';
      default: return `Spin it up to about ${Math.round(p.wT ?? 140)}, flick up${p.fx ? ' and sideways' : ''}, then slide the hands under it and let it land.`;
    }
  };
  const suggestTrick = () => {
    if (state.mode === 'trick') return state.trickId;
    if (state.mode === 'daily' && state.daily) { const t = state.daily.ids.find((i) => !state.daily.done.includes(i)); if (t) return t; }
    const list = tricksOf(state.toy);
    return (list.find((t) => !(state.record.stars[t.id] | 0) && trickOpen(t, state.record) && demoOpen(t)) ?? list[0]).id;
  };
  const restState = (w) => (w.toy === 'yoyo' ? w.yy.mode === 'home' : w.db.mode === 'string' && !w.db.air);

  // ---- Learn (ghost demo) and Think -------------------------------------------------------------
  const startPlan = (id, purpose) => {
    planner = createPlanner(cloneWorld(state.w), id, aiRng.fork(), { want: 2, maxTries: 90 });
    state.hint = { phase: 'run', purpose, id, t: 0, arcs: [], text: '' };
  };
  const requestHint = () => {
    if (state.mode === 'watch') return;
    if (state.hint && state.hint.phase === 'show') { state.hint = null; state.ghost = null; return; }
    if (planner) return;
    if (!restState(state.w)) { toast(state.toy === 'yoyo' ? 'Bring the yo-yo home, then ask again.' : 'Let it settle on the string, then ask again.', 2.4); return; }
    startPlan(suggestTrick(), 'think');
  };
  function beginLearn() { state.learn = { t: 0 }; startPlan(state.trickId, 'learn'); }
  const stepGhost = () => {
    const g = state.ghost; if (!g) return;
    if (g.idx >= g.frames.length - 1) { g.hold += 1 / 60; if (g.hold > 1.2) { g.idx = 0; g.hold = 0; } } else g.idx++;
  };
  const updateHint = (dt) => {
    const h = state.hint;
    if (!h) return;
    h.t += dt;
    if (h.phase === 'run' && planner) {
      planner.step(3);
      h.arcs = planner.state.arcs;
      if (planner.done || h.t > 5) {
        if (!planner.done) planner.finish();
        const r = planner.result; planner = null;
        if (r) {
          h.phase = 'show'; h.t = 0; h.plan = r; h.text = describePlan(h.id, r.params);
          state.ghost = { frames: recordGhost(state.w, r.kind, r.params), idx: 0, key: `${h.id}:${state.w.eid}:${Math.round(state.w.t)}`, hold: 0 };
        } else { state.hint = null; if (state.learn) { state.learn = null; toast(TRICK_BY_ID[state.trickId].tip, 4); } else toast('No clean plan from here. Try moving the hand first.', 2.6); }
      }
    } else if (h.phase === 'show') {
      stepGhost();
      if (!state.learn && h.t > 14) { state.hint = null; state.ghost = null; }
    }
  };

  // ---- Watch & Learn ----------------------------------------------------------------------------
  const beginWatchTrick = (last) => {
    const list = tricksOf(state.toy).filter((t) => t.id !== last && demoOpen(t));
    const tr = aiRng.pick(list);
    const w = createWorld(state.toy, 1 + aiRng.int(90000)); w.assist = state.settings.assist;
    state.w = w; state.j = newJudge(); state.j.last = w.eid; state.pops = []; state.ghost = null; state.camTop = 1.6;
    state.trickId = tr.id;
    state.watch = { phase: 'think', t: 0, dur: state.thinkSecs, plan: null, arcs: [], note: '', tries: 0, lastId: tr.id, ctl: null, done: false };
    beginThink();
  };
  const beginThink = () => {
    const wt = state.watch;
    wt.phase = 'think'; wt.t = 0; wt.dur = state.thinkSecs; wt.plan = null; wt.arcs = [];
    wt.note = `Which hand motion lands ${TRICK_BY_ID[state.trickId].name}? Trying many.`;
    planner = createPlanner(cloneWorld(state.w), state.trickId, aiRng.fork(), { want: 3, maxTries: 160 });
  };
  const updateWatch = (dt) => {
    const wt = state.watch;
    if (wt.phase === 'think') {
      wt.t += dt;
      if (planner && !planner.done) planner.step(2);
      if (planner) wt.arcs = planner.state.arcs;
      if (wt.t >= wt.dur) {
        if (planner && !planner.done && wt.t > wt.dur + 0.4) planner.finish();
        if (planner && planner.done) {
          const r = planner.result; planner = null;
          if (r) {
            wt.plan = r; wt.phase = 'reveal'; wt.t = 0; wt.dur = 2; wt.note = describePlan(state.trickId, r.params); sfx.chime(2);
            state.ghost = { frames: recordGhost(state.w, r.kind, r.params), idx: 0, key: `w:${state.trickId}:${state.w.eid}:${wt.tries}`, hold: 0 };
          } else if (++wt.tries >= 3) beginWatchTrick(wt.lastId);
          else { beginThink(); wt.note = 'No clean plan yet. Looking again.'; }
        }
      }
    } else if (wt.phase === 'reveal') {
      wt.t += dt; stepGhost();
      if (wt.t >= wt.dur) { wt.phase = 'act'; wt.t = 0; wt.ctl = newCtl(wt.plan.kind, wt.plan.params); wt.note = 'Performing the plan.'; state.ghost = null; }
    } else if (wt.phase === 'act') {
      wt.t += dt;
      stepCtl(state.w, wt.ctl);
      simulate(dt);
      if (wt.done) { wt.phase = 'celebrate'; wt.t = 0; wt.dur = 2.4; wt.note = `${TRICK_BY_ID[state.trickId].name} landed. Another trick soon.`; sfx.win(); }
      else if (wt.ctl.done || wt.t > 30) { toast('That one slipped. Thinking again.', 2); beginWatchTrick(wt.lastId); }
    } else if (wt.phase === 'celebrate') {
      simulate(dt); wt.t += dt;
      if (wt.t >= wt.dur) beginWatchTrick(wt.lastId);
    }
  };

  // ---- the simulation tick (all modes) ----------------------------------------------------------
  const spinOf = (w) => clamp(toyOf(w).w / (w.toy === 'yoyo' ? YO.wmax : DB.wmax), 0, 1);
  function simulate(dt) {
    const w = state.w;
    stepWorld(w, dt);
    const evs = judgeStep(state.j, w);
    for (const e of evs) onEvent(e);
    const t = toyOf(w);
    const want = Math.max(1.6, t.y + 1.0);                 // the camera follows the toy up when it goes high, settles back slowly
    state.camTop += (want - state.camTop) * Math.min(1, dt * (want > state.camTop ? 9 : 0.9));
    if (t.w > 40) { state.spinSfx -= dt; if (state.spinSfx <= 0) { sfx.whirr(t.w); state.spinSfx = 0.12; } }
  }
  const toyPoint = () => { const t = toyOf(state.w); return { x: t.x, y: t.y }; };
  function onEvent(e) {
    const p = toyPoint();
    if (e.kind === 'throw') sfx.throw(6);
    else if (e.kind === 'snap') sfx.snap(e.v);
    else if (e.kind === 'bind') sfx.bind();
    else if (e.kind === 'toss') sfx.toss();
    else if (e.kind === 'loop') { sfx.loop(); say(`Loop ${e.n}`, p.x, p.y + 0.3, { col: '#bff8fa' }); }
    else if (e.kind === 'catch') sfx.catch(e.v ?? 3);
    else if (e.kind === 'trick') onTrick(e.id);
    else if (e.kind === 'drop') onDrop(e);
  }
  function onTrick(id) {
    const tr = TRICK_BY_ID[id], w = state.w, p = toyPoint(), spin = spinOf(w);
    state.record.tricks++;
    if (state.mode === 'watch') { if (id === state.trickId) state.watch.done = true; return; }
    if (state.mode === 'trick') {
      if (id === state.trickId) { say(tr.name, p.x, p.y + 0.4, { size: 54 }); finishTrick(); }
      else if (id !== 'y-downup') say(tr.name, p.x, p.y + 0.4, { col: '#bff8fa' });
      return;
    }
    if (state.mode === 'free') { say(tr.name, p.x, p.y + 0.4, { size: 46 }); sfx.chime(1); state.flash = 0.3; return; }
    const sh = state.show, r = showTrick(sh, id, spin);
    sfx.chime(Math.min(5, sh.chain));
    say(`${tr.name}  +${r.pts}`, p.x, p.y + 0.4, { size: 46 });
    state.flash = 0.35;
    if (state.mode === 'daily') {
      const d = state.daily;
      if (d.ids.includes(id) && !d.done.includes(id)) {
        d.done.push(id); sfx.win(); say('Goal done!', 0, 1.1, { size: 54, col: '#ffe08a' });
        if (d.done.length === d.ids.length) finishDaily(true);
      }
    }
  }
  function onDrop(e) {
    const p = toyPoint();
    state.drops++; state.dropTotal = (state.dropTotal | 0) + 1;
    sfx.drop(); toast(WHY[e.why] ?? 'Dropped', 2.4);
    say('Drop', p.x, p.y + 0.3, { col: '#ff9a88' });
    if (state.mode === 'show') { showDrop(state.show); if (state.show.over) finishShow(); }
    else if (state.mode === 'daily') { showDrop(state.show); if (state.show.over && !state.daily.over) finishDaily(false); }
  }
  function finishTrick() {
    const tr = TRICK_BY_ID[state.trickId], rec = state.record, drops = state.drops, stars = starsFor(drops);
    const prev = rec.stars[tr.id] | 0;
    if (stars > prev) rec.stars[tr.id] = stars;
    rec.drops[tr.id] = Math.min(rec.drops[tr.id] ?? 99, drops);
    save();
    const list = tricksOf(tr.toy), nx = list[list.indexOf(tr) + 1];
    state.res = { kind: 'trick', id: tr.id, name: tr.name, stars, drops, best: rec.stars[tr.id], next: nx && trickOpen(nx, rec) && demoOpen(nx) ? { id: nx.id, name: nx.name } : null, toy: tr.toy };
    state.resT = 1.4; state.flash = 0.7; sfx.win();
    const p = toyPoint(); say('Trick landed!', p.x, p.y + 0.7, { size: 60, max: 1.8 });
  }
  function finishShow() {
    if (state.res) return;
    const sh = state.show, rec = state.record, toy = state.toy;
    const nb = sh.score > (rec.showBest[toy] | 0);
    if (nb) rec.showBest[toy] = sh.score;
    rec.shows++; save();
    state.res = { kind: 'show', score: sh.score, best: rec.showBest[toy], newBest: nb, tricks: sh.tricks, chain: sh.best, toy };
    state.resT = 1.1; sfx.win();
  }
  function finishDaily(won) {
    if (state.res) return;
    const d = state.daily, sh = state.show, rec = state.record, day = d.day;
    const bonus = won ? Math.max(0, 200 - 40 * state.drops) : 0;
    const score = sh.score + bonus, dr = rec.daily;
    if (dr.day !== day) { dr.day = day; dr.best = 0; dr.done = false; }
    if (score > dr.best) dr.best = score;
    if (won && !dr.done) { dr.streak = dr.last === day - 1 ? (dr.streak | 0) + 1 : 1; dr.last = day; dr.done = true; }
    save();
    d.over = true;
    state.res = { kind: 'daily', won, score, best: dr.best, streak: dr.streak | 0, done: d.done.length, total: d.ids.length, names: d.ids.map((i) => TRICK_BY_ID[i].name), toy: d.toy, bonus };
    state.resT = won ? 1.4 : 1.0; if (won) sfx.win();
  }

  // ---- the human hand ---------------------------------------------------------------------------
  const slewTo = (w, x, y, v, dt) => {
    const H = w.hand, dx = x - H.tx, dy = y - H.ty, d = Math.hypot(dx, dy), m = v * dt;
    if (d <= m) setHand(w, x, y); else setHand(w, H.tx + dx / d * m, H.ty + dy / d * m);
  };
  function act() {
    const w = state.w;
    if (w.toy === 'yoyo') w.cmd.yank = true;
    else if (state.tossT < 0 && w.db.mode === 'string' && !w.db.air) state.tossT = 0;
  }
  function openPause() { state.paused = true; state.pauseMenu = true; state.ui.scroll = 0; state.drag = null; }
  function closePause() { state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; }
  const updateHuman = (dt, input) => {
    const ptr = input.pointer, keys = input.keys, w = state.w, cam = getCam();
    const mpu = 1 / cam.k;
    if (keys.pressed.has('Space')) act();
    if (keys.pressed.has('KeyH')) requestHint();
    if (ptr.pressed) {
      if (inRect(ACT_BTN, ptr.x, ptr.y)) { act(); sfx.tick(); }
      else if (inRect(HINT_BTN, ptr.x, ptr.y)) { requestHint(); sfx.tick(); }
      else if (inRect(MENU_BTN, ptr.x, ptr.y)) { openPause(); return; }
      else state.drag = { px: ptr.x, py: ptr.y, hx: w.hand.tx, hy: w.hand.ty };
    }
    const kx = (keys.down.has('ArrowRight') ? 1 : 0) - (keys.down.has('ArrowLeft') ? 1 : 0), ky = (keys.down.has('ArrowUp') ? 1 : 0) - (keys.down.has('ArrowDown') ? 1 : 0);
    if (state.tossT >= 0) {                            // the Toss button: a quick lift of both hands
      state.tossT += dt;
      if (state.tossT < 0.09) slewTo(w, w.hand.tx, 0.34, 7, dt); else if (state.tossT < 0.5) slewTo(w, w.hand.tx, 0, 1.8, dt); else state.tossT = -1;
    } else if (state.drag && ptr.down) {
      const d = state.drag;
      const tx = d.hx + (ptr.x - d.px) * mpu, ty = d.hy - (ptr.y - d.py) * mpu;
      setHand(w, tx, ty);
      d.hx += w.hand.tx - tx; d.hy += w.hand.ty - ty;     // stuck at the edge: finger and hand stay together when it moves back
    } else if (kx || ky) {
      setHand(w, w.hand.tx + kx * 1.6 * dt, w.hand.ty + ky * 1.6 * dt);
    } else {
      state.drag = null;
      slewTo(w, 0, 0, 1.1, dt);                         // no finger: the hand eases back to rest
    }
    if (ptr.released || !ptr.down) state.drag = null;
    if (state.hint && state.hint.phase === 'show' && state.drag && !state.learn) { state.hint = null; state.ghost = null; }
  };

  // ---- play -------------------------------------------------------------------------------------
  const tickCommon = (dt) => {
    if (state.toastT > 0) state.toastT -= dt;
    if (state.flash > 0) state.flash -= dt;
    for (const p of state.pops) p.t += dt;
    state.pops = state.pops.filter((p) => p.t < p.max);
  };
  const updatePlay = (dt, input) => {
    const ptr = input.pointer, keys = input.keys;
    if (keys.pressed.has('KeyP') || keys.pressed.has('Escape')) { if (state.pauseMenu) closePause(); else if (state.mode === 'watch') state.paused = !state.paused; else openPause(); }
    if (state.pauseMenu) {
      if (flowMeta().key !== 'pause') return;
      if (ptr.pressed) state.ui.drag = { y0: ptr.y, s0: state.ui.scroll, moved: 0 };
      if (state.ui.drag && ptr.down) scrollFlow(ptr);
      if (ptr.released && state.ui.drag) { const d = state.ui.drag; state.ui.drag = null; if (d.moved < 10) handlePauseTap(hitScreen(ptr.x, ptr.y, state.ui.scroll)); }
      return;
    }
    if (state.learn) {                                 // the ghost demo: the world waits, a tap starts the try
      tickCommon(dt);
      updateHint(dt);
      const go = () => { state.learn = null; state.hint = null; state.ghost = null; planner = null; toast(TRICK_BY_ID[state.trickId].tip, 4.2); };
      if (ptr.pressed) { if (inRect(MENU_BTN, ptr.x, ptr.y)) openPause(); else if (state.hint && state.hint.phase === 'show') go(); }
      if (keys.pressed.has('Space') || keys.pressed.has('Enter')) go();
      return;
    }
    if (state.mode === 'watch') {
      if (ptr.pressed) {
        if (inRect(WATCH_BAR.pause, ptr.x, ptr.y)) { state.paused = !state.paused; sfx.tick(); }
        else if (inRect(WATCH_BAR.dec, ptr.x, ptr.y)) { state.settings.thinkIdx = Math.max(0, state.settings.thinkIdx - 1); state.thinkSecs = THINK_STEPS[state.settings.thinkIdx]; sfx.tick(); save(); }
        else if (inRect(WATCH_BAR.inc, ptr.x, ptr.y)) { state.settings.thinkIdx = Math.min(THINK_STEPS.length - 1, state.settings.thinkIdx + 1); state.thinkSecs = THINK_STEPS[state.settings.thinkIdx]; sfx.tick(); save(); }
        else if (inRect(WATCH_BAR.exit, ptr.x, ptr.y)) { leavePlay(); return; }
      }
      if (keys.pressed.has('Space')) state.paused = !state.paused;
      if (state.paused) return;                         // pause freezes everything: planner, controller, physics, timers
      state.clock += dt; tickCommon(dt);
      updateWatch(dt);
      return;
    }
    if (state.res) {
      state.resT -= dt; state.clock += dt; tickCommon(dt);
      simulate(dt);
      if (state.resT <= 0) { state.scene = 'result'; state.ui.scroll = 0; }
      return;
    }
    if (state.paused) return;
    state.clock += dt;
    updateHuman(dt, input);
    updateHint(dt);
    tickCommon(dt);
    if (state.mode === 'show') { state.show.time -= dt; if (state.show.time <= 0) { state.show.over = true; finishShow(); } }
    if (!state.res) simulate(dt);
  };

  // ---- menus ------------------------------------------------------------------------------------
  function scrollFlow(ptr) {
    const d = state.ui.drag, m = flowMeta();
    d.moved = Math.max(d.moved, Math.abs(ptr.y - d.y0));
    if (d.moved >= 10 && m.lay) state.ui.scroll = clamp(d.s0 - (ptr.y - d.y0), 0, Math.max(0, m.lay.contentH - (m.bottom - m.top)));
  }
  function handlePauseTap(id) {
    if (!id) return;
    sfx.tick();
    if (id === 'resume') closePause();
    else if (id === 'p-rules') { state.back = 'play'; state.scene = 'rules'; state.page = 0; state.ui.scroll = 0; }
    else if (id === 'p-howto') { state.back = 'play'; state.scene = 'howto'; state.page = 0; state.ui.scroll = 0; }
    else if (id === 'p-sound') { state.settings.sound = !state.settings.sound; audio.setMuted?.(!state.settings.sound); save(); }
    else if (id === 'p-assist') { state.settings.assist = (state.settings.assist + 1) % 3; state.w.assist = state.settings.assist; save(); }
    else if (id === 'p-restart') { if (state.mode === 'trick') openTrick(state.trickId); else if (state.mode === 'show') startShow(state.toy); else if (state.mode === 'daily') startDaily(); else startFree(state.toy); }
    else if (id === 'p-endshow') { closePause(); if (state.mode === 'show') { state.show.over = true; finishShow(); } else if (state.mode === 'daily') finishDaily(false); }
    else if (id === 'quit') leavePlay();
  }
  const setToy = (toy) => { state.settings.toy = toy; save(); resetAttract(); };
  const handleTitle = (id) => {
    if (!id) return;
    if (id === 'arcforge') { env.openArcforgeHome?.(); return; }
    sfx.tick();
    if (id === 'toy-yoyo') setToy('yoyo');
    else if (id === 'toy-diabolo') setToy('diabolo');
    else if (id === 'book') { state.scene = 'book'; state.ui.scroll = 0; state.bookMsg = ''; const nx = tricksOf(state.settings.toy).find((t) => trickOpen(t, state.record) && !(state.record.stars[t.id] | 0)); state.ui.focusId = nx ? `t:${nx.id}` : null; }
    else if (id === 'show') startShow(state.settings.toy);
    else if (id === 'daily') startDaily();
    else if (id === 'free') startFree(state.settings.toy);
    else if (id === 'watch') startWatch();
    else if (id === 'howto' || id === 'rules' || id === 'about') { state.back = 'title'; state.scene = id; state.page = 0; state.ui.scroll = 0; }
    else if (id === 'settings') { state.scene = 'settings'; state.ui.scroll = 0; }
    else if (id === 'sound') { state.settings.sound = !state.settings.sound; audio.setMuted?.(!state.settings.sound); save(); }
  };
  const handleBook = (id) => {
    if (!id) return;
    sfx.tick();
    if (id === 'toy-yoyo') { setToy('yoyo'); state.ui.scroll = 0; return; }
    if (id === 'toy-diabolo') { setToy('diabolo'); state.ui.scroll = 0; return; }
    if (id.startsWith('t:')) {
      const tr = TRICK_BY_ID[id.slice(2)];
      if (!trickOpen(tr, state.record)) { const need = [0, 2, 6, 11][tr.row] - tricksOf(tr.toy).reduce((n, t) => n + (state.record.stars[t.id] | 0), 0); state.bookMsg = `Earn ${need} more star${need === 1 ? '' : 's'} on this toy to open this row.`; return; }
      openTrick(tr.id);
    }
  };
  const handleSettings = (id) => {
    if (!id) return;
    const st = state.settings;
    sfx.tick();
    if (id === 'set-sound') { st.sound = !st.sound; audio.setMuted?.(!st.sound); }
    else if (id === 'as-dec') st.assist = Math.max(0, st.assist - 1);
    else if (id === 'as-inc') st.assist = Math.min(2, st.assist + 1);
    else if (id === 'txt-dec') st.textIdx = Math.max(0, st.textIdx - 1);
    else if (id === 'txt-inc') st.textIdx = Math.min(TEXT_SCALES.length - 1, st.textIdx + 1);
    else if (id === 'think-dec') { st.thinkIdx = Math.max(0, st.thinkIdx - 1); state.thinkSecs = THINK_STEPS[st.thinkIdx]; }
    else if (id === 'think-inc') { st.thinkIdx = Math.min(THINK_STEPS.length - 1, st.thinkIdx + 1); state.thinkSecs = THINK_STEPS[st.thinkIdx]; }
    else if (id === 'restore') {
      state.restoreMsg = 'Checking with the store…';
      Promise.resolve(monetization.restore?.()).then(() => { state.restoreMsg = monetization.owns('unlock_game') ? 'Purchase restored. Thank you!' : 'No previous purchase found.'; }).catch(() => { state.restoreMsg = 'The store is not available right now.'; });
    } else if (id === 'back') { state.scene = 'title'; state.ui.scroll = 0; state.restoreMsg = ''; }
    state.w.assist = st.assist;
    save();
  };
  const handleResult = (id) => {
    if (!id) return;
    sfx.tick();
    const r = state.res;
    if (id === 'again') { if (r.kind === 'show') startShow(r.toy); else if (r.kind === 'daily') startDaily(); else openTrick(r.id); }
    else if (id === 'next') openTrick(r.next.id);
    else if (id === 'book') { state.settings.toy = r.toy; state.scene = 'book'; state.ui.scroll = 0; state.bookMsg = ''; state.ui.focusId = r.id ? `t:${r.id}` : null; }
    else if (id === 'menu') leavePlay();
  };
  const updateFlowScene = (dt, input, handler, key) => {
    const ptr = input.pointer;
    if (key) ensureLayout(state, key);
    if (ptr.pressed) state.ui.drag = { y0: ptr.y, x0: ptr.x, s0: state.ui.scroll, moved: 0 };
    if (state.ui.drag && ptr.down) scrollFlow(ptr);
    if (ptr.released && state.ui.drag) {
      const d = state.ui.drag; state.ui.drag = null;
      const lay = flowMeta(), scrollable = lay.lay && lay.lay.contentH > lay.bottom - lay.top;
      if (d.moved < 10) handler(hitScreen(ptr.x, ptr.y, state.ui.scroll));
      else if (!scrollable) handler(hitScreen(d.x0, d.y0, state.ui.scroll));
    }
    const m = flowMeta(), max = m.lay ? Math.max(0, m.lay.contentH - (m.bottom - m.top)) : 0;
    if (input.keys.pressed.has('Equal') || input.keys.pressed.has('NumpadAdd')) { state.settings.textIdx = Math.min(TEXT_SCALES.length - 1, state.settings.textIdx + 1); save(); }
    if (input.keys.pressed.has('Minus') || input.keys.pressed.has('NumpadSubtract')) { state.settings.textIdx = Math.max(0, state.settings.textIdx - 1); save(); }
    if (wheelInput.dy) { state.ui.scroll = clamp(state.ui.scroll + wheelInput.dy, 0, max); wheelInput.dy = 0; }
    if (input.keys.down.has('ArrowDown')) state.ui.scroll = clamp(state.ui.scroll + 14, 0, max);
    if (input.keys.down.has('ArrowUp')) state.ui.scroll = clamp(state.ui.scroll - 14, 0, max);
  };
  const updateBook = (dt, input) => {
    const ptr = input.pointer;
    if (input.keys.pressed.has('Escape')) { state.scene = 'title'; state.ui.scroll = 0; return; }
    if (ptr.pressed && inRect(LAY.book.back, ptr.x, ptr.y)) { state.scene = 'title'; state.ui.scroll = 0; return; }
    updateFlowScene(dt, input, handleBook, 'book');
  };
  const updatePages = (input) => {
    const ptr = input.pointer, keys = input.keys;
    const close = () => { state.scene = state.back === 'play' ? 'play' : 'title'; state.page = 0; state.ui.scroll = 0; state.ui.drag = null; };
    const setScroll = (v) => { state.ui.scroll = clamp(v, 0, READER.max); };
    if (ptr.pressed) {
      if (inRect(refCloseRect(), ptr.x, ptr.y)) { close(); return; }
      else if (inRect(TEXT_DEC, ptr.x, ptr.y)) { state.settings.textIdx = Math.max(0, state.settings.textIdx - 1); save(); }
      else if (inRect(TEXT_INC, ptr.x, ptr.y)) { state.settings.textIdx = Math.min(TEXT_SCALES.length - 1, state.settings.textIdx + 1); save(); }
      else if (ptr.y >= READER.y0 && ptr.y <= READER.y1) state.ui.drag = { y0: ptr.y, s0: state.ui.scroll };
    }
    if (state.ui.drag && ptr.down) setScroll(state.ui.drag.s0 - (ptr.y - state.ui.drag.y0));
    if (ptr.released) state.ui.drag = null;
    if (wheelInput.dy) { setScroll(state.ui.scroll + wheelInput.dy); wheelInput.dy = 0; }
    const step = 70, pg = Math.max(100, READER.view - 80);
    if (keys.pressed.has('ArrowDown')) setScroll(state.ui.scroll + step);
    if (keys.pressed.has('ArrowUp')) setScroll(state.ui.scroll - step);
    if (keys.pressed.has('PageDown') || keys.pressed.has('Space')) setScroll(state.ui.scroll + pg);
    if (keys.pressed.has('PageUp')) setScroll(state.ui.scroll - pg);
    if (keys.pressed.has('Home')) setScroll(0);
    if (keys.pressed.has('End')) setScroll(READER.max);
    if (keys.pressed.has('Escape') || keys.pressed.has('Enter')) close();
  };

  resetAttract();

  // ---- screenshot mode (?shot=1): a scripted showcase chosen by the seed, no input ----------------
  const shotRun = (toy, id, secs) => {                // plan and perform a trick synchronously, then keep the world as is
    freshWorld(toy, 5);
    const pl = createPlanner(cloneWorld(state.w), id, aiRng.fork(), { want: 1, maxTries: 80 });
    while (!pl.done) pl.step(4);
    if (!pl.result) return;
    const c = newCtl(pl.result.kind, pl.result.params);
    for (let i = 0; i < secs * 60; i++) { stepCtl(state.w, c); simulate(1 / 60); if (state.res) break; }
    state.pops = []; state.toastT = 0;
  };
  const shotLearn = (id) => {                            // the ghost demo, planned synchronously
    openTrick(id); if (state.hint) { planner.step(400); } updateHint(0.01); for (let i = 0; i < 40; i++) stepGhost();
    if (state.ghost) state.ghost.idx = Math.floor(state.ghost.frames.length * 0.45);
  };
  const shotSetup = () => {
    const S = config.seed;
    state.settings.toy = S % 2 === 0 ? 'diabolo' : 'yoyo';
    if (S >= 20) state.settings.textIdx = 4;
    const k = S >= 20 ? S - 20 + 100 : S;
    const res = (r) => { freshWorld(state.settings.toy, 5); state.res = r; state.scene = 'result'; };
    switch (k) {
      case 1: case 100: return;                          // title
      case 2: case 101: state.scene = 'book'; state.record.stars = { 'y-downup': 3, 'y-sleeper': 2, 'y-walk': 1, 'd-spin': 3, 'd-pend': 2, 'd-toss': 2 }; state.ui.focusId = k === 2 ? 't:y-break' : null; return;
      case 3: shotRun('yoyo', 'y-sleeper', 2.6); state.mode = 'trick'; state.trickId = 'y-sleeper'; return;
      case 4: shotRun('diabolo', 'd-high', 4.0); state.mode = 'show'; state.show = newShow(); state.show.score = 1260; state.show.chain = 4; state.show.time = 96; return;
      case 5: state.settings.toy = 'yoyo'; startWatch(); return;
      case 6: state.scene = 'rules'; state.ui.scroll = 1100; return;
      case 7: shotRun('yoyo', 'y-around', 0.75); state.mode = 'trick'; state.trickId = 'y-around'; return;
      case 8: shotRun('diabolo', 'd-toss', 3.6); state.mode = 'trick'; state.trickId = 'd-toss'; return;
      case 9: state.scene = 'about'; return;
      case 10: shotRun('yoyo', 'y-walk', 2.2); state.mode = 'daily'; state.daily = { ...dailyFor(config.day | 0), done: ['y-sleeper'], over: false }; state.show = newShow(); state.show.score = 540; return;
      case 11: shotRun('diabolo', 'd-spin', 3.2); state.mode = 'free'; return;
      case 12: state.scene = 'howto'; state.ui.scroll = 0; return;
      case 13: shotRun('diabolo', 'd-toss', 2.0); state.mode = 'trick'; state.trickId = 'd-toss'; openPause(); return;
      case 14: res({ kind: 'trick', id: 'y-sleeper', name: 'Sleeper', stars: 3, drops: 0, best: 3, next: { id: 'y-walk', name: 'Walk the Dog' }, toy: 'yoyo' }); return;
      case 15: shotLearn('d-high'); return;
      case 16: state.demo = true; state.scene = 'demolimit'; return;
      case 17: res({ kind: 'show', score: 2480, best: 2480, newBest: true, tricks: 11, chain: 6, toy: 'diabolo' }); return;
      case 18: res({ kind: 'daily', won: true, score: 910, best: 910, streak: 3, done: 3, total: 3, names: ['Sleeper', 'Walk the Dog', 'Breakaway'], toy: 'yoyo', bonus: 160 }); return;
      case 19: state.scene = 'settings'; return;
      case 102: state.scene = 'settings'; return;
      case 103: state.scene = 'rules'; state.ui.scroll = 4000; return;
      case 104: state.settings.toy = 'yoyo'; res({ kind: 'trick', id: 'y-sleeper', name: 'Sleeper', stars: 3, drops: 0, best: 3, next: { id: 'y-walk', name: 'Walk the Dog' }, toy: 'yoyo' }); return;
      case 105: state.settings.toy = 'yoyo'; freshWorld('yoyo', 5); state.mode = 'trick'; state.trickId = 'y-sleeper'; openPause(); return;
      case 106: res({ kind: 'show', score: 2480, best: 2480, newBest: true, tricks: 11, chain: 6, toy: 'diabolo' }); return;
      case 107: state.scene = 'howto'; return;
      case 108: state.scene = 'about'; return;
      default: shotRun('diabolo', 'd-spin', 3.2); state.mode = 'free';
    }
  };
  if (SHOT) shotSetup();

  return {
    // Watch & Learn, the ghost demo and every menu are free; only real play counts against the free preview (a paused game does not).
    isPreviewExempt: () => !(state.scene === 'play' && state.mode !== 'watch') || state.paused || !!state.learn,
    update(dt, input) {
      relayout(meta.width, meta.height);
      setPress(input.pointer);
      if (SHOT) {
        state.t += dt;
        if (state.scene === 'title') updateAttract(dt);
        if (state.scene === 'play') { state.clock += dt; tickCommon(dt); if (state.mode === 'watch') updateWatch(dt); else if (!state.res) simulate(dt); }
        return;
      }
      state.t += state.paused && state.scene === 'play' ? 0 : dt;
      if (state.scene !== 'play' && state.scene !== 'result' && state.att) updateAttract(dt);
      switch (state.scene) {
        case 'title': updateFlowScene(dt, input, handleTitle, 'title'); break;
        case 'book': updateBook(dt, input); break;
        case 'settings': updateFlowScene(dt, input, handleSettings, 'settings'); break;
        case 'result': updateFlowScene(dt, input, handleResult, 'result'); break;
        case 'demolimit': updateFlowScene(dt, input, (id) => { if (id === 'menu') { state.scene = 'title'; state.ui.scroll = 0; } }, 'demolimit'); break;
        case 'howto': case 'about': case 'rules': updatePages(input); break;
        case 'play': updatePlay(dt, input); break;
        default: break;
      }
      wheelInput.dy = 0;
    },
    render(ctx) {
      relayout(meta.width, meta.height);
      const cam = getCam();
      switch (state.scene) {
        case 'title': renderTitle(ctx, state, cam); break;
        case 'book': renderBook(ctx, state, cam); break;
        case 'settings': renderSettings(ctx, state, cam); break;
        case 'result': renderResult(ctx, state, cam); break;
        case 'demolimit': renderDemoLimit(ctx, state, cam); break;
        case 'howto': renderPages(ctx, state, HOWTO, 'How to Play', cam); break;
        case 'about': renderPages(ctx, state, ABOUT, 'About', cam); break;
        case 'rules': renderPages(ctx, state, RULES, 'Rules', cam); break;
        case 'play':
          renderPlay(ctx, state, cam);
          if (state.pauseMenu) renderPause(ctx, state);
          break;
        default: break;
      }
    },
    getState: () => state,
    lockupZone: () => lockupZone(),
    // The 3D presenter reads this: the world to draw, the stage rectangle in layout units and the camera top.
    view3d() {
      const L = LAY; if (!L) return null;
      const play = playScene();
      const w = play ? state.w : state.att ? state.att.w : state.w;
      const toy = play ? state.toy : state.att ? state.att.toy : state.toy;
      return { toy, w, W: L.W, H: L.H, rect: sceneRect(), camTop: play ? state.camTop : 1.6, tight: !play && !L.land, clock: state.t, ghost: state.scene === 'play' && state.ghost ? state.ghost : null, scene: state.scene };
    },
    // Dev / check scripts only: every tappable rectangle and info box of the screen being shown.
    devRects() {
      const L = LAY, out = {}, add = (n, r) => { if (r && r.w > 0) out[n] = { x: r.x, y: r.y, w: r.w, h: r.h }; };
      const m = flowMeta();
      const flow = (pfx) => m.lay && m.lay.items.forEach((it) => {
        if (it.w.t !== 'btn') return;
        const y = m.top + it.y - state.ui.scroll;
        if (y >= m.top - 1 && y + it.h <= m.bottom + 1) add(`${pfx}${it.w.id}`, { x: it.x, y, w: it.wd, h: it.h });
      });
      if (state.scene === 'play') {
        if (state.pauseMenu) flow('pause:');
        else if (state.mode === 'watch') ['dec', 'pause', 'inc', 'exit'].forEach((n) => add(n, L.watch[n]));
        else { add('act', L.act); add('hint', L.hint); add('menu', L.menu); }
        if (!state.pauseMenu) { add('stage', L.stage); add('hud', L.hud); }
      } else if (state.scene === 'howto' || state.scene === 'about' || state.scene === 'rules') {
        add('back', REF_BACK); add('next', REF_NEXT); add('dec', TEXT_DEC); add('inc', TEXT_INC); add('panel', L.pages.panel);
      } else if (state.scene === 'book') { flow('book:'); add('back', L.book.back); }
      else flow('');
      return { rects: out, back: L.backBox.w ? L.backBox : null, ins: L.ins, w: L.w, h: L.h, land: L.land };
    },
  };
}
void TRICKS; void totalStars;

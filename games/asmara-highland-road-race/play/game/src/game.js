// Asmara Highland Road Race: state and flow. The physics lives in sim.js, the controllers and planner in ai.js, the road
// picture in view.js, the HUD in hud.js, menus in menus.js. This is the only file that mutates `state`.
//
// Scenes: title, setup, settings, play (also time trial and Watch & Learn), result, howto/about/rules, demolimit.
import { createRace, step, classification, TEAMS, TYPES, SLOTS, FIELDS, rateFor, fmtTime, fmtGap, etaOf, EASE, SIT, PUSH, ATTACK, SPRINT_M } from './sim.js';
import { decide, createPlanner, MODE_NAMES } from './ai.js';
import { STAGES, buildCourse } from './course.js';
import { inRect, TEXT_SCALES, THINK_STEPS, layoutFor } from './layout.js';
import { renderPlay, EFFORTS, ordinal, myRiders } from './hud.js';
import { shownS, riderX } from './view.js';
import { renderTitle, renderSetup, renderSettings, renderResult, renderPause, renderPages, renderDemoLimit, hitScreen, flowMeta, pageCount, REF, ensureLayout, flowRects, lockupZone } from './menus.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import { setPress } from './ui.js';

export const meta = { width: 720, height: 1280, fluid: { short: 720 } };
const DEMO_RACE_CAP = 2;
const SPEEDS = [1, 2, 4];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const WATCH_EVERY = 110;           // seconds of race time between decisions in Watch & Learn

export function createGame(env) {
  const { rng, audio, storage, config, monetization } = env;
  const lay = () => layoutFor(meta.width, meta.height);
  const raceRng = rng.fork(), fx = rng.fork();
  const state = {
    scene: 'title', back: 'title', t: 0, paused: false, pauseMenu: false, demo: !!config.demo,
    settings: { sound: true, textIdx: 0, thinkIdx: 1 },
    record: { stars: {}, tt: {}, best: {}, raced: 0, wins: 0, demoRaces: 0 },
    setup: { mode: 'race', stage: 0, field: 1, rider: 0 }, setupMsg: '',
    ui: { scroll: 0, drag: null }, refScroll: 0,
    race: null, mode: 'race', sel: 0, cam: { s: 0, tilt: 0, off: 0 }, anim: 0, alpha: 0, acc: 0, speedIdx: 0, rate: 10,
    toast: '', toastT: 0, banner: null, hint: null, think: null, explain: null, showStand: false, result: null, shake: null,
    loaded: false, restoreMsg: '', endT: 0, nextDecide: 0, prevCr: [], prevAtt: [], sprintShown: false, lk: '', ovrLog: null,
  };
  let planner = null;

  // ---- persistence -----------------------------------------------------------------------------
  const save = () => { storage.set('settings', state.settings); storage.set('record', state.record); };
  const applySettings = () => {
    const st = state.settings;
    st.textIdx = clamp(st.textIdx | 0, 0, TEXT_SCALES.length - 1);
    st.thinkIdx = clamp(st.thinkIdx | 0, 0, THINK_STEPS.length - 1);
    try { config.textScale = TEXT_SCALES[st.textIdx]; } catch { /* config may be frozen */ }
  };
  Promise.all([storage.get('settings', null), storage.get('record', null)]).then(([s, r]) => {
    if (s) Object.assign(state.settings, s);
    if (r) Object.assign(state.record, r);
    for (const k of ['stars', 'tt', 'best']) if (!state.record[k]) state.record[k] = {};
    applySettings();
    state.loaded = true;
    audio.setMuted?.(!state.settings.sound);
  });
  applySettings();

  // ---- sound -----------------------------------------------------------------------------------
  const tone = (o) => { if (state.settings.sound) audio.tone(o); };
  const sfx = {
    tick: () => tone({ freq: 900, dur: 0.04, type: 'triangle', vol: 0.05 }),
    no: () => tone({ freq: 220, to: 140, dur: 0.2, type: 'sawtooth', vol: 0.06 }),
    attack: () => { tone({ freq: 220, to: 520, dur: 0.28, type: 'sawtooth', vol: 0.05 }); },
    crack: () => { tone({ freq: 300, to: 70, dur: 0.5, type: 'sawtooth', vol: 0.08 }); },
    whoosh: () => tone({ freq: 700, to: 200, dur: 0.18, type: 'triangle', vol: 0.04 }),
    chime: (i = 0) => tone({ freq: 523 * Math.pow(1.26, i), dur: 0.3, type: 'sine', vol: 0.12 }),
    win: () => [0, 2, 4, 7].forEach((n, i) => tone({ freq: 440 * Math.pow(2, n / 12), dur: 0.25 + i * 0.05, type: 'triangle', vol: 0.1 })),
  };
  const toast = (text, secs = 2.8) => { state.toast = text; state.toastT = secs; };
  const banner = (text, sub, color, dur = 1.8) => { state.banner = { text, sub, color, t: 0, dur }; };

  // ---- starting and ending a race ----------------------------------------------------------------
  const demoDone = () => state.demo && state.record.demoRaces >= DEMO_RACE_CAP;
  const mine = () => myRiders(state.race);
  const selectRider = (id, instant = false) => {
    const R = state.race;
    if (!R || id === state.sel || !R.riders[id]) return;
    const a = shownS(R.riders[state.sel], state.alpha), b = shownS(R.riders[id], state.alpha);
    if (!instant) state.cam.off += a - b;
    state.sel = id;
  };
  const startRace = (cfg) => {
    if (cfg.mode !== 'watch' && demoDone()) { state.scene = 'demolimit'; state.ui.scroll = 0; return; }
    const R = createRace({ stage: cfg.stage, field: cfg.field ?? 1, mode: cfg.mode, rng: raceRng, slot: cfg.rider ?? 0 });
    state.race = R; state.mode = cfg.mode; state.cfg = { ...cfg };
    state.rate = rateFor(cfg.stage);
    state.sel = R.mode === 'tt' ? 0 : 0;
    state.scene = 'play'; state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; state.speedIdx = 0; state.acc = 0; state.alpha = 0;
    state.cam = { s: 0, tilt: 0, off: 0 }; state.anim = 0; state.hint = null; state.think = null; state.explain = null; state.banner = null;
    state.toast = ''; state.toastT = 0; state.tips = {}; state.showStand = false; state.endT = 0; state.sprintShown = false; state.nextDecide = 12;
    state.prevCr = R.riders.map(() => false); state.prevAtt = R.riders.map(() => false);
    planner = null;
    state.cam.s = shownS(R.riders[0], 0);
    if (cfg.mode === 'race') toast('Tap a rider, then choose an effort. Sit in the group, then attack when it counts.', 5);
    else if (cfg.mode === 'tt') toast('Spend your reserve evenly: more on the climbs, less on the descents.', 5);
    if (cfg.mode !== 'watch') banner('GO!', STAGES[cfg.stage].name, '#ffd27a', 1.5);
    sfx.chime(1);
  };

  const describeModes = (R, forced) => {
    const parts = [];
    for (const r of R.riders) if (forced[r.id] !== undefined && r.team === 0) parts.push(`${TYPES[r.role].label} ${R.mode === 'tt' && forced[r.id] === SIT ? 'STEADY' : MODE_NAMES[forced[r.id]].toUpperCase()}`);
    return parts.join(', ');
  };
  const placeLine = (c) => (c.place === 1 ? `1st${c.margin > 0.5 ? `, ${c.margin < 10 ? c.margin.toFixed(1) : Math.round(c.margin)}s clear` : ''}` : `${ordinal(c.place)} ${fmtGap(c.gap)}`);

  const finishRace = () => {
    const R = state.race, cls = classification(R);
    let res;
    if (R.mode === 'tt') {
      const me = R.riders[0], gh = R.riders[1], ratio = me.fin / gh.fin;
      const medal = ratio <= 1.0 ? 3 : ratio <= 1.02 ? 2 : ratio <= 1.05 ? 1 : 0;
      res = {
        mode: 'tt', stars: medal, stage: state.cfg.stage, title: medal === 3 ? 'Beat the ghost!' : medal ? 'Close to the ghost' : 'Ghost wins',
        line1: `Your time ${fmtTime(me.fin)}; the ghost ${fmtTime(gh.fin)} (${me.fin <= gh.fin ? '-' : '+'}${Math.abs(me.fin - gh.fin).toFixed(1)} s).`,
        line2: medal ? '' : 'Spend more reserve on the steep climbs and less on the flat and the descents.', next: false,
      };
      if (medal > (state.record.tt[state.cfg.stage] ?? 0)) state.record.tt[state.cfg.stage] = medal;
      const bk = `tt${state.cfg.stage}`;
      if (!state.record.best[bk] || me.fin < state.record.best[bk]) state.record.best[bk] = me.fin;
    } else {
      const mineIds = R.riders.filter((r) => r.team === 0).map((r) => r.id);
      const bi = cls.findIndex((i) => mineIds.includes(i)), best = R.riders[cls[bi]], place = bi + 1, win = R.riders[cls[0]];
      const st = place === 1 ? 3 : place <= 3 ? 2 : place <= 6 ? 1 : 0;
      const wname = `${TEAMS[win.team].name} ${TYPES[win.role].label}`;
      res = {
        mode: R.mode, stars: R.mode === 'watch' ? st : st, stage: state.cfg.stage,
        title: R.mode === 'watch' ? (place === 1 ? 'Sunrise wins' : `Sunrise finish ${ordinal(place)}`) : place === 1 ? 'Stage win!' : `${ordinal(place)} place`,
        line1: `${TYPES[best.role].label} ${best.fin !== null ? fmtTime(best.fin) : ''}${place > 1 && best.fin !== null && win.fin !== null ? ` (${fmtGap(best.fin - win.fin)})` : ''}. Winner: ${wname}.`,
        line2: R.mode === 'watch' ? 'Pause and Think are free here: this is how a plan looks.' : `${FIELDS[state.cfg.field].name} on ${STAGES[state.cfg.stage].name}.`,
        next: R.mode === 'race' && st > 0 && state.cfg.stage < STAGES.length - 1 && !(state.demo),
      };
      if (R.mode === 'race') {
        state.record.raced++; if (place === 1) state.record.wins++;
        if (state.demo) state.record.demoRaces++;
        if (st > (state.record.stars[state.cfg.stage] ?? 0)) state.record.stars[state.cfg.stage] = st;
        const bk = `race${state.cfg.stage}`;
        if (best.fin !== null && (!state.record.best[bk] || best.fin < state.record.best[bk])) state.record.best[bk] = best.fin;
      }
    }
    state.result = res;
    save();
    if (res.stars > 0) sfx.win(); else sfx.no();
    state.scene = 'result'; state.ui.scroll = 0;
  };

  // ---- the race loop ----------------------------------------------------------------------------
  const events = () => {
    const R = state.race, ids = R.riders;
    for (const r of ids) {
      const isMine = r.team === 0 && R.mode !== 'tt' || r.ctl === 'human';
      if (r.cracked && !state.prevCr[r.id]) {
        if (isMine && R.mode !== 'watch') { toast(`${TYPES[r.role].label} has cracked: ease off to recover`, 3); sfx.crack(); state.shake = { t: 0, dur: 0.35, a: 4 }; }
        else if (r.team === 0 && R.mode === 'watch') { toast(`${TYPES[r.role].label} has cracked`, 2.4); sfx.crack(); }
      }
      state.prevCr[r.id] = r.cracked;
      if (r.att && !state.prevAtt[r.id] && R.mode !== 'tt') {
        const me = R.riders[state.sel];
        if (r.team !== 0 && Math.abs(r.s - me.s) < 700) { toast(`${TEAMS[r.team].name} ${TYPES[r.role].label} attacks!`, 2.2); sfx.attack(); }
      }
      state.prevAtt[r.id] = r.att;
      if (r.fin !== null && !r._ann) {
        r._ann = true;
        if (isMine && R.mode !== 'watch') {
          const place = 1 + ids.filter((q) => q.fin !== null && q.fin < r.fin).length;
          banner(place === 1 ? 'STAGE WIN!' : ordinal(place), `${TYPES[r.role].label} over the line`, place === 1 ? '#ffd35a' : '#fff3d6', 2.2);
          sfx.chime(place === 1 ? 3 : 1);
        } else if (r.team === 0 && R.mode === 'watch') sfx.chime(1);
      }
    }
    const lead = Math.max(...ids.map((r) => r.s));
    if (R.mode === 'race' && state.record.raced < 4 && R.t > 60) {
      const tips = state.tips || (state.tips = {});
      const ahead = R.course.gradeAt(Math.min(R.L - 1, lead + 250)), now = R.course.gradeAt(Math.max(0, lead));
      if (!tips.steep && ahead > 0.055 && now < 0.05) { tips.steep = true; toast('A steep climb is coming: the slipstream helps less here, and your reserve is worth most.', 4.5); }
      else if (!tips.down && ahead < -0.03) { tips.down = true; toast('Descent: speed is limited by the road, so effort is wasted. Ease off and refill your reserve.', 4.5); }
    }
    if (!state.sprintShown && R.L - lead < SPRINT_M + 150 && R.mode !== 'tt') { state.sprintShown = true; banner('SPRINT!', 'Everything you have left', '#ff8b6a', 1.6); sfx.whoosh(); }
  };

  const stepRace = () => {
    const R = state.race;
    step(R, 1, decide);
    events();
  };

  // Watch & Learn: think -> reveal -> act, with the whole race frozen while the planner works.
  const updateWatchDecisions = (dt) => {
    const R = state.race;
    if (state.think) {
      const th = state.think;
      th.t += dt;
      if (th.phase === 'think') {
        if (planner && !planner.done) {
          planner.step(2);
          state.explain = { head: `${TEAMS[0].name} are thinking…`, lines: [`Trying ${planner.sims} orders on a copy of the race`, 'Counting reserves, gradients and the slipstream'] };
          if (planner.done) { th.res = planner.result; planner = null; }
        }
        if (th.t >= th.dur && th.res) {
          th.phase = 'reveal'; th.t = 0; th.dur = 2;
          const b = th.res.best;
          state.explain = { head: `Choice: ${describeModes(R, b.forced)}`, lines: th.res.alts.map((a, i) => `${i + 1}. ${a.label}: ${placeLine(a)}`) };
          toast(`${TEAMS[0].name}: ${describeModes(R, b.forced)}`, 2.2);
        }
      } else if (th.t >= th.dur) {
        const b = th.res.best;
        R.ovr = { until: R.t + th.res.horizon + 30, ...b.forced };
        state.think = null;
        state.nextDecide = R.t + WATCH_EVERY;
      }
      return true;
    }
    const lead = Math.max(...R.riders.filter((r) => r.team === 0).map((r) => r.s));
    if (R.t >= state.nextDecide && R.L - lead > SPRINT_M + 400 && !R.over) {
      const active = R.riders.some((r) => r.team === 0 && r.fin === null);
      if (active) {
        planner = createPlanner(R, 0, { horizon: 70 });
        state.think = { t: 0, dur: THINK_STEPS[state.settings.thinkIdx], phase: 'think', res: null };
        return true;
      }
    }
    return false;
  };

  const updateRace = (dt, input) => {
    const R = state.race, ptr = input.pointer, keys = input.keys, L = lay(), P = L.play;
    if (state.lk !== L.key) state.lk = L.key;
    const watch = R.mode === 'watch';
    if (keys.pressed.has('KeyP') || keys.pressed.has('Escape')) {
      if (state.showStand) state.showStand = false;
      else if (state.pauseMenu) closePause();
      else if (!watch) openPause();
      else state.paused = !state.paused;
    }
    if (state.pauseMenu) {
      if (flowMeta().key !== 'pause') return;
      if (ptr.pressed) state.ui.drag = { y0: ptr.y, s0: state.ui.scroll, moved: 0 };
      if (state.ui.drag && ptr.down) scrollFlow(ptr);
      if (ptr.released && state.ui.drag) {
        const d = state.ui.drag; state.ui.drag = null;
        if (d.moved < 10) handlePauseTap(hitScreen(ptr.x, ptr.y, state.ui.scroll));
      }
      return;
    }
    if (state.showStand) { if (ptr.pressed) { state.showStand = false; if (state.standFromResult) { state.standFromResult = false; state.scene = 'result'; } } return; }
    // taps
    if (ptr.pressed) {
      if (watch) {
        if (inRect(P.demo.pause, ptr.x, ptr.y)) { state.paused = !state.paused; sfx.tick(); }
        else if (inRect(P.demo.dec, ptr.x, ptr.y)) { state.settings.thinkIdx = Math.max(0, state.settings.thinkIdx - 1); sfx.tick(); save(); }
        else if (inRect(P.demo.inc, ptr.x, ptr.y)) { state.settings.thinkIdx = Math.min(THINK_STEPS.length - 1, state.settings.thinkIdx + 1); sfx.tick(); save(); }
        else if (inRect(P.demoExit, ptr.x, ptr.y)) { leaveRace(); return; }
        else if (inRect(P.top, ptr.x, ptr.y)) state.showStand = true;
      } else {
        const me = R.riders[state.sel], U = P.utilBtn;
        if (inRect(U.menu, ptr.x, ptr.y)) { openPause(); return; }
        else if (inRect(U.pause, ptr.x, ptr.y)) { state.paused = !state.paused; sfx.tick(); }
        else if (inRect(U.speed, ptr.x, ptr.y)) { state.speedIdx = (state.speedIdx + 1) % SPEEDS.length; sfx.tick(); }
        else if (inRect(U.hint, ptr.x, ptr.y)) requestHint();
        else if (state.hint && state.hint.show && hintRect(L) && inRect(hintRect(L), ptr.x, ptr.y)) applyHint();
        else if (inRect(P.top, ptr.x, ptr.y)) state.showStand = true;
        else {
          let hit = false;
          P.eff.forEach((r, i) => { if (inRect(r, ptr.x, ptr.y) && me.fin === null) { me.mode = i; me.pf = 0; hit = true; sfx.tick(); if (i === ATTACK) sfx.attack(); } });
          if (!hit) {
            mine().forEach((r, i) => { if (P.cards[i] && inRect(P.cards[i], ptr.x, ptr.y)) { selectRider(r.id); hit = true; sfx.tick(); } });
          }
          if (!hit && inRect(P.road, ptr.x, ptr.y) && R.mode !== 'tt') {
            let bestD = 60, bestId = -1;
            for (const r of mine()) { const d = Math.abs(riderX(state, L, r) - ptr.x); if (d < bestD) { bestD = d; bestId = r.id; } }
            if (bestId >= 0) selectRider(bestId);
          }
        }
      }
    }
    if (!watch) {
      const me = R.riders[state.sel];
      const mr = mine();
      for (let i = 0; i < 3; i++) if (keys.pressed.has(`Digit${i + 1}`) && mr[i]) selectRider(mr[i].id);
      if (keys.pressed.has('ArrowUp') && me.fin === null) { me.mode = Math.min(3, me.mode + 1); me.pf = 0; sfx.tick(); }
      if (keys.pressed.has('ArrowDown') && me.fin === null) { me.mode = Math.max(0, me.mode - 1); me.pf = 0; sfx.tick(); }
      if (keys.pressed.has('KeyH')) requestHint();
      if (keys.pressed.has('Enter') && state.hint && state.hint.show) applyHint();
      if (keys.pressed.has('KeyS')) state.speedIdx = (state.speedIdx + 1) % SPEEDS.length;
      if (keys.pressed.has('Space')) state.paused = !state.paused;
    } else if (keys.pressed.has('Space')) state.paused = !state.paused;

    // effects that run in real time
    if (state.toastT > 0) state.toastT -= dt;
    if (state.banner) { state.banner.t += dt; if (state.banner.t >= state.banner.dur) state.banner = null; }
    if (state.shake) { state.shake.t += dt; if (state.shake.t >= state.shake.dur) state.shake = null; }
    if (state.paused) return;
    state.anim += dt;
    // hint planner
    if (planner && !watch) {
      planner.step(2);
      if (planner.done) {
        const res = planner.result; planner = null;
        const b = res.best, hs = state.hint;
        hs.busy = false; hs.show = true; hs.result = res;
        hs.head = `Think: ${describeModes(R, b.forced)}`;
        hs.lines = res.alts.map((a, i) => `${i + 1}. ${a.label}: ${placeLine(a)}`);
        hs.lines.push('Tap this panel to give those orders.');
        hs.suggest = { ...b.forced };
      }
    }
    if (watch && updateWatchDecisions(dt)) { updateCamera(dt); return; }

    // the clock
    if (!R.over) {
      state.acc += state.rate * SPEEDS[state.speedIdx] * dt * (R.firstFin !== null && !mineAnyRacing() ? 2 : 1);
      let n = 0;
      while (state.acc >= 1 && n < 8 && !R.over) { stepRace(); state.acc -= 1; n++; }
      if (state.acc > 3) state.acc = 3;
    }
    state.alpha = clamp(state.acc, 0, 1);
    updateCamera(dt);
    if (R.over) {
      state.endT += dt;
      if (state.endT > 2.2 || (R.mode === 'watch' && state.endT > 1.2)) finishRace();
    }
  };
  const mineAnyRacing = () => state.race.riders.some((r) => (r.team === 0) && r.fin === null);

  const updateCamera = (dt) => {
    const R = state.race, c = state.cam;
    if (R.mode === 'watch') {
      // follow my best-placed rider that is still racing, switching only when another is clearly better
      const cand = R.riders.filter((r) => r.team === 0 && r.fin === null);
      const cur = R.riders[state.sel];
      if (cand.length && (cur.fin !== null || cand.some((r) => r.s > cur.s + 40))) { const b = cand.reduce((a, q) => (q.s > a.s ? q : a)); if (b.id !== state.sel) selectRider(b.id); }
    } else if (R.riders[state.sel].fin !== null) {
      const next = mine().find((r) => r.fin === null);
      if (next) selectRider(next.id);
    }
    const f = R.riders[state.sel];
    c.off *= Math.exp(-dt * 7);
    c.s = shownS(f, state.alpha) + c.off;
    const target = clamp(Math.atan(R.course.gradeAt(Math.max(0, c.s) + 30) * 2.6), -0.26, 0.34);
    c.tilt += (target - c.tilt) * Math.min(1, dt * 3);
  };

  // ---- hint ---------------------------------------------------------------------------------------
  const hintRect = (L) => { const rc = L.play.road, w = Math.min(rc.w - 24, 560); return { x: rc.x + (rc.w - w) / 2, y: rc.y + rc.h - 150, w, h: 134 }; };
  const requestHint = () => {
    const R = state.race;
    if (R.over || planner) return;
    if (state.hint && state.hint.show) { state.hint = null; return; }
    const current = {};
    for (const r of mine()) if (r.fin === null) current[r.id] = r.mode;
    planner = createPlanner(R, 0, { horizon: 50, current });
    state.hint = { busy: true, show: false, head: '', lines: [], suggest: null, result: null };
    sfx.tick();
  };
  const applyHint = () => {
    const h = state.hint;
    if (!h || !h.suggest) return;
    const R = state.race;
    for (const id of Object.keys(h.suggest)) { const r = R.riders[Number(id)]; if (r && r.fin === null && r.team === 0) { r.mode = h.suggest[id]; r.pf = 0; } }
    state.hint = null; sfx.attack();
    toast('Orders given. Think again any time.', 2.2);
  };

  // ---- pause / leaving -----------------------------------------------------------------------------
  const openPause = () => { state.paused = true; state.pauseMenu = true; state.ui.scroll = 0; };
  const closePause = () => { state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; };
  const leaveRace = () => {
    state.scene = 'title'; state.paused = false; state.pauseMenu = false; state.ui.scroll = 0;
    state.think = null; planner = null; state.hint = null; state.showStand = false; state.banner = null;
  };
  function handlePauseTap(id) {
    if (!id) return;
    sfx.tick();
    if (id === 'resume') closePause();
    else if (id === 'p-rules') { state.back = 'play'; state.scene = 'rules'; state.refScroll = 0; }
    else if (id === 'p-howto') { state.back = 'play'; state.scene = 'howto'; state.refScroll = 0; }
    else if (id === 'p-order') { closePause(); state.showStand = true; }
    else if (id === 'p-sound') { state.settings.sound = !state.settings.sound; audio.setMuted?.(!state.settings.sound); save(); }
    else if (id === 'quit') leaveRace();
  }

  // ---- menus ------------------------------------------------------------------------------------
  function scrollFlow(ptr) {
    const d = state.ui.drag, mt = flowMeta();
    d.moved = Math.max(d.moved, Math.abs(ptr.y - d.y0));
    if (d.moved >= 10 && mt.cols.length) state.ui.scroll = clamp(d.s0 - (ptr.y - d.y0), 0, mt.max);
  }
  const openSetup = (md) => { state.setup.mode = md; state.scene = 'setup'; state.ui.scroll = 0; state.setupMsg = ''; if (state.demo) { state.setup.stage = 0; state.setup.field = Math.min(state.setup.field, 1); } };
  const handleTitle = (id) => {
    if (!id) return;
    if (id === 'arcforge') { env.openArcforgeHome?.(); return; }
    sfx.tick();
    if (id === 'race') openSetup('race');
    else if (id === 'tt') openSetup('tt');
    else if (id === 'watch') openSetup('watch');
    else if (id === 'howto' || id === 'rules' || id === 'about') { state.back = 'title'; state.scene = id; state.refScroll = 0; }
    else if (id === 'settings') { state.scene = 'settings'; state.ui.scroll = 0; }
    else if (id === 'sound') { state.settings.sound = !state.settings.sound; audio.setMuted?.(!state.settings.sound); save(); }
  };
  const handleSetup = (id) => {
    if (!id) return;
    const s = state.setup;
    sfx.tick();
    if (id.startsWith('stg')) { const i = Number(id.slice(3)); if (state.demo && i > 0) { state.setupMsg = 'That stage is in the full game.'; return; } s.stage = i; state.setupMsg = ''; }
    else if (id.startsWith('fld')) { const i = Number(id.slice(3)); if (state.demo && i > 1) { state.setupMsg = 'That field is in the full game.'; return; } s.field = i; state.setupMsg = ''; }
    else if (id.startsWith('rd')) s.rider = Number(id.slice(2));
    else if (id === 'start') startRace({ mode: s.mode, stage: s.stage, field: s.field, rider: s.rider });
    else if (id === 'back') { state.scene = 'title'; state.ui.scroll = 0; }
  };
  const handleSettings = (id) => {
    if (!id) return;
    const st = state.settings;
    sfx.tick();
    if (id === 'set-sound') { st.sound = !st.sound; audio.setMuted?.(!st.sound); }
    else if (id === 'txt-dec') { st.textIdx = Math.max(0, st.textIdx - 1); applySettings(); }
    else if (id === 'txt-inc') { st.textIdx = Math.min(TEXT_SCALES.length - 1, st.textIdx + 1); applySettings(); }
    else if (id === 'think-dec') st.thinkIdx = Math.max(0, st.thinkIdx - 1);
    else if (id === 'think-inc') st.thinkIdx = Math.min(THINK_STEPS.length - 1, st.thinkIdx + 1);
    else if (id === 'restore') {
      state.restoreMsg = 'Checking with the store…';
      Promise.resolve(monetization.restore?.()).then(() => { state.restoreMsg = monetization.owns('unlock_game') ? 'Purchase restored. Thank you!' : 'No previous purchase found.'; }).catch(() => { state.restoreMsg = 'The store is not available right now.'; });
    }
    else if (id === 'back') { state.scene = 'title'; state.ui.scroll = 0; state.restoreMsg = ''; }
    save();
  };
  const handleResult = (id) => {
    if (!id) return;
    sfx.tick();
    const cfg = state.cfg;
    if (id === 'again') startRace({ ...cfg });
    else if (id === 'next') startRace({ ...cfg, stage: Math.min(STAGES.length - 1, cfg.stage + 1) });
    else if (id === 'sheet') { state.scene = 'play'; state.showStand = true; state.standFromResult = true; }
    else if (id === 'new') { state.setup.mode = cfg.mode; state.setup.stage = cfg.stage; state.scene = 'setup'; state.ui.scroll = 0; }
    else if (id === 'menu') { state.scene = 'title'; state.ui.scroll = 0; }
  };

  const updateFlowScene = (dt, input, handler, key) => {
    const ptr = input.pointer;
    if (key) ensureLayout(state, key, lay());
    if (ptr.pressed) state.ui.drag = { y0: ptr.y, x0: ptr.x, s0: state.ui.scroll, moved: 0 };
    if (state.ui.drag && ptr.down) scrollFlow(ptr);
    if (ptr.released && state.ui.drag) {
      const d = state.ui.drag; state.ui.drag = null;
      const scrollable = flowMeta().max > 0;
      if (d.moved < 10) handler(hitScreen(ptr.x, ptr.y, state.ui.scroll));
      else if (!scrollable) handler(hitScreen(d.x0, d.y0, state.ui.scroll));
    }
    const max = flowMeta().max;
    if (input.keys.pressed.has('Equal') || input.keys.pressed.has('NumpadAdd')) { state.settings.textIdx = Math.min(TEXT_SCALES.length - 1, state.settings.textIdx + 1); applySettings(); save(); }
    if (input.keys.pressed.has('Minus') || input.keys.pressed.has('NumpadSubtract')) { state.settings.textIdx = Math.max(0, state.settings.textIdx - 1); applySettings(); save(); }
    if (input.keys.down.has('ArrowDown')) state.ui.scroll = clamp(state.ui.scroll + 14, 0, max);
    if (input.keys.down.has('ArrowUp')) state.ui.scroll = clamp(state.ui.scroll - 14, 0, max);
  };

  const updateSetup = (dt, input) => {
    const ptr = input.pointer, k = input.keys;
    if (k.pressed.has('Enter')) { handleSetup('start'); return; }
    if (k.pressed.has('Escape')) { handleSetup('back'); return; }
    const pins = lay().pins;
    if (ptr.pressed && (inRect(pins.start, ptr.x, ptr.y) || inRect(pins.back, ptr.x, ptr.y))) {
      handleSetup(inRect(pins.start, ptr.x, ptr.y) ? 'start' : 'back');
      return;
    }
    updateFlowScene(dt, input, handleSetup, 'setup');
  };

  let refDrag = null;
  const updatePages = (input) => {
    const ptr = input.pointer, keys = input.keys;
    const close = () => { state.scene = state.back === 'play' ? 'play' : 'title'; state.refScroll = 0; };
    const ref = lay().ref, set = (v) => { state.refScroll = clamp(v, 0, REF.max); };
    if (ptr.pressed) {
      if (inRect(ref.next, ptr.x, ptr.y) || inRect(ref.back, ptr.x, ptr.y)) { close(); return; }
      else if (inRect(ref.dec, ptr.x, ptr.y)) { state.settings.textIdx = Math.max(0, state.settings.textIdx - 1); applySettings(); state.refScroll = 0; save(); }
      else if (inRect(ref.inc, ptr.x, ptr.y)) { state.settings.textIdx = Math.min(TEXT_SCALES.length - 1, state.settings.textIdx + 1); applySettings(); state.refScroll = 0; save(); }
      else if (inRect(ref.panel, ptr.x, ptr.y)) refDrag = { y0: ptr.y, s0: state.refScroll };
    }
    if (refDrag) { if (ptr.down) set(refDrag.s0 - (ptr.y - refDrag.y0)); else refDrag = null; }
    if (keys.pressed.has('ArrowDown')) set(state.refScroll + 70);
    if (keys.pressed.has('ArrowUp')) set(state.refScroll - 70);
    if (keys.pressed.has('PageDown') || keys.pressed.has('Space')) set(state.refScroll + REF.view * 0.9);
    if (keys.pressed.has('PageUp')) set(state.refScroll - REF.view * 0.9);
    if (keys.pressed.has('Home')) set(0);
    if (keys.pressed.has('End')) set(1e9);
    if (keys.pressed.has('Escape')) close();
  };

  return {
    // Watch & Learn and every menu are free; only real racing counts against the free preview (a paused game does not).
    isPreviewExempt: () => !(state.scene === 'play' && state.mode !== 'watch' && state.race && !state.race.over) || state.paused,
    update(dt, input) {
      setPress(input.pointer);
      state.t += dt;
      switch (state.scene) {
        case 'title': updateFlowScene(dt, input, handleTitle, 'title'); break;
        case 'setup': updateSetup(dt, input); break;
        case 'settings': updateFlowScene(dt, input, handleSettings, 'settings'); break;
        case 'result': updateFlowScene(dt, input, handleResult, 'result'); break;
        case 'demolimit': updateFlowScene(dt, input, (id) => { if (id === 'menu') { state.scene = 'title'; state.ui.scroll = 0; } }, 'demolimit'); break;
        case 'howto': case 'about': case 'rules': updatePages(input); break;
        case 'play': updateRace(dt, input); break;
        default: break;
      }
    },
    render(ctx, view) {
      const L = layoutFor(view?.width ?? meta.width, view?.height ?? meta.height);
      switch (state.scene) {
        case 'title': renderTitle(ctx, state, L); break;
        case 'setup': renderSetup(ctx, state, L); break;
        case 'settings': renderSettings(ctx, state, L); break;
        case 'result': renderResult(ctx, state, L); break;
        case 'demolimit': renderDemoLimit(ctx, state, L); break;
        case 'howto': renderPages(ctx, state, HOWTO, 'How to Play', L); break;
        case 'about': renderPages(ctx, state, ABOUT, 'About', L); break;
        case 'rules': renderPages(ctx, state, RULES, 'Rules', L); break;
        case 'play':
          renderPlay(ctx, state, L);
          if (state.pauseMenu) renderPause(ctx, state, L);
          break;
        default: break;
      }
    },
    wheel(dy) {
      if (['about', 'howto', 'rules'].includes(state.scene)) { state.refScroll = clamp((state.refScroll || 0) + dy, 0, REF.max); return; }
      if (['title', 'setup', 'settings', 'result', 'demolimit'].includes(state.scene) || state.pauseMenu) state.ui.scroll = clamp(state.ui.scroll + dy, 0, flowMeta().max);
    },
    getState: () => state,
    debug: () => ({ lockup: lockupZone(), layout: lay(), flow: flowRects(state.ui.scroll), flowMax: flowMeta().max, pages: pageCount() }),
  };
}

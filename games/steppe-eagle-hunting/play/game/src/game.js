// GAME CONTRACT (docs/GAME-CONTRACT.md): export meta + createGame(env) -> { update, render, getState }.
// Steppe Eagle Hunting (berkutchi): track a fox on the winter steppe, release the eagle at the right moment, steer it through the wind,
// stoop, and call it back to the glove. The fox is a silhouette and always slips away; only the flying is scored.
// State machine: title / setup / settings / howto / about / rules / play / result / demolimit. Play phases (m.ph):
//   intro -> [think -> reveal] -> ride (the hunt itself, see sim.js phases) -> sum -> intro ... -> over
import {
  K, RIDERS, newHunt, stepHunt, aiInput, aiParams, planRelease, previewMiss, bestStoop, windAt, windWords,
} from './sim.js';
import { FR, setFrame, TEXT_SCALES, THINK_STEPS, REVEAL_SECS, playLayout, readerLayout, inRect } from './layout.js';
import { geom, unproj, emit, stepFx, proj, horizonY } from './art.js';
import { camTarget, stepCam, camSnap, use3d } from './cam3d.js';
import { setPress } from './ui.js';
import { renderTitle, renderFlow, renderModal, renderReader, hitFlow, flowMax, readerState, flowRects, unlockedCount } from './menus.js';
import { renderPlay, isHumanSide, releaseOk, REST_CAM_Z, recallSpot } from './view.js';
import { pressLockup } from './brand.js';

export const meta = { width: 720, height: 1280, fluid: { short: 720 } };

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const NOINPUT = { pointer: { x: -1, y: -1, down: false, pressed: false, released: false }, keys: { down: new Set(), pressed: new Set() }, wheel: { dx: 0, dy: 0 } };
const DEMO_OUTINGS = 1, DEMO_HUNTS = 3;
const SNOW = ['#ffffff', '#e4eeff', '#cfdcf5'];

export function createGame(env) {
  const { rng, storage, monetization, audio, config } = env;
  let shotMode = false;
  try { shotMode = /[?&]shot=/.test(globalThis.location.search); } catch { shotMode = false; }

  const state = {
    scene: 'title', t: 0, shot: false, demo: !!config.demo, layKey: '',
    settings: { textIdx: 0, thinkIdx: 1, sound: true, guide: true, plum: 0 },
    record: { outings: 0, best: 0, hunts: 0, perfects: 0, dens: 0, career: 0, demoGames: 0 },
    setup: { mode: 'solo', level: 1, opp: 1 },
    ui: { scroll: 0, drag: null, page: 0, back: 'title' },
    m: null, resume: null, prevBest: 0,
    cam: { x: 0, z: REST_CAM_Z, y: 5.2, yaw: 0, pitch: 0.12 }, fx: [], floats: [], shake: 0, paused: false, pauseMenu: false, hint: null, cue: null, cueT: 0,
  };
  const frand = () => rng.next();
  state.owned = !!monetization.owns?.('unlock_game');
  state.restoreMsg = ''; state.restoreBusy = false;
  monetization.onChange?.(() => { state.owned = !!monetization.owns('unlock_game'); });

  // ---- saving ------------------------------------------------------------------------------------------------------------------
  const saveSettings = () => storage.set('settings', state.settings);
  const saveRecord = () => storage.set('record', state.record);
  const snapshot = (m) => ({ cfg: m.cfg, i: m.i, side: m.side, nSides: m.nSides, nHunts: m.nHunts, seedBase: m.seedBase, totals: m.totals, hunts: m.hunts });
  const saveResume = () => { const m = state.m; if (m && m.cfg.mode !== 'watch' && m.ph !== 'over') { state.resume = JSON.parse(JSON.stringify(snapshot(m))); storage.set('resume', state.resume); } };
  const clearResume = () => { state.resume = null; storage.remove('resume'); };
  Promise.all([storage.get('settings', null), storage.get('record', null), storage.get('resume', null)]).then(([s, r, res]) => {
    if (s) Object.assign(state.settings, s);
    if (r) Object.assign(state.record, r);
    if (res && res.cfg && res.seedBase !== undefined && !shotMode) state.resume = res;
    audio.setMuted(!state.settings.sound);
  });

  // ---- sound -------------------------------------------------------------------------------------------------------------------
  let budget = 0;
  const tone = (o) => { if (budget < 4) { budget++; audio.tone(o); } };
  const sfx = {
    whoosh: () => tone({ freq: 520, to: 180, dur: 0.4, type: 'sine', vol: 0.08 }),
    dive: () => tone({ freq: 900, to: 160, dur: 0.55, type: 'sawtooth', vol: 0.05 }),
    alert: () => tone({ freq: 1500, to: 1100, dur: 0.1, type: 'square', vol: 0.05 }),
    puff: () => tone({ freq: 300, to: 70, dur: 0.22, type: 'sine', vol: 0.22 }),
    ring: () => [523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, dur: 0.14 + i * 0.03, type: 'triangle', vol: 0.11 })),
    soft: () => tone({ freq: 330, to: 220, dur: 0.3, type: 'sine', vol: 0.12 }),
    tick: () => tone({ freq: 900, dur: 0.04, type: 'square', vol: 0.04 }),
    call: (q) => tone({ freq: q === 0 ? 1175 : q === 1 ? 880 : q === 2 ? 660 : 220, dur: 0.12, type: 'triangle', vol: 0.12 }),
    win: () => [523, 659, 784, 1047].forEach((f) => tone({ freq: f, dur: 0.2, type: 'triangle', vol: 0.12 })),
  };

  // ---- an outing -------------------------------------------------------------------------------------------------------------------
  const riderOf = (m) => (m.cfg.mode === 'watch' ? RIDERS[m.cfg.watch] : m.cfg.mode === 'ai' && m.side === 1 ? RIDERS[m.cfg.opp] : null);
  const floatAt = (x, y, text, col, o = {}) => state.floats.push({ x, y, text, col, t: 0, life: o.life ?? 1.3, size: o.size ?? 40, big: !!o.big });
  const banner = (text, sub, col) => { state.m.banner = { text, sub, col, t: 0, life: 1.7 }; };

  const newMatch = (cfg, from = null) => {
    const demo = state.demo && cfg.mode !== 'watch';
    const m = from ? { ...from, cfg } : {
      cfg, i: 0, side: 0, nSides: cfg.mode === 'ai' || cfg.mode === 'two' ? 2 : 1, nHunts: demo ? DEMO_HUNTS : K.HUNTS,
      seedBase: rng.int(1 << 28) + 1, totals: [0, 0], hunts: [],
    };
    Object.assign(m, { h: null, ph: 'intro', pt: 0, plan: null, ai: null, last: null, banner: null, steerAt: null, winner: -1, thinkDur: 3, tapT: -9, tapX: 0, tapY: 0, pdown: false, prevPh: 'track', prevMode: 'listen', tapsSeen: 0 });
    return m;
  };
  const startMatch = (cfg, from = null) => {
    if (state.demo && cfg.mode !== 'watch' && !from && state.record.demoGames >= DEMO_OUTINGS) { state.scene = 'demolimit'; state.ui.scroll = 0; return; }
    state.prevBest = state.record.best;
    state.m = newMatch(cfg, from);
    state.scene = 'play'; state.ui.scroll = 0; state.paused = false; state.pauseMenu = false; state.hint = null; state.cue = null; state.fx = []; state.floats = []; state.shake = 0;
    if (!from && state.demo && cfg.mode !== 'watch') { state.record.demoGames++; saveRecord(); }
    if (cfg.mode !== 'watch') monetization.track('outing_start', { mode: cfg.mode });
    beginHunt();
  };
  const beginHunt = () => {
    const m = state.m;
    m.h = newHunt(m.seedBase + m.i * 1013, m.i, m.cfg.level);
    Object.assign(m, { ph: 'intro', pt: 0, plan: null, ai: null, steerAt: null, last: null, banner: null, prevPh: 'track', prevMode: 'listen', tapsSeen: 0, pdown: false });
    state.hint = null; state.cue = null; state.floats = []; state.fx = [];
    state.cam = { x: 0, z: REST_CAM_Z, y: 5.2, yaw: 0, pitch: 0.12 };
  };

  // The computer riders plan on copies of the hunt, then play it live with the same controls a person has.
  const planFor = (m, rider) => {
    const h = m.h;
    const thinkDur = m.cfg.mode === 'watch' ? THINK_STEPS[state.settings.thinkIdx] : rider.think[0] + frand() * (rider.think[1] - rider.think[0]);
    const best = planRelease(h, rider, { from: h.t + thinkDur + REVEAL_SECS + 0.4 });
    m.ai = aiParams(rider, best.tRel, rng.int(1 << 30) + 1);
    m.thinkDur = thinkDur;
    const r = best.rel;
    m.plan = {
      tRel: best.tRel, expected: Math.round(best.expected),
      text: r
        ? `Release about ${Math.max(0, Math.round(best.tRel - h.t))} s from now. The fox should be ${Math.round(r.range)} m away and ${Math.round(r.denDist)} m from its den, with the wind ${windWords(r.wind)}. A stoop at about 30 m should score around ${Math.round(best.expected)} points.`
        : 'Waiting for the fox to come out into the open.',
    };
  };

  const foxScreen = () => {
    const g = geom(FR.w, FR.h), f = state.m.h.fox, p = proj(g, state.cam, f.x, f.z);
    return { x: p.x, y: p.gy - 30 * g.unit * p.s };
  };

  // Called after every hunt step: sounds, effects and bookkeeping for what just happened.
  const reactToHunt = () => {
    const m = state.m, h = m.h, fox = h.fox;
    if (m.prevPh !== h.ph) {
      const was = m.prevPh;
      if (was === 'track' && h.ph === 'fly') { sfx.whoosh(); floatAt(FR.w / 2, FR.h * 0.38, 'Released', '#f4f8ff', { size: 40 }); }
      if (h.ph === 'stoop') sfx.dive();
      if (h.ph === 'strike' && h.res) {
        const s = foxScreen(), res = h.res;
        if (res.kind === 'pass') {
          sfx.puff(); state.shake = 1;
          emit(state.fx, 'puff', s.x, s.y + 10, 22, frand, { speed: 240, size: 18, life: 1.0, up: 60, cols: SNOW });
          if (res.cls === 'perfect') { sfx.ring(); banner('PERFECT PASS!', `${res.miss.toFixed(1)} m`, '#ffe08a'); }
          else if (res.cls === 'miss') { sfx.soft(); banner('MISSED', 'out of reach', '#ffb3a0'); }
          else banner(`${res.name.toUpperCase()}!`, `${res.miss.toFixed(1)} m`, res.cls === 'clean' ? '#b8f5c8' : '#f4f8ff');
          floatAt(s.x, s.y - 30, `+${res.pts}`, '#ffe08a', { size: 52, big: true });
        } else {
          sfx.soft();
          emit(state.fx, 'puff', s.x, s.y + 10, 12, frand, { speed: 140, size: 12, life: 0.8, up: 30, cols: SNOW });
          banner('TO THE DEN', 'the fox got home first', '#ffb3a0');
        }
      }
      if (h.ph === 'recall') sfx.tick();
      if (h.ph === 'done') {
        const sc = h.score;
        m.last = sc;
        m.hunts[m.i] = m.hunts[m.i] || [];
        m.hunts[m.i][m.side] = sc;
        m.totals[m.side] += sc.total;
        if (m.cfg.mode !== 'watch' && isHumanSide(m)) {
          const r = state.record; r.hunts++; r.career += sc.total;
          if (sc.cls === 'perfect') r.perfects++;
          if (sc.cls === 'den') r.dens++;
          saveRecord();
        }
        m.ph = 'sum'; m.pt = 0; state.hint = null; state.ui.scroll = 0;
      }
      m.prevPh = h.ph;
    }
    if (m.prevMode !== fox.mode) {
      if (fox.mode === 'bolt' && m.prevMode !== 'bwarn' && m.prevMode !== 'dodge') { sfx.alert(); const s = foxScreen(); floatAt(s.x, s.y - 40, '!', '#ffe08a', { size: 46 }); }
      m.prevMode = fox.mode;
    }
    if (h.rc) {
      const done = h.rc.taps.filter((x) => x);
      if (done.length > m.tapsSeen) {
        const q = done[done.length - 1].q, sp = recallSpot(playLayout());
        sfx.call(q); m.tapsSeen = done.length;
        floatAt(sp.x, sp.y - 20, ['Perfect!', 'Good', 'Late', 'Missed'][q], ['#7dffb0', '#ffe08a', '#ffb98a', '#ff8a7a'][q], { size: 40, life: 1.0 });
      }
    }
  };

  const finishMatch = () => {
    const m = state.m, r = state.record;
    m.ph = 'over'; m.pt = 0;
    if (m.nSides === 1) m.winner = 0;
    else m.winner = m.totals[0] === m.totals[1] ? -1 : m.totals[0] > m.totals[1] ? 0 : 1;
    if (m.cfg.mode !== 'watch') {
      r.outings++;
      if (m.cfg.mode === 'solo') r.best = Math.max(r.best, m.totals[0]);
      saveRecord(); clearResume();
      monetization.track('outing_end', { mode: m.cfg.mode, score: m.totals[0] });
    }
    sfx.win();
  };

  const nextHunt = () => {
    const m = state.m;
    if (m.side < m.nSides - 1) m.side++;
    else { m.side = 0; m.i++; }
    if (m.i >= m.nHunts) { finishMatch(); return; }
    saveResume();
    beginHunt();
  };

  // ---- input helpers ---------------------------------------------------------------------------------------------------------------
  const openPause = () => { const m = state.m; if (state.scene !== 'play' || !m || m.ph === 'over') return; state.paused = true; if (m.cfg.mode !== 'watch') { state.pauseMenu = true; state.ui.scroll = 0; m.pdown = false; m.steerAt = null; } };
  const closePause = () => { state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; };
  const toTitle = () => { saveResume(); state.scene = 'title'; state.m = null; state.paused = false; state.pauseMenu = false; state.hint = null; state.ui.scroll = 0; };
  const openReader = (scene, back) => { state.scene = scene; state.ui.back = back; state.ui.page = 0; state.ui.scroll = 0; state.ui.drag = null; };

  const HINT_RIDER = { name: 'You', sigmaRel: 0, thr: 3.5, react: 0.4, lockCap: 0.9, steer: true, jit: 0, think: [0, 0] };
  const think = () => {
    const m = state.m, h = m && m.h;
    if (!m || !h || !isHumanSide(m) || m.ph !== 'ride') return;
    if (h.ph === 'track') {
      const best = planRelease(h, HINT_RIDER, { from: h.t + 0.3 });
      const r = best.rel, wait = Math.max(0, best.tRel - h.t);
      let text;
      if (!r) text = 'The fox is not coming out into the open in the time left. Release when it is farthest from its den.';
      else if (wait < 0.8 && releaseOk(h)) text = `Release now. The fox is ${Math.round(r.range)} m away and ${Math.round(r.denDist)} m from its den; in tests a stoop at about 30 m scored around ${Math.round(best.expected)} points.`;
      else text = `Wait about ${Math.round(wait)} s. By then the fox should be ${Math.round(r.range)} m away and ${Math.round(r.denDist)} m from its den, in open snow, with the wind ${windWords(r.wind)}. Tests scored around ${Math.round(best.expected)} points.`;
      state.hint = { kind: 'release', text };
    } else if (h.ph === 'fly') {
      const b = bestStoop(h), d = Math.round(Math.hypot(h.fox.x - h.eagle.x, h.fox.z - h.eagle.z));
      let text;
      if (b && b.miss <= 3 && b.inS < 0.2) text = `Stoop now. The fox is ${d} m ahead; in a test dive the eagle passed within ${b.miss.toFixed(1)} m.`;
      else if (b && b.miss <= 6 && b.inS <= 1.5) text = `Stoop in about ${b.inS.toFixed(1)} s. The fox is ${d} m ahead; the best test dive passed within ${b.miss.toFixed(1)} m.`;
      else text = `The fox is ${d} m ahead. Keep closing; a stoop works best when it is about 30 m ahead. Wind ${windWords(windAt(h, h.t))}.`;
      state.hint = { kind: 'stoop', text };
    }
  };

  const scrollPointer = (ptr, input, max, hit) => {
    const ui = state.ui;
    if (input.wheel && input.wheel.dy) ui.scroll = clamp(ui.scroll + input.wheel.dy, 0, max);
    if (ptr.pressed) ui.drag = { y0: ptr.y, s0: ui.scroll, x0: ptr.x, moved: false };
    if (ui.drag && ptr.down) {
      if (Math.abs(ptr.y - ui.drag.y0) > 10) ui.drag.moved = true;
      if (ui.drag.moved) ui.scroll = clamp(ui.drag.s0 - (ptr.y - ui.drag.y0), 0, max);
    }
    if (ptr.released && ui.drag) {
      const d = ui.drag; ui.drag = null;
      if (!d.moved) return hit(d.x0, d.y0);
    }
    return null;
  };

  const startSetup = (mode) => { state.setup.mode = mode; state.scene = 'setup'; state.ui.scroll = 0; };
  const onTitle = (id) => {
    if (id === 'solo' || id === 'ai' || id === 'two') startSetup(id);
    else if (id === 'watch') startMatch({ mode: 'watch', level: 1, watch: 2 });
    else if (id === 'resume' && state.resume) startMatch(state.resume.cfg, JSON.parse(JSON.stringify(state.resume)));
    else if (id === 'howto' || id === 'rules' || id === 'about') openReader(id, 'title');
    else if (id === 'settings') { state.scene = 'settings'; state.ui.back = 'title'; state.ui.scroll = 0; }
    else if (id === 'arcforge') { pressLockup(); env.openArcforgeHome?.(); }
  };
  const onSetup = (id) => {
    const s = state.setup;
    if (/^lv\d$/.test(id)) s.level = Number(id[2]);
    else if (/^rv\d$/.test(id)) s.opp = Number(id[2]);
    else if (id === 'start') startMatch({ mode: s.mode, level: s.level, opp: s.opp });
    else if (id === 'back') { state.scene = 'title'; state.ui.scroll = 0; }
  };
  const onSettings = (id) => {
    const st = state.settings, un = unlockedCount(state.record.career);
    if (id === 'dec') st.textIdx = Math.max(0, st.textIdx - 1);
    else if (id === 'inc') st.textIdx = Math.min(TEXT_SCALES.length - 1, st.textIdx + 1);
    else if (id === 'sound') { st.sound = !st.sound; audio.setMuted(!st.sound); }
    else if (id === 'guide') st.guide = !st.guide;
    else if (id === 'think') st.thinkIdx = (st.thinkIdx + 1) % THINK_STEPS.length;
    else if (id === 'eagle') st.plum = (Math.min(st.plum, un - 1) + 1) % un;
    else if (id === 'restore' && !state.restoreBusy && !state.owned) {
      state.restoreBusy = true; state.restoreMsg = 'Checking with the store...';
      Promise.resolve().then(() => monetization.restore()).then(() => {
        state.owned = !!monetization.owns('unlock_game');
        state.restoreMsg = state.owned ? 'Purchase restored' : 'No earlier purchase found';
      }).catch(() => { state.restoreMsg = 'Could not reach the store. Try again later.'; }).finally(() => { state.restoreBusy = false; });
    }
    else if (id === 'back') { state.scene = 'title'; state.ui.scroll = 0; }
    saveSettings();
  };
  const onResult = (id) => {
    if (id === 'again') startMatch(state.m.cfg);
    else if (id === 'menu') { state.scene = 'title'; state.m = null; state.ui.scroll = 0; }
    else if (id === 'arcforge') { pressLockup(); env.openArcforgeHome?.(); }
  };
  const onPause = (id) => {
    if (id === 'resume') closePause();
    else if (id === 'rules') { state.pauseMenu = false; openReader('rules', 'play'); }
    else if (id === 'sound') { state.settings.sound = !state.settings.sound; audio.setMuted(!state.settings.sound); saveSettings(); }
    else if (id === 'quit') toTitle();
  };

  const updateFlow = (scene, input, handler) => {
    const id = scrollPointer(input.pointer, input, flowMax(state, scene), (x, y) => hitFlow(state, scene, x, y, state.ui.scroll));
    if (id) handler(id);
    if (input.keys.pressed.has('Escape') && (scene === 'setup' || scene === 'settings')) { state.scene = 'title'; state.ui.scroll = 0; }
  };

  const updateReader = (input) => {
    const ptr = input.pointer, scene = state.scene, rs = readerState(state, scene), L = rs.L;
    const id = scrollPointer(ptr, input, rs.max, (x, y) => {
      if (inRect(L.dec, x, y)) return 'dec'; if (inRect(L.inc, x, y)) return 'inc'; if (inRect(L.back, x, y)) return 'back'; if (inRect(L.next, x, y)) return 'next';
      return null;
    });
    const n = rs.doc.list.length;
    const goBack = () => { if (state.ui.back === 'play') { state.scene = 'play'; state.pauseMenu = true; } else state.scene = 'title'; state.ui.scroll = 0; };
    if (id === 'dec' || id === 'inc') { state.settings.textIdx = clamp(state.settings.textIdx + (id === 'inc' ? 1 : -1), 0, TEXT_SCALES.length - 1); state.ui.scroll = 0; saveSettings(); }
    else if (id === 'back') { if (state.ui.page === 0) goBack(); else { state.ui.page--; state.ui.scroll = 0; } }
    else if (id === 'next') { if (state.ui.page >= n - 1) goBack(); else { state.ui.page++; state.ui.scroll = 0; } }
    if (input.keys.pressed.has('Escape')) goBack();
    if (input.keys.pressed.has('ArrowRight')) { state.ui.page = Math.min(n - 1, state.ui.page + 1); state.ui.scroll = 0; }
    if (input.keys.pressed.has('ArrowLeft')) { state.ui.page = Math.max(0, state.ui.page - 1); state.ui.scroll = 0; }
  };

  // ---- play ------------------------------------------------------------------------------------------------------------------------
  const updateAmbient = (dt) => {
    stepFx(state.fx, dt);
    for (const f of state.floats) f.t += dt;
    state.floats = state.floats.filter((f) => f.t < f.life);
    state.shake = Math.max(0, state.shake - dt * 3.2);
    const m = state.m;
    if (m && m.banner) { m.banner.t += dt; if (m.banner.t > m.banner.life) m.banner = null; }
    // the camera waits behind the rider and chases the eagle in the air
    const h = m && m.h;
    if (h) {
      let rate = 2.4, yawRate = 1.1;
      if (h.ph === 'fly' || h.ph === 'stoop') { rate = 5; yawRate = 3.2; }
      else if (h.ph === 'strike') { rate = 4; yawRate = 2.6; }
      else if (h.ph === 'recall') { rate = 1.6; yawRate = 1.2; }
      stepCam(state.cam, camTarget(h, REST_CAM_Z), dt, rate, yawRate);
    }
  };

  // What a person's thumb and keys do to the hunt this tick.
  const humanInput = (dt, input, L, hit) => {
    const m = state.m, h = m.h, ptr = input.pointer, kd = input.keys.down, kp = input.keys.pressed;
    const g = geom(FR.w, FR.h), inp = {};
    const onUi = (x, y) => inRect(L.action, x, y) || inRect(L.think, x, y) || inRect(L.pause, x, y);
    // A thumb that started on the steppe keeps steering even if it slides over a button; a press that started on a button never steers.
    if (ptr.pressed || (ptr.down && !m.pstart)) m.pstart = !onUi(ptr.x, ptr.y) && ptr.y > (use3d() ? horizonY(g, state.cam) : g.horizon) - 30 ? 'scene' : 'ui';
    if (!ptr.down) m.pstart = null;
    const scene = ptr.down && m.pstart === 'scene';
    m.pdown = !!scene;
    if (hit === 'action' || kp.has('Space') || kp.has('Enter')) inp.act = true;
    if (h.ph === 'track') {
      if (scene) { const p = unproj(g, state.cam, ptr.x, ptr.y); inp.sight = { x: clamp(p.x, -140, 140), z: clamp(p.z, 10, 320) }; if (state.hint) state.hint = null; }
      else {
        let dx = 0, dz = 0;
        if (kd.has('ArrowLeft')) dx -= 1;
        if (kd.has('ArrowRight')) dx += 1;
        if (kd.has('ArrowUp')) dz += 1;
        if (kd.has('ArrowDown')) dz -= 1;
        if (dx || dz) inp.sight = { x: h.sight.x + dx * 60 * dt, z: h.sight.z + dz * 60 * dt };
      }
      if (kp.has('KeyT')) { if (state.hint) state.hint = null; else think(); }
      if (inp.act && state.hint) state.hint = null;
    } else if (h.ph === 'fly' || h.ph === 'stoop') {
      if (ptr.pressed && !onUi(ptr.x, ptr.y)) { m.tapT = state.t; m.tapX = ptr.x; m.tapY = ptr.y; }
      if (scene) {
        const p = unproj(g, state.cam, ptr.x, ptr.y);
        m.steerAt = { x: clamp(p.x, -160, 160), z: clamp(Math.max(p.z, h.eagle.z + 6), 10, 340) };
        inp.aim = m.steerAt;
      } else {
        m.steerAt = null;
        const dir = (kd.has('ArrowRight') ? 1 : 0) - (kd.has('ArrowLeft') ? 1 : 0);
        if (dir) { inp.aim = { x: h.eagle.x + dir * 50, z: h.eagle.z + 70 }; m.steerAt = inp.aim; }
      }
      if (ptr.released && state.t - m.tapT < 0.24 && Math.hypot(ptr.x - m.tapX, ptr.y - m.tapY) < 18 && h.ph === 'fly') inp.act = true;
      if (kp.has('KeyT')) { if (state.hint) state.hint = null; else think(); }
      if (inp.act && state.hint) state.hint = null;
    } else if (h.ph === 'recall') {
      if (ptr.pressed && !onUi(ptr.x, ptr.y)) inp.act = true;
      m.steerAt = null;
    } else m.steerAt = null;
    return inp;
  };

  const updatePlay = (dt, input) => {
    const m = state.m, ptr = input.pointer, L = playLayout();
    const watch = m.cfg.mode === 'watch';
    if (input.keys.pressed.has('Escape') || input.keys.pressed.has('KeyP')) { if (state.paused) { if (watch) state.paused = false; else closePause(); } else openPause(); }
    if (state.pauseMenu) {
      const id = scrollPointer(ptr, input, flowMax(state, 'pause'), (x, y) => hitFlow(state, 'pause', x, y, state.ui.scroll));
      if (id) onPause(id);
      return;
    }
    let hit = null;
    if (ptr.pressed) {
      if (inRect(L.think, ptr.x, ptr.y)) hit = 'think';
      else if (inRect(L.pause, ptr.x, ptr.y)) hit = 'pause';
      else if (!watch && m.ph !== 'sum' && inRect(L.action, ptr.x, ptr.y)) hit = 'action';
    }
    if (m.ph !== 'sum' || watch) {
      if (hit === 'pause') { if (watch) { state.scene = 'title'; state.m = null; state.paused = false; return; } openPause(); return; }
      if (hit === 'think') { if (watch) state.paused = !state.paused; else if (state.hint) state.hint = null; else think(); return; }
    }
    if (state.paused) return;

    const h = m.h;
    updateAmbient(dt);
    m.pt += dt;
    const human = isHumanSide(m);
    switch (m.ph) {
      case 'intro':
        if (m.pt >= 1.4) {
          if (human) { m.ph = 'ride'; m.pt = 0; }
          else { planFor(m, riderOf(m)); m.ph = 'think'; m.pt = 0; sfx.tick(); }
        }
        break;
      case 'think': case 'reveal':
        h.cap = riderOf(m).lockCap;
        stepHunt(h, dt, { sight: { x: h.fox.x, z: h.fox.z } });
        if (m.ph === 'think' && m.pt >= m.thinkDur) { m.ph = 'reveal'; m.pt = 0; sfx.tick(); }
        else if (m.ph === 'reveal' && m.pt >= REVEAL_SECS) { m.ph = 'ride'; m.pt = 0; }
        reactToHunt();
        break;
      case 'ride': {
        let inp;
        if (human) inp = humanInput(dt, input, L, hit);
        else { h.cap = riderOf(m).lockCap; inp = aiInput(h, m.ai); }
        if (state.settings.guide && human && h.ph === 'fly') {
          state.cueT -= dt;
          if (state.cueT <= 0) {
            state.cueT = 0.12;
            const d = Math.hypot(h.eagle.x - h.fox.x, h.eagle.z - h.fox.z);
            state.cue = d < 95 ? { miss: previewMiss(h), d } : null;
          }
        } else if (h.ph !== 'fly') state.cue = null;
        stepHunt(h, dt, inp);
        reactToHunt();
        break;
      }
      case 'sum': {
        if (watch) { if (m.pt >= 5) nextHunt(); }
        else {
          const id = scrollPointer(ptr, input, flowMax(state, 'sum'), (x, y) => hitFlow(state, 'sum', x, y, state.ui.scroll));
          if (id === 'next' || input.keys.pressed.has('Enter') || input.keys.pressed.has('Space')) nextHunt();
        }
        break;
      }
      case 'over':
        if (m.pt >= 1.2) { state.scene = 'result'; state.ui.scroll = 0; state.paused = false; }
        break;
      default: break;
    }
  };

  // ---- store screenshots: ?shot=1&seed=N picks a fixed screen ----------------------------------------------------------------------
  const applyPreset = () => {
    const n = Number(config.seed) || 1;
    state.shot = true;
    const ride = (cfg, until, o = {}) => {
      startMatch(cfg);
      const m = state.m;
      let ok = false;
      // try a few hunts of the outing until one reaches the wanted moment (not every fox gives a stoop)
      for (let attempt = 0; attempt < 6 && !ok; attempt++) {
        m.i = attempt; beginHunt();
        const h = m.h;
        h.cap = 0.97;
        const P = aiParams(RIDERS[2], o.tRel ?? planRelease(h, RIDERS[2]).tRel, 77);
        if (o.tRel === undefined) { P.sm = 0; P.jit = [0, 0, 0]; P.pg = null; }
        let guard = 0;
        while (!until(h) && h.ph !== 'done' && guard++ < 60 * 90) stepHunt(h, 1 / 60, aiInput(h, P));
        ok = until(h);
      }
      const h = m.h;
      m.ph = 'ride'; m.prevPh = h.ph; m.prevMode = h.fox.mode;
      state.cam = { x: 0, z: REST_CAM_Z, y: 5.2, yaw: 0, pitch: 0.12 };
      camSnap(state.cam, camTarget(h, REST_CAM_Z));
      if (h.ph === 'done') { m.ph = 'sum'; m.last = h.score; }
      state.paused = false;
    };
    const cfg = { mode: 'solo', level: 1 };
    if (n === 1) { state.scene = 'title'; return; }
    if (n === 2) { ride(cfg, (h) => h.t >= 9, { tRel: 90 }); return; }
    if (n === 3) { ride(cfg, (h) => h.ph === 'fly' && Math.hypot(h.eagle.x - h.fox.x, h.eagle.z - h.fox.z) < 85, {}); return; }
    if (n === 4) { ride(cfg, (h) => h.ph === 'stoop' && h.st.t > 0.3, {}); return; }
    if (n === 5) { ride(cfg, (h) => h.ph === 'recall' && h.rc.t > 3.7, {}); return; }
    if (n === 6) {
      // a real outing: five hunts played through by the master rider, then the result screen
      startMatch(cfg);
      const m = state.m;
      for (let i = 0; i < m.nHunts; i++) {
        m.i = i; beginHunt();
        const h = m.h; h.cap = RIDERS[2].lockCap;
        const P = aiParams(RIDERS[2], planRelease(h, RIDERS[2]).tRel, 77 + i);
        let guard = 0;
        while (h.ph !== 'done' && guard++ < 60 * 120) stepHunt(h, 1 / 60, aiInput(h, P));
        m.hunts[i] = [h.score]; m.totals[0] += h.score.total; m.last = h.score;
      }
      m.winner = 0; m.ph = 'over'; state.scene = 'result';
      return;
    }
    if (n >= 7 && n <= 9) { state.scene = ['rules', 'howto', 'about'][n - 7]; state.ui.page = n === 7 ? 3 : 0; state.ui.back = 'title'; return; }
    if (n === 10) {
      startMatch({ mode: 'watch', level: 1, watch: 2 });
      const m = state.m; planFor(m, RIDERS[2]);
      const h = m.h; h.cap = 0.97;
      for (let i = 0; i < 60 * 4; i++) stepHunt(h, 1 / 60, { sight: { x: h.fox.x, z: h.fox.z } });
      m.ph = 'reveal'; m.pt = 0.5; return;
    }
    if (n === 11) { state.scene = 'settings'; return; }
    if (n === 12) { state.setup.mode = 'ai'; state.scene = 'setup'; return; }
    if (n === 13) { state.settings.textIdx = 4; state.scene = 'rules'; state.ui.page = 3; return; }
    if (n === 14) { ride({ mode: 'solo', level: 2 }, (h) => h.ph === 'fly' && Math.hypot(h.eagle.x - h.fox.x, h.eagle.z - h.fox.z) < 45, {}); return; }
    if (n === 15) { ride(cfg, (h) => h.t >= 6, { tRel: 90 }); state.pauseMenu = true; state.paused = true; return; }
    if (n === 16) { ride(cfg, (h) => h.ph === 'done', {}); return; }
    if (n === 17) { ride(cfg, (h) => h.ph === 'strike' && h.pt > 0.35, {}); return; }
    if (n === 18) { ride(cfg, (h) => h.ph === 'recall' && h.rc.t > 1.2, {}); return; }
    if (n === 19) { ride(cfg, (h) => h.ph === 'recall' && h.rc.t > 4.6, {}); return; }
    if (n === 20) { ride(cfg, (h) => h.ph === 'fly' && h.t - h.rel.t > 0.25, {}); return; }
    ride(cfg, (h) => h.t >= 3, { tRel: 90 });
  };

  // ---- the object the kit and the shell see ----------------------------------------------------------------------------------------
  const game = {
    // Only live action uses up the free preview: a thumb on the steppe while tracking, and the eagle in the air, stooping or returning.
    // Menus, rules, settings, hints, Watch & Learn, computer riders, pause and results are free. A tester build (config.dev) never uses it up.
    isPreviewExempt: () => {
      if (config.dev) return true;
      const m = state.m;
      if (state.scene !== 'play' || !m || m.cfg.mode === 'watch') return true;
      if (state.paused || state.pauseMenu || state.hint) return true;
      if (!isHumanSide(m) || m.ph !== 'ride' || !m.h) return true;
      const p = m.h.ph;
      if (p === 'fly' || p === 'stoop' || p === 'strike' || p === 'recall') return false;
      return !m.pdown;
    },
    update(dt, input) {
      if (state.shot) input = NOINPUT;
      setFrame(meta.width, meta.height);
      config.textScale = TEXT_SCALES[state.settings.textIdx];
      if (state.layKey !== FR.key) {
        if (state.layKey && state.m) { state.m.pdown = false; state.m.pstart = null; state.m.steerAt = null; state.ui.drag = null; }
        state.layKey = FR.key;
      }
      budget = 0;
      // keep the free-preview pill clear of the scoreboard and the status line
      { const L = playLayout();
        meta.previewBadge = L.land ? { x: L.hud.x, y: L.hud.y + L.hud.h + 10, align: 'left' } : { x: L.hud.x + L.hud.w, y: L.hud.y + L.hud.h + 56, align: 'right' }; }
      setPress(input.pointer);
      if (state.shot) { state.t += dt; return; }
      if (!(state.paused && state.scene === 'play')) state.t += dt;
      switch (state.scene) {
        case 'title': updateFlow('title', input, onTitle); break;
        case 'setup': updateFlow('setup', input, onSetup); break;
        case 'settings': updateFlow('settings', input, onSettings); break;
        case 'result': updateFlow('result', input, onResult); break;
        case 'demolimit': updateFlow('demolimit', input, (id) => { if (id === 'menu') { state.scene = 'title'; state.ui.scroll = 0; } }); break;
        case 'howto': case 'about': case 'rules': updateReader(input); break;
        case 'play': if (state.m) updatePlay(dt, input); else state.scene = 'title'; break;
        default: break;
      }
    },
    render(ctx) {
      setFrame(meta.width, meta.height);
      switch (state.scene) {
        case 'title': renderTitle(ctx, state); break;
        case 'setup': renderFlow(ctx, state, 'setup'); break;
        case 'settings': renderFlow(ctx, state, 'settings'); break;
        case 'result': renderFlow(ctx, state, 'result', 0.5); break;
        case 'demolimit': renderFlow(ctx, state, 'demolimit'); break;
        case 'howto': case 'about': case 'rules': renderReader(ctx, state, state.scene); break;
        case 'play':
          if (state.m) {
            renderPlay(ctx, state);
            if (state.pauseMenu) renderModal(ctx, state, 'pause');
            else if (state.m.ph === 'sum' && state.m.cfg.mode !== 'watch') renderModal(ctx, state, 'sum');
          }
          break;
        default: break;
      }
    },
    getState: () => state,
    // Every tappable rectangle of the current screen (layout checks in the headless-browser matrix). No gameplay use.
    getRects() {
      const out = [], sc = state.scene;
      if (sc === 'play') {
        const L = playLayout();
        if (state.pauseMenu) out.push(...flowRects(state, 'pause', state.ui.scroll));
        else if (state.m && state.m.ph === 'sum' && state.m.cfg.mode !== 'watch') out.push(...flowRects(state, 'sum', state.ui.scroll));
        else out.push({ id: 'think', ...L.think }, { id: 'pause', ...L.pause }, { id: 'action', ...L.action });
      } else if (sc === 'howto' || sc === 'about' || sc === 'rules') {
        const L = readerLayout(); out.push({ id: 'dec', ...L.dec }, { id: 'inc', ...L.inc }, { id: 'back', ...L.back }, { id: 'next', ...L.next });
      } else out.push(...flowRects(state, sc, state.ui.scroll));
      return { frame: { w: FR.w, h: FR.h, land: FR.land, ins: { t: FR.t, r: FR.r, b: FR.b, l: FR.l } }, rects: out, scene: sc, ph: state.m ? state.m.ph : null, hph: state.m && state.m.h ? state.m.h.ph : null };
    },
  };
  if (shotMode) applyPreset();
  return game;
}

// Pirogue Coastal Canoe Race: state and flow. Physics lives in sim.js, rivals and the coach planner in ai.js, a race in match.js,
// drawing in art.js / view.js / menus.js. This is the only file that mutates `state`.
//
// Scenes: title, setup, settings, play (also Watch & Learn), result, howto / about / rules, demolimit.
// Controls: tap the left half of the screen to paddle on the left, the right half to paddle on the right.
import { H, CW, BOW, STERN, COURSE_IDS, COURSES, clamp, nextImpact, upcoming } from './sim.js';
import { newRace, stepRace, settle, results, fmtTime, ordinal, COUNTDOWN } from './match.js';
import { plan, newPilot, autopilot, PERFECT_PROFILE } from './ai.js';
import { inRect, TEXT_SCALES, THINK_STEPS, layoutFor } from './layout.js';
import { renderPlay, placeNow } from './view.js';
import { renderTitle, renderSetup, renderSettings, renderResult, renderPause, renderPages, renderDemoLimit, hitScreen, flowMeta, pageCount, REF, ensureLayout, flowRects, lockupZone } from './menus.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import { setPress } from './ui.js';

// `meta.width/height` are updated live by the kit on every resize (fluid mode: the short side is always 720 units).
export const meta = { width: 720, height: 1280, fluid: { short: 720 } };
const DEMO_RACE_CAP = 3;
const MAX_PARTS = 140;
const COACH_GAP = 4.5;
// Store screenshots (`?shot=1&seed=N&ticks=T`, rendered by tools/arc shots): the seed picks a fixed, scripted scene, the ticks say how
// far in to play it; pointer and key input is ignored so the picture is the same every time. A steady human-like paddler (the
// "shot paddler") drives the boat through the real game flow, so HUD, rings, spray and labels are all real.
const SHOT_SCENES = {
  2: { course: 'morning', level: 'medium', seed: 5, mode: 'race' },
  3: { course: 'surf', level: 'medium', seed: 8, mode: 'race' },
  4: { course: 'bigset', level: 'medium', seed: 12, mode: 'race' },
  5: { course: 'morning', level: 'easy', seed: 21, mode: 'race' },
  6: { course: 'surf', level: 'medium', seed: 8, mode: 'watch' },
};
const SHOT_PADDLER = { id: 'shot', pow: 1, name: 'shot', tag: '', stars: 4, timing: 0.035, blunder: 0.15, react: 0.28, steer: 0.03 };
const NO_INPUT = { pointer: { x: 0, y: 0, down: false, pressed: false, released: false }, keys: { down: new Set(), pressed: new Set() }, wheel: { dx: 0, dy: 0 } };

export function createGame(env) {
  const { rng, audio, storage, config, monetization } = env;
  let shotMode = false;
  try { shotMode = /[?&]shot=/.test(globalThis.location?.search ?? ''); } catch { shotMode = false; }
  let shotPilot = null;
  const lay = () => layoutFor(meta.width, meta.height);
  const fx = rng.fork();
  const seedRng = rng.fork();
  const bestInit = () => Object.fromEntries(COURSE_IDS.map((c) => [c, 0]));
  const state = {
    scene: 'title', back: 'title', t: 0, paused: false, pauseMenu: false, demo: !!config.demo,
    settings: { sound: true, steer: 'paddle', textIdx: 0, thinkIdx: 1 },
    record: { wins: 0, races: 0, streak: 0, best: bestInit(), demoRaces: 0, strokes: 0 },
    setup: { mode: 'race', course: 'morning', level: 'medium' }, setupMsg: '', restoreMsg: '',
    ui: { scroll: 0, drag: null }, refScroll: 0,
    race: null, att: null, result: null, twoPending: null, twoTimes: [],
    cam: { s: 0, y: 0, dir: 1, phi: 0, ppm: 18, ax: 360, ay: 800 }, parts: [], trails: [], flash: [0, 0],
    toast: '', toastT: 0, toastCol: '#fff6e4', toastBig: false, strokeLab: { text: '', t: 0, col: '#fff' },
    hintGlow: null, hintBusy: false, hintCool: 0, coachGlow: null, explain: null, think: null, override: null, lastMoment: -99, moments: 0,
    thinkSecs: 5, loaded: false, lk: '', acc: 0, endT: -1, accs: 0,
  };
  let pending = [];      // strokes queued by input this frame (applied in the first sim step)

  // ---- persistence ---------------------------------------------------------------------------------------------------------
  const save = () => { storage.set('settings', state.settings); storage.set('record', state.record); };
  Promise.all([storage.get('settings', null), storage.get('record', null)]).then(([s, r]) => {
    if (s) Object.assign(state.settings, s);
    if (r) { const best = { ...bestInit(), ...(r.best || {}) }; Object.assign(state.record, r, { best }); }
    state.settings.textIdx = clamp(state.settings.textIdx | 0, 0, TEXT_SCALES.length - 1);
    state.settings.thinkIdx = clamp(state.settings.thinkIdx | 0, 0, THINK_STEPS.length - 1);
    if (state.settings.steer !== 'turn') state.settings.steer = 'paddle';
    state.thinkSecs = THINK_STEPS[state.settings.thinkIdx];
    state.loaded = true;
    audio.setMuted?.(!state.settings.sound);
  });

  // ---- sound ---------------------------------------------------------------------------------------------------------------
  const tone = (o) => { if (state.settings.sound) audio.tone(o); };
  const sfx = {
    dip: (q) => { tone({ freq: 260 + 80 * q, to: 120, dur: 0.1, type: 'triangle', vol: 0.05 }); tone({ freq: 900, to: 400, dur: 0.06, type: 'sawtooth', vol: 0.012 }); },
    perfect: () => { tone({ freq: 880, dur: 0.1, type: 'sine', vol: 0.06 }); tone({ freq: 1320, dur: 0.16, type: 'sine', vol: 0.035 }); },
    thump: (v) => tone({ freq: 110, to: 48, dur: 0.22, type: 'sine', vol: Math.min(0.24, 0.07 + v * 0.1) }),
    hiss: () => tone({ freq: 1500, to: 600, dur: 0.28, type: 'sawtooth', vol: 0.018 }),
    slap: () => { tone({ freq: 200, to: 80, dur: 0.18, type: 'square', vol: 0.05 }); tone({ freq: 1100, to: 500, dur: 0.12, type: 'sawtooth', vol: 0.02 }); },
    no: () => tone({ freq: 220, to: 120, dur: 0.3, type: 'sawtooth', vol: 0.07 }),
    catchIt: () => [0, 4, 7, 12].forEach((n, i) => tone({ freq: 440 * Math.pow(2, n / 12), dur: 0.22 + i * 0.04, type: 'triangle', vol: 0.09 })),
    tick: () => tone({ freq: 880, dur: 0.04, type: 'triangle', vol: 0.05 }),
    count: (go) => tone({ freq: go ? 880 : 440, dur: go ? 0.4 : 0.14, type: 'sine', vol: 0.1 }),
    bell: () => { tone({ freq: 784, dur: 0.3, type: 'sine', vol: 0.1 }); tone({ freq: 1176, dur: 0.4, type: 'sine', vol: 0.06 }); },
    win: () => [0, 2, 4, 7].forEach((n, i) => tone({ freq: 392 * Math.pow(2, n / 12), dur: 0.25 + i * 0.05, type: 'triangle', vol: 0.1 })),
  };
  const toast = (text, secs = 1.6, col = '#fff6e4', big = false) => { state.toast = text; state.toastT = secs; state.toastCol = col; state.toastBig = big; };

  // ---- particles and trails (sea coordinates) -----------------------------------------------------------------------------------
  const splash = (parts, s, y, n, spread = 1, up = 1) => {
    for (let i = 0; i < n && parts.length < MAX_PARTS; i++) parts.push({ s: s + (fx.next() - 0.5) * 1.4, y: y + (fx.next() - 0.5) * 2 * spread, vs: (fx.next() - 0.5) * 3, vy: (fx.next() - 0.5) * 4 * spread, t: 0, max: 0.5 + fx.next() * 0.6, size: 0.14 + fx.next() * 0.2 * up });
  };
  const stepParts = (parts, dt) => {
    for (const q of parts) { q.t += dt; q.s += q.vs * dt; q.y += q.vy * dt; q.vs *= 0.96; q.vy *= 0.96; }
    for (let i = parts.length - 1; i >= 0; i--) if (parts[i].t >= parts[i].max) parts.splice(i, 1);
  };
  const stepTrails = (race, trails, dt, acc) => {
    race.boats.forEach((b, i) => {
      const tr = trails[i] || (trails[i] = { pts: [], k: 1, n: 0 });
      tr.k = clamp(b.v / 3, 0.2, 1);
      tr.n += dt;
      if (tr.n >= 0.1) {
        tr.n = 0;
        tr.pts.push({ s: b.s - b.dir * STERN, y: b.y - b.flip * 0 });
        if (tr.pts.length > 26) tr.pts.shift();
      }
    });
    void acc;
  };

  // ---- camera --------------------------------------------------------------------------------------------------------------------
  const ease = (x) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2);
  const placeCam = (cam, race, dt, snap) => {
    const b = race.boats[0], P = lay().play;
    cam.ppm = P.ppm; cam.ax = P.anchor.x; cam.ay = P.anchor.y;
    cam.s = b.s;
    cam.y = snap ? b.y : cam.y + (b.y - cam.y) * Math.min(1, dt * 6);
    if (b.leg === 'turn') { cam.dir = 1; cam.phi = Math.PI * ease(clamp(1 - b.turnT / b.turnDur, 0, 1)); }
    else { cam.dir = b.dir; cam.phi = 0; }
  };

  // ---- the attract race behind the menus ------------------------------------------------------------------------------------------
  const startAttract = () => {
    const race = newRace({ course: 'morning', level: 'medium', mode: 'trial', seed: 1000 + (state.accs++ * 17) % 900, day: 0, lane: 1 });
    race.pilots[0] = newPilot(PERFECT_PROFILE, 77 + state.accs);
    race.boats[0].pow = 1;
    state.att = { race, cam: { s: 0, y: 0, dir: 1, phi: 0, ppm: 18, ax: 360, ay: 800 }, parts: [], trails: [], t: 0, acc: 0, wait: 0 };
    placeCam(state.att.cam, race, 0, true);
  };
  const updateAttract = (dt) => {
    const a = state.att;
    if (!a) return;
    a.t += dt;
    a.acc += dt;
    const ev = [];
    let n = 0;
    while (a.acc >= H && n++ < 8) { stepRace(a.race, [], ev); a.acc -= H; }
    for (const e of ev) if (e.t === 'punch' || e.t === 'slap') splash(a.parts, e.s + BOW, e.y, 6);
    stepParts(a.parts, dt);
    stepTrails(a.race, a.trails, dt);
    placeCam(a.cam, a.race, dt, false);
    if (a.race.boats[0].done) { a.wait += dt; if (a.wait > 1.5) startAttract(); }
  };

  // ---- race flow -------------------------------------------------------------------------------------------------------------------
  const mode = () => state.race.cfg.mode;
  const humanBoat = () => state.race.boats[0];
  const resetPlayState = () => {
    state.parts = []; state.trails = []; state.flash = [0, 0]; state.toastT = 0; state.strokeLab.t = 0; state.hintGlow = null; state.hintBusy = false;
    state.hintCool = 0; state.coachGlow = null; state.explain = null; state.think = null; state.override = null; state.lastMoment = -99; state.moments = 0;
    state.acc = 0; state.endT = -1; pending = [];
  };
  const startRace = (cfg) => {
    if (state.demo && cfg.mode !== 'watch' && state.record.demoRaces >= DEMO_RACE_CAP) { state.scene = 'demolimit'; state.ui.scroll = 0; return; }
    const full = { course: 'morning', level: 'medium', mode: 'race', seed: seedRng.int(900000) + 1, day: config.day | 0, ...cfg };
    state.race = newRace(full);
    if (full.mode === 'two' && state.twoPending) state.race.names[0] = state.twoPending.names[1];
    else if (full.mode === 'two') state.race.names[0] = 'Player 1';
    state.result = null;
    state.scene = 'play'; state.paused = false; state.pauseMenu = false; state.ui.scroll = 0;
    state.thinkSecs = THINK_STEPS[state.settings.thinkIdx];
    resetPlayState();
    state.race.boats.forEach((b) => { b.s = 0; });
    placeCam(state.cam, state.race, 0, true);
  };
  const startWatch = () => {
    const ids = ['morning', 'surf', 'current'];
    startRace({ mode: 'watch', course: ids[seedRng.int(ids.length)], level: 'medium' });
  };

  const feedback = (e) => {
    const b = state.race.boats[e.id] || state.race.boats[0];
    const mine = e.id === 0;
    const bow = (e.s ?? b.s) + b.dir * BOW;
    if (e.t === 'stroke') {
      if (mine) {
        state.flash[e.side < 0 ? 0 : 1] = 1;
        const lab = e.label, col = lab === 'perfect' ? '#7dffb0' : lab === 'in time' ? '#d6ffe6' : lab === 'early' ? '#ffb08a' : '#ffd27a';
        state.strokeLab = { text: lab === 'perfect' ? 'Perfect' : lab === 'in time' ? 'In time' : lab === 'early' ? 'Early' : 'Late', t: 0.8, col };
        if (lab === 'perfect') sfx.perfect(); else sfx.dip(e.q);
        if (e.braced) toast('Braced', 0.7, '#ffe0a8');
        state.record.strokes++;
      }
      splash(state.parts, e.s - b.dir * 0.5, e.y + b.flip * -e.side * 0.9, 3, 0.2);
    } else if (e.t === 'punch') {
      splash(state.parts, bow, e.y, 10, 1.4);
      if (mine) { sfx.thump(e.sev); if (e.drive) toast('Punched through', 1.0, '#7dffb0'); }
    } else if (e.t === 'slap') {
      splash(state.parts, bow, e.y, 16, 1.6, 1.5);
      if (mine) { sfx.slap(); toast('Slapped: stroke just before the crest', 1.6, '#ffd27a'); }
    } else if (e.t === 'stuffed') {
      splash(state.parts, bow, e.y, 22, 2, 2);
      if (mine) { sfx.no(); toast('Stuffed by the wave!', 1.6, '#ff9a7a'); }
    } else if (e.t === 'swamp') {
      splash(state.parts, e.s, e.y, 24, 2, 2);
      if (mine) { sfx.no(); toast('Swamped! Bailing…', 2.2, '#ff9a7a', true); }
    } else if (e.t === 'catch') {
      splash(state.parts, e.s - b.dir * 1.5, e.y, 12, 1.2);
      if (mine) { sfx.catchIt(); toast('Caught a swell!', 1.8, '#7dffb0', true); }
    } else if (e.t === 'broach') {
      splash(state.parts, e.s, e.y, 18, 1.8, 1.6);
      if (mine) { sfx.no(); toast('Broached! Keep the bow straight', 1.8, '#ff9a7a'); }
    } else if (e.t === 'turn') {
      if (mine) { sfx.bell(); toast(e.e < 2.5 ? 'Tight round the buoy!' : e.e > 6 ? 'A wide turn' : 'Round the buoy', 1.4, '#fff6e4'); }
    } else if (e.t === 'finish') {
      if (mine) { sfx.bell(); toast(`Finished: ${fmtTime(e.time)}`, 2.4, '#ffe9a8', true); }
    }
  };

  const finishRace = () => {
    const race = state.race, c = race.cfg;
    settle(race);
    const rows = results(race);
    const me = rows.find((r) => r.i === 0);
    const time = me.time;
    const R = { win: false, title: '', line: '', rows: [], pb: '' };
    const crs = c.course;
    if (c.mode === 'watch') {
      R.title = 'Coach crew home'; R.line = `${fmtTime(time)}  ·  ${ordinal(me.place)}`; R.win = true;
    } else if (c.mode === 'two') {
      state.twoTimes.push({ name: race.names[0], time });
      if (state.twoTimes.length < 2) {
        state.twoPending = { names: ['Player 1', 'Player 2'] };
        R.title = `${race.names[0]}: ${fmtTime(time)}`; R.line = 'Now the other player races the same sea.'; R.win = true;
      } else {
        const [a, b] = state.twoTimes;
        state.twoPending = null;
        const draw = Math.abs(a.time - b.time) < 0.05;
        R.title = draw ? 'A draw' : `${a.time < b.time ? a.name : b.name} wins`;
        R.line = `${a.name} ${fmtTime(a.time)}  ·  ${b.name} ${fmtTime(b.time)}`; R.win = true;
        state.twoTimes = [];
      }
    } else {
      R.win = c.mode === 'race' && me.place === 1;
      R.title = c.mode === 'trial' ? 'Time Trial complete' : me.place === 1 ? 'You win!' : `${ordinal(me.place)} place`;
      R.line = `${fmtTime(time)}${me.pen > 0 ? `  (+${me.pen.toFixed(1)} s penalty)` : ''}`;
      if (c.mode === 'race') {
        state.record.races++;
        if (me.place === 1) { state.record.wins++; state.record.streak++; } else state.record.streak = 0;
      }
      if (!state.record.best[crs] || time < state.record.best[crs]) { R.pb = state.record.best[crs] ? `New best on ${race.sea.name}!` : `First time on ${race.sea.name}`; state.record.best[crs] = Math.round(time * 10) / 10; }
      else R.pb = `Best on ${race.sea.name}: ${fmtTime(state.record.best[crs])}`;
    }
    if (c.mode !== 'two' && c.mode !== 'watch') rows.forEach((r) => R.rows.push({ me: r.i === 0, text: `${ordinal(r.place)}   ${r.name}   ${fmtTime(r.time)}` }));
    if (c.mode === 'watch') rows.forEach((r) => R.rows.push({ me: r.i === 0, text: `${ordinal(r.place)}   ${r.name}   ${fmtTime(r.time)}` }));
    if (c.mode !== 'watch') state.record.demoRaces++;
    state.result = R;
    state.scene = 'result'; state.ui.scroll = 0;
    if (R.win && c.mode !== 'watch') sfx.win();
    save();
    // the attract race behind the result keeps going
  };

  // ---- Watch & Learn coach -------------------------------------------------------------------------------------------------------
  const sideName = (s) => (s < 0 ? 'left' : 'right');
  const describe = (c) => `${sideName(c.side)} stroke ${c.delay === 0 ? 'right now' : `in ${c.delay.toFixed(2)} s`}`;
  const beginThink = (kind, info) => {
    const race = state.race, b = humanBoat();
    const p = plan(race.sea, b, race.t);
    state.lastMoment = race.t; state.moments++;
    let sit;
    if (kind === 'impact') {
      const sgn = info.w.skew * b.flip >= 0 ? 'right' : 'left';
      sit = `A ${info.w.h.toFixed(1)} m crest reaches the bow in ${info.eta.toFixed(1)} s and will heel the boat to the ${sgn}. A stroke just before contact, bow straight, punches through.`;
    } else sit = `A ${info.w.h.toFixed(1)} m swell is overtaking from behind. Two perfect strokes as its crest lifts the stern will catch it.`;
    state.think = { phase: 'think', t: 0, dur: THINK_STEPS[state.settings.thinkIdx], plan: p, sit };
    state.explain = { head: 'Coach is thinking…', lines: [sit, `Comparing ${15} ways to take the next stroke on a copy of the sea.`] };
  };
  const checkCoach = () => {
    const race = state.race, b = humanBoat();
    if (state.think || race.phase !== 'race' || b.done || b.swamp > 0 || b.leg === 'turn' || race.t - state.lastMoment < COACH_GAP) return;
    const imp = nextImpact(race.sea, b, race.t);
    if (imp && imp.eta < 1.5 && imp.eta > 0.8 && imp.w.h >= 0.55) { beginThink('impact', imp); return; }
    if (b.dir < 0) {
      const u = upcoming(race.sea, b, race.t, 1)[0];
      if (u && u.rel < 10 && u.rel > 4.5 && u.w.h >= 0.5) beginThink('catch', u);
    }
  };
  const updateThink = (dt) => {
    const th = state.think;
    if (!th || state.paused) return;
    th.t += dt;
    if (th.phase === 'think' && th.t >= th.dur) {
      th.phase = 'reveal'; th.t = 0; th.dur = 2;
      const best = th.plan.best;
      state.coachGlow = { side: best.side };
      state.explain = { head: `Coach chooses: ${describe(best)}`, lines: [th.sit, ...th.plan.alts.slice(0, 2).map((a, i) => `${i + 2}. ${describe(a)}  (value ${a.value.toFixed(1)}, best ${best.value.toFixed(1)})`)] };
      toast(`Coach: ${describe(best)}`, 2, '#ffd98a');
    } else if (th.phase === 'reveal' && th.t >= th.dur) {
      const best = th.plan.best;
      state.override = { side: best.side, delay: best.delay };
      state.think = null; state.explain = null; state.coachGlow = null;
    }
  };

  // ---- hint ------------------------------------------------------------------------------------------------------------------------
  const requestHint = () => {
    const race = state.race, b = humanBoat();
    if (state.hintCool > 0 || race.phase !== 'race' || b.done) return;
    const p = plan(race.sea, b, race.t);
    const best = p.best;
    state.hintCool = 3;
    state.hintGlow = { side: state.settings.steer === 'turn' ? -best.side : best.side, t: 2.8 };
    const wave = nextImpact(race.sea, b, race.t);
    const why = Math.abs(b.roll) > 0.4 ? 'The boat is heeling: paddle on the low side.' : wave && wave.eta < 2 ? 'A crest is close: stroke just before it arrives.' : b.dir < 0 ? 'Two perfect strokes as the swell lifts the stern.' : 'Keep the beat and the bow straight.';
    toast(`Hint: ${describe({ ...best, side: state.settings.steer === 'turn' ? -best.side : best.side })}. ${why}`, 3.4, '#ffd98a');
    sfx.tick();
  };

  // ---- the play scene ------------------------------------------------------------------------------------------------------------
  const openPause = () => { state.paused = true; state.pauseMenu = true; state.ui.scroll = 0; };
  const closePause = () => { state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; };
  function leaveRace() { state.scene = 'title'; state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; state.race = null; if (state.twoPending) { state.twoPending = null; state.twoTimes = []; } }

  const sideFromX = (x, L) => {
    const left = x < L.w / 2;
    const paddleLeft = state.settings.steer === 'turn' ? !left : left;
    return paddleLeft ? -1 : 1;
  };

  const updatePlay = (dt, input) => {
    const race = state.race, ptr = input.pointer, keys = input.keys;
    const watch = race.cfg.mode === 'watch', L = lay(), P = L.play;
    meta.previewBadge = { x: P.time.x, y: P.time.y + P.time.h + 6, align: 'left' };
    if (config.dev && keys.pressed.has('KeyK')) { race.boats[0].s = 1; race.boats[0].dir = -1; race.boats[0].leg = 'home'; race.boats[0].flip = -1; }
    if (keys.pressed.has('KeyP') || keys.pressed.has('Escape')) { if (state.pauseMenu) closePause(); else if (!watch) openPause(); else state.paused = !state.paused; }
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
    const strokesIn = [];
    if (watch) {
      if (ptr.pressed) {
        if (inRect(P.demo.pause, ptr.x, ptr.y)) { state.paused = !state.paused; sfx.tick(); }
        else if (inRect(P.demo.exit, ptr.x, ptr.y)) { leaveRace(); return; }
      }
      if (keys.pressed.has('Equal')) { state.settings.thinkIdx = Math.min(THINK_STEPS.length - 1, state.settings.thinkIdx + 1); save(); }
      if (keys.pressed.has('Minus')) { state.settings.thinkIdx = Math.max(0, state.settings.thinkIdx - 1); save(); }
    } else if (ptr.pressed) {
      if (inRect(P.pause, ptr.x, ptr.y)) { openPause(); return; }
      if (inRect(P.hint, ptr.x, ptr.y)) { requestHint(); }
      else if (!state.paused) strokesIn.push(sideFromX(ptr.x, L));
    }
    if (!watch && !state.paused) {
      const sw = state.settings.steer === 'turn' ? -1 : 1;
      if (keys.pressed.has('ArrowLeft') || keys.pressed.has('KeyA') || keys.pressed.has('KeyJ')) strokesIn.push(-1 * sw);
      if (keys.pressed.has('ArrowRight') || keys.pressed.has('KeyD') || keys.pressed.has('KeyK')) strokesIn.push(1 * sw);
      if (keys.pressed.has('KeyH')) requestHint();
    }
    if (strokesIn.length) pending.push(strokesIn[0]);

    if (state.toastT > 0) state.toastT -= dt;
    if (state.strokeLab.t > 0) state.strokeLab.t -= dt;
    state.flash[0] = Math.max(0, state.flash[0] - dt * 4); state.flash[1] = Math.max(0, state.flash[1] - dt * 4);
    if (state.hintCool > 0) state.hintCool -= dt;
    if (state.hintGlow) { state.hintGlow.t -= dt; if (state.hintGlow.t <= 0) state.hintGlow = null; }
    if (state.paused) return;

    if (watch) { updateThink(dt); if (!state.think) checkCoach(); }
    placeCam(state.cam, race, dt, false);
    stepParts(state.parts, dt);
    stepTrails(race, state.trails, dt);
    if (state.think) return;                         // the coach is explaining: the sea holds still

    state.acc += dt;
    const ev = [];
    let n = 0;
    const lastCount = Math.ceil(race.go - 0.4);
    while (state.acc >= H && n++ < 10) {
      const st = [];
      if (race.phase === 'race') {
        if (watch) {
          st[0] = null;
          const o = state.override;
          if (o) { o.delay -= H; if (o.delay <= 0) { st[0] = o.side; state.override = null; } }
        } else if (pending.length) st[0] = pending.shift();
        else st[0] = 0;
      } else pending.length = 0;
      stepRace(race, st, ev);
      state.acc -= H;
    }
    if (race.phase === 'intro') { const c = Math.ceil(race.go - 0.4); if (c !== lastCount && c >= 0) sfx.count(c === 0); }
    for (const e of ev) { if (e.t === 'go') { toast('GO!', 0.8, '#fff6e4', true); sfx.count(true); } else feedback(e); }
    if (race.phase === 'race') {
      const b = humanBoat();
      if (b.done) {
        if (state.endT < 0) state.endT = 0;
        state.endT += dt;
        if (state.endT > 2.6) finishRace();
      }
    }
  };

  function handlePauseTap(id) {
    if (!id) return;
    sfx.tick();
    if (id === 'resume') closePause();
    else if (id === 'p-rules') { state.back = 'play'; state.scene = 'rules'; state.refScroll = 0; }
    else if (id === 'p-howto') { state.back = 'play'; state.scene = 'howto'; state.refScroll = 0; }
    else if (id === 'p-sound') { state.settings.sound = !state.settings.sound; audio.setMuted?.(!state.settings.sound); save(); }
    else if (id === 'restart') { const c = state.race.cfg; startRace({ ...c, seed: c.seed }); }
    else if (id === 'quit') leaveRace();
  }

  // ---- menus ----------------------------------------------------------------------------------------------------------------
  function scrollFlow(ptr) {
    const d = state.ui.drag, mt = flowMeta();
    d.moved = Math.max(d.moved, Math.abs(ptr.y - d.y0));
    if (d.moved >= 10 && mt.cols.length) state.ui.scroll = clamp(d.s0 - (ptr.y - d.y0), 0, mt.max);
  }
  const openSetup = (md) => { state.setup.mode = md; state.scene = 'setup'; state.ui.scroll = 0; state.setupMsg = ''; };
  const handleTitle = (id) => {
    if (!id) return;
    if (id === 'arcforge') { env.openArcforgeHome?.(); return; }
    sfx.tick();
    if (id === 'play') openSetup('race');
    else if (id === 'two') openSetup('two');
    else if (id === 'trial') openSetup('trial');
    else if (id === 'watch') startWatch();
    else if (id === 'howto' || id === 'rules' || id === 'about') { state.back = 'title'; state.scene = id; state.refScroll = 0; }
    else if (id === 'settings') { state.scene = 'settings'; state.ui.scroll = 0; }
    else if (id === 'sound') { state.settings.sound = !state.settings.sound; audio.setMuted?.(!state.settings.sound); save(); }
  };
  const handleSetup = (id) => {
    if (!id) return;
    const s = state.setup;
    sfx.tick();
    if (id.startsWith('lvl')) { const l = id.slice(3); if (state.demo && l === 'hard') { state.setupMsg = 'That level is in the full game.'; return; } s.level = l; state.setupMsg = ''; }
    else if (id.startsWith('crs')) { const c = id.slice(3); if (state.demo && c !== 'morning' && c !== 'surf') { state.setupMsg = 'That sea is in the full game.'; return; } s.course = c; state.setupMsg = ''; }
    else if (id === 'start') { state.twoTimes = []; state.twoPending = null; startRace({ mode: s.mode, course: s.course, level: s.level }); }
    else if (id === 'back') { state.scene = 'title'; state.ui.scroll = 0; }
  };
  const handleSettings = (id) => {
    if (!id) return;
    const st = state.settings;
    sfx.tick();
    if (id === 'set-sound') { st.sound = !st.sound; audio.setMuted?.(!st.sound); }
    else if (id === 'set-steer') st.steer = st.steer === 'turn' ? 'paddle' : 'turn';
    else if (id === 'txt-dec') st.textIdx = Math.max(0, st.textIdx - 1);
    else if (id === 'txt-inc') st.textIdx = Math.min(TEXT_SCALES.length - 1, st.textIdx + 1);
    else if (id === 'think-dec') { st.thinkIdx = Math.max(0, st.thinkIdx - 1); state.thinkSecs = THINK_STEPS[st.thinkIdx]; }
    else if (id === 'think-inc') { st.thinkIdx = Math.min(THINK_STEPS.length - 1, st.thinkIdx + 1); state.thinkSecs = THINK_STEPS[st.thinkIdx]; }
    else if (id === 'restore' && !state.restoreBusy) {
      state.restoreBusy = true; state.restoreMsg = 'Checking with the store...';
      Promise.resolve(monetization.restore?.()).then(() => {
        state.owned = monetization.owns('unlock_game');
        state.restoreMsg = state.owned ? 'Purchase restored' : 'No earlier purchase found';
      }).catch(() => { state.restoreMsg = 'Could not reach the store. Try again later.'; }).finally(() => { state.restoreBusy = false; });
    }
    else if (id === 'back') { state.scene = 'title'; state.ui.scroll = 0; state.restoreMsg = ''; }
    save();
  };
  const handleResult = (id) => {
    if (!id) return;
    sfx.tick();
    const cfg = state.race.cfg;
    if (id === 'next') startRace({ ...cfg });
    else if (id === 'again') { state.twoTimes = []; state.twoPending = null; startRace({ ...cfg, seed: undefined }); }
    else if (id === 'new') { state.setup.mode = cfg.mode === 'watch' ? 'race' : cfg.mode; state.twoTimes = []; state.twoPending = null; state.scene = 'setup'; state.ui.scroll = 0; }
    else if (id === 'menu') { state.twoTimes = []; state.twoPending = null; state.scene = 'title'; state.ui.scroll = 0; }
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
    if (input.keys.pressed.has('Equal') || input.keys.pressed.has('NumpadAdd')) { state.settings.textIdx = Math.min(TEXT_SCALES.length - 1, state.settings.textIdx + 1); save(); }
    if (input.keys.pressed.has('Minus') || input.keys.pressed.has('NumpadSubtract')) { state.settings.textIdx = Math.max(0, state.settings.textIdx - 1); save(); }
    if (input.keys.down.has('ArrowDown')) state.ui.scroll = clamp(state.ui.scroll + 14, 0, max);
    if (input.keys.down.has('ArrowUp')) state.ui.scroll = clamp(state.ui.scroll - 14, 0, max);
  };

  const updateSetup = (dt, input) => {
    const ptr = input.pointer, k = input.keys;
    if (k.pressed.has('KeyC')) { const ids = state.demo ? ['morning', 'surf'] : COURSE_IDS; state.setup.course = ids[(ids.indexOf(state.setup.course) + 1) % ids.length] || ids[0]; }
    if (k.pressed.has('Enter')) { handleSetup('start'); return; }
    if (k.pressed.has('Escape')) { handleSetup('back'); return; }
    const pins = lay().pins;
    if (ptr.pressed && (inRect(pins.start, ptr.x, ptr.y) || inRect(pins.back, ptr.x, ptr.y))) { handleSetup(inRect(pins.start, ptr.x, ptr.y) ? 'start' : 'back'); return; }
    updateFlowScene(dt, input, handleSetup, 'setup');
  };

  let refDrag = null;
  const updatePages = (input) => {
    const ptr = input.pointer, keys = input.keys;
    const close = () => { state.scene = state.back === 'play' ? 'play' : 'title'; state.refScroll = 0; };
    const ref = lay().ref, set = (v) => { state.refScroll = clamp(v, 0, REF.max); };
    if (ptr.pressed) {
      if (inRect(ref.next, ptr.x, ptr.y)) { close(); return; }
      else if (inRect(ref.back, ptr.x, ptr.y)) { if (state.refScroll > 4) set(state.refScroll - REF.view * 0.9); else close(); return; }
      else if (inRect(ref.dec, ptr.x, ptr.y)) { state.settings.textIdx = Math.max(0, state.settings.textIdx - 1); state.refScroll = 0; save(); }
      else if (inRect(ref.inc, ptr.x, ptr.y)) { state.settings.textIdx = Math.min(TEXT_SCALES.length - 1, state.settings.textIdx + 1); state.refScroll = 0; save(); }
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

  startAttract();
  const sc = shotMode ? SHOT_SCENES[config.seed | 0] : null;
  if (sc) {
    startRace({ ...sc, day: 0 });
    shotPilot = sc.mode === 'watch' ? null : newPilot(SHOT_PADDLER, sc.seed * 5 + 3);
  }

  return {
    // Watch & Learn and every menu are free; only real racing counts against the free preview (a paused race, the start
    // countdown and the moments after the finish do not).
    isPreviewExempt: () => {
      if (shotMode || state.scene !== 'play' || !state.race) return true;
      const r = state.race;
      return r.cfg.mode === 'watch' || state.paused || r.phase === 'intro' || r.boats[0].done;
    },
    update(dt, input) {
      if (shotMode) {
        input = NO_INPUT;
        if (state.scene === 'play' && state.race && !state.paused && state.race.cfg.mode !== 'watch' && state.race.phase === 'race' && shotPilot) {
          const b = state.race.boats[0];
          if (!b.done) { const sd = autopilot(state.race.sea, b, state.race.t, shotPilot); if (sd) pending.push(sd); }
        }
      }
      setPress(input.pointer);
      state.owned = monetization.owns('unlock_game');
      state.t += state.paused && state.scene === 'play' ? 0 : dt;
      if (state.scene !== 'play') meta.previewBadge = null;
      if (state.att && state.scene !== 'play') updateAttract(dt);
      switch (state.scene) {
        case 'title': updateFlowScene(dt, input, handleTitle, 'title'); break;
        case 'setup': updateSetup(dt, input); break;
        case 'settings': updateFlowScene(dt, input, handleSettings, 'settings'); break;
        case 'result': updateFlowScene(dt, input, handleResult, 'result'); break;
        case 'demolimit': updateFlowScene(dt, input, (id) => { if (id === 'menu') { state.scene = 'title'; state.ui.scroll = 0; } }, 'demolimit'); break;
        case 'howto': case 'about': case 'rules': updatePages(input); break;
        case 'play': updatePlay(dt, input); break;
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
          if (state.race) { renderPlay(ctx, state, L); }
          if (state.pauseMenu) renderPause(ctx, state, L);
          break;
        default: break;
      }
    },
    wheel(dy) { if (['about', 'howto', 'rules'].includes(state.scene)) { state.refScroll = clamp((state.refScroll || 0) + dy, 0, REF.max); return; } if (['title', 'setup', 'settings', 'result', 'demolimit'].includes(state.scene) || state.pauseMenu) state.ui.scroll = clamp(state.ui.scroll + dy, 0, flowMeta().max); },
    getState: () => state,
    debug: () => ({ lockup: lockupZone(), layout: lay(), flow: flowRects(state.ui.scroll), flowMax: flowMeta().max, pages: pageCount() }),
  };
}

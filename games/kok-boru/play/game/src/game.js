// Kok-boru: the game shell. Scenes, input (two thumbs), persistence, preview wiring, the ladder, Watch & Learn and the Think hint.
// The match itself lives in sim.js (pure, fixed 60 Hz); the picture lives in scene.js / hud.js and only reads the state exposed here.
import { createSim } from './sim.js';
import { host, live, syncSize, sizeKey, TEXT_SCALES, THINK_STEPS, refLayout, setupPins, inRect, inCircle, playLayout } from './layout.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import * as MN from './menus.js';
import { renderPlay, watchHit, STICK_R } from './hud.js';
import { drawWorld, makeCam, updateView, stepParticles, emitDust, emitConfetti } from './scene.js';
import { advise } from './ai.js';
import { throwPlan, goalCentre } from './phys.js';
import { clamp, hyp } from './util.js';
import { PERIOD_SECS, PERIODS, LADDER, LEVELS, TEAMS, GOAL_R, DT } from './consts.js';
import { setPress } from './ui.js';

export const meta = { width: 720, height: 1280, fluid: { short: 720 } };
const DEMO_MATCH_CAP = 2;
const SAVE_VERSION = 1;

export function createGame(env) {
  const { rng, audio, storage, config } = env;
  const demo = !!config.demo;
  const G = {
    scene: 'title', mode: 'none', demo, loaded: false,
    settings: { textIdx: 0, sound: true, thinkIdx: 1 },
    setup: { size: 3, tactic: 1, opp: 1, lenIdx: 1, watch: false, watchA: 2, lastMode: 'match', rung: 0 },
    ladder: { rung: 0 },
    ui: { scroll: 0, drag: null }, page: 0, back: 'title', setupMsg: '', restoreMsg: '',
    saved: null, record: { demoMatches: 0 },
    sim: null, paused: false, pauseMenu: false, think: null, thinkRects: null,
    watch: { phase: 'think', timer: 0, paused: false, holdId: -1, info: null, marks: null },
    t: 0, homeTeam: 0, awayTeam: 1, lastLadder: '', lastLadderNext: false,
    view: { camX: 0, camInit: false, t: 0, parts: [], rider: {}, cheer: 0, cheerTeam: -1, dust: 0 },
    c: { stick: null, bind: {}, actHeld: false, actEdge: false, passEdge: false, swapEdge: false, sprintOn: false, out: { mx: 0, mz: 0, mag: 0, sprint: false, act: false, actPressed: false, pass: false, switch: false } },
  };
  let aboutList = ABOUT;
  let S = null, evSeen = 0, simRng = rng.fork(), snap = null, lastSize = '';

  // ---- persistence ---------------------------------------------------------------------------------------------------------------
  const saveSettings = () => {
    storage.set('settings', G.settings); storage.set('ladder', G.ladder); storage.set('record', G.record);
    storage.set('setup', { size: G.setup.size, tactic: G.setup.tactic, opp: G.setup.opp, lenIdx: G.setup.lenIdx });
  };
  const metaOfSave = (d) => ({ period: d.snap.s.period, score: [...d.snap.s.score], mode: d.mode });
  const validSave = (d) => d && d.v === SAVE_VERSION && d.snap && d.snap.s && Array.isArray(d.snap.s.score) && d.snap.s.riders;
  const persistMatch = () => {
    if (!S || (G.mode !== 'match' && G.mode !== 'ladder') || S.s.over) return;
    const d = { v: SAVE_VERSION, mode: G.mode, rung: G.setup.rung, size: G.setup.size, tactic: G.setup.tactic, opp: G.setup.opp, lenIdx: G.setup.lenIdx, snap: S.snapshot() };
    snap = d; G.saved = metaOfSave(d); storage.set('match', d);
  };
  const clearSave = () => { snap = null; G.saved = null; storage.remove('match'); };
  Promise.all([storage.get('settings', null), storage.get('ladder', null), storage.get('record', null), storage.get('match', null), storage.get('setup', null)]).then(([s, l, r, mch, su]) => {
    if (s) Object.assign(G.settings, s);
    if (l) G.ladder.rung = clamp(l.rung | 0, 0, LADDER.length);
    if (r) Object.assign(G.record, r);
    if (su) { G.setup.size = su.size === 4 ? 4 : 3; G.setup.tactic = clamp(su.tactic | 0, 0, 2); G.setup.opp = clamp(su.opp | 0, 0, 4); G.setup.lenIdx = clamp(su.lenIdx | 0, 0, 2); }
    if (validSave(mch)) { snap = mch; G.saved = metaOfSave(mch); }
    G.settings.textIdx = clamp(G.settings.textIdx | 0, 0, TEXT_SCALES.length - 1);
    G.settings.thinkIdx = clamp(G.settings.thinkIdx | 0, 0, THINK_STEPS.length - 1);
    G.loaded = true;
    MN.invalidateLayout();
    audio.setMuted?.(!G.settings.sound);
  });

  // ---- sound ---------------------------------------------------------------------------------------------------------------------------
  const tone = (o) => { if (G.settings.sound) audio.tone(o); };
  const sfx = {
    tick: () => tone({ freq: 760, dur: 0.04, type: 'triangle', vol: 0.05 }),
    grab: () => { tone({ freq: 220, to: 120, dur: 0.1, type: 'triangle', vol: 0.16 }); tone({ freq: 700, to: 500, dur: 0.05, type: 'square', vol: 0.03 }); },
    lean: () => tone({ freq: 300, to: 200, dur: 0.12, type: 'sine', vol: 0.05 }),
    tug: () => { tone({ freq: 170, to: 80, dur: 0.16, type: 'sawtooth', vol: 0.12 }); },
    throw: () => tone({ freq: 500, to: 1100, dur: 0.18, type: 'sine', vol: 0.07 }),
    pass: () => tone({ freq: 900, to: 500, dur: 0.12, type: 'triangle', vol: 0.06 }),
    bounce: (p) => tone({ freq: 150 + p * 70, to: 90, dur: 0.08, type: 'sine', vol: 0.08 }),
    goal: () => [0, 4, 7, 12].forEach((n, i) => tone({ freq: 523 * Math.pow(2, n / 12), dur: 0.24 + i * 0.05, type: 'triangle', vol: 0.09 })),
    whistle: () => tone({ freq: 2400, to: 2100, dur: 0.28, type: 'sine', vol: 0.05 }),
    hoof: () => tone({ freq: 90, to: 70, dur: 0.05, type: 'triangle', vol: 0.03 }),
  };

  // ---- match lifecycle ---------------------------------------------------------------------------------------------------------------
  const setSim = (sim) => { S = sim; G.sim = sim.s; evSeen = sim.s.evId; G.think = null; G.endT = 0; G.view.camInit = false; G.view.parts.length = 0; G.view.rider = {}; };
  const startDemoBg = () => {
    setSim(createSim({ human: -1, mateLevel: 2, oppLevel: 2, size: 3, periods: 1, periodSecs: 900, kick: 0 }, simRng.fork()));
    G.mode = 'none'; G.homeTeam = 0; G.awayTeam = 1;
  };
  const periodSecs = () => (demo ? 45 : PERIOD_SECS[G.setup.lenIdx]);
  function startMatch(kind, opts = {}) {
    const st = G.setup;
    let cfg;
    if (kind === 'match' || kind === 'ladder') {
      if (demo && G.record.demoMatches >= DEMO_MATCH_CAP && !opts.resume) { G.scene = 'demolimit'; G.ui.scroll = 0; MN.invalidateLayout(); return; }
      const rung = kind === 'ladder' ? LADDER[clamp(st.rung, 0, LADDER.length - 1)] : null;
      const level = rung ? rung.level : st.opp;
      G.homeTeam = 0; G.awayTeam = rung ? rung.team : 1 + clamp(level, 0, 4);
      cfg = { human: 0, size: st.size, tactic: st.tactic, mateLevel: 3, oppLevel: level, periods: PERIODS, periodSecs: periodSecs(), cup: kind === 'ladder', kick: 0 };
    } else {
      G.homeTeam = 0; G.awayTeam = 1 + clamp(st.opp, 0, 4);
      cfg = { human: -1, size: 3, mateLevel: st.watchA, oppLevel: st.opp, periods: 2, periodSecs: 60, watch: true, tactic: 1 };
    }
    G.mode = kind; G.setup.lastMode = kind;
    setSim(createSim(cfg, simRng.fork()));
    if (opts.resume) S.restore(opts.resume);
    G.c.stick = null; G.c.bind = {};
    G.scene = 'play'; G.paused = !!opts.paused; G.pauseMenu = !!opts.paused; G.ui.scroll = 0; G.think = null;
    G.watch = { phase: 'think', timer: 0, paused: false, holdId: -1, info: null, marks: null };
    if (kind !== 'watch') { if (demo && !opts.resume) { G.record.demoMatches++; saveSettings(); } if (!opts.resume) persistMatch(); }
    MN.invalidateLayout();
  }
  const resumeMatch = () => {
    if (!snap) return;
    const d = JSON.parse(JSON.stringify(snap));
    G.setup.size = d.size; G.setup.tactic = d.tactic; G.setup.opp = d.opp; G.setup.lenIdx = d.lenIdx; G.setup.rung = d.rung || 0;
    startMatch(d.mode === 'ladder' ? 'ladder' : 'match', { resume: d.snap, paused: true });
  };
  const leaveMatch = () => { persistMatch(); G.scene = 'title'; G.mode = 'none'; G.paused = false; G.pauseMenu = false; G.think = null; G.ui.scroll = 0; startDemoBg(); MN.invalidateLayout(); };

  // ---- events: sound, results ---------------------------------------------------------------------------------------------------------
  const delayed = [];
  const later = (t, f) => delayed.push({ t, f });
  function processEvents() {
    const s = S.s;
    for (const e of s.events) {
      if (e.id < evSeen) continue;
      evSeen = e.id + 1;
      if (e.type === 'grab' || e.type === 'catch') sfx.grab();
      else if (e.type === 'lean' || e.type === 'reach') sfx.lean();
      else if (e.type === 'tug') sfx.tug();
      else if (e.type === 'tugfail' || e.type === 'fumble') sfx.bounce(0.6);
      else if (e.type === 'throw') sfx.throw();
      else if (e.type === 'pass') sfx.pass();
      else if (e.type === 'bounce') sfx.bounce(e.p || 0.5);
      else if (e.type === 'goal') {
        sfx.whistle(); later(0.35, () => sfx.goal());
        emitConfetti(G.view, e.team === 0 ? G.homeTeam : G.awayTeam, e.x, e.z);
        G.view.cheer = 3; G.view.cheerTeam = e.team;
      } else if (e.type === 'whistle' || e.type === 'period' || e.type === 'end' || e.type === 'golden') sfx.whistle();
      if ((e.type === 'period' || e.type === 'goal') && (G.mode === 'match' || G.mode === 'ladder')) persistMatch();
    }
    if (s.phase === 'end' && !G.endT) G.endT = s.t;
    if (s.phase === 'end' && s.t - G.endT > 2.2 && G.mode !== 'none' && G.mode !== 'shot') finishMatch();
  }
  function finishMatch() {
    const s = S.s;
    G.lastLadder = ''; G.lastLadderNext = false;
    if (G.mode === 'match' || G.mode === 'ladder') {
      clearSave(); G.record.matches = (G.record.matches || 0) + 1; if (s.winner === 0) G.record.wins = (G.record.wins || 0) + 1;
      if (G.mode === 'ladder') {
        const rung = G.setup.rung;
        if (s.winner === 0) {
          if (rung >= G.ladder.rung) G.ladder.rung = Math.min(LADDER.length, rung + 1);
          G.lastLadder = rung + 1 >= LADDER.length ? 'You have won the Steppe Ladder!' : `Rung won: ${LADDER[rung].name}`;
          G.lastLadderNext = rung + 1 < LADDER.length && !(demo && rung + 1 > 1);
        } else G.lastLadder = 'Not this time: try the rung again.';
      }
      saveSettings();
    }
    G.scene = 'result'; G.ui.scroll = 0; G.endT = 0; MN.invalidateLayout();
  }

  // ---- Think hint ---------------------------------------------------------------------------------------------------------------------
  function openThink() {
    const s = S.s, me = s.ctl >= 0 ? s.riders[s.ctl] : null;
    if (!me) return;
    const a = advise(s, me);
    G.think = { ...a };
  }

  // ---- Watch & Learn ------------------------------------------------------------------------------------------------------------------
  function describeHold(s, h) {
    const r = s.riders[h.rider];
    const a = advise(s, r);
    const g = goalCentre(r.team);
    const out = { title: a.title, text: a.text, marks: a.marks || [] };
    if (h.kind === 'throw') {
      const pl = throwPlan(r, h.pending.throwP ?? 0, h.pending.throwAng ?? null, r.team);
      out.title = 'Throw for the circle';
      out.text = `The rider is ${Math.round(hyp(g.x - r.x, g.z - r.z))} metres from the circle and lets go at ${Math.round((h.pending.throwP ?? 0) * 100)}% charge, so the ball comes down about ${Math.round(hyp(pl.lx - g.x, pl.lz - g.z) * 10) / 10} metres from the centre.`;
      out.marks = [{ x: g.x, z: g.z, label: 'circle' }];
    } else if (h.kind === 'pass') {
      const m = s.riders[h.pending.passTo ?? -1];
      out.title = 'Pass to the open rider';
      out.text = 'A rival is close and a team-mate is further forward with clear space. A quick pass keeps the ball safe and moves the attack on.';
      if (m) out.marks = [{ x: m.x, z: m.z, label: 'pass here' }];
    } else if (h.kind === 'tug') {
      out.title = 'Tug the ball away';
      out.text = 'The rider is alongside the carrier and reaches for the ball. It works best with fresh legs and the same direction of travel.';
      const c = s.carrier >= 0 ? s.riders[s.carrier] : null; if (c) out.marks = [{ x: c.x, z: c.z, label: 'carrier' }];
    } else if (h.kind === 'grab') {
      out.title = 'Ease off and lift';
      out.text = 'The ball is in reach and the horse is slow enough for a clean lift: lean down and take it onto the saddle.';
      out.marks = [{ x: s.ball.x, z: s.ball.z, label: 'ball' }];
    }
    return out;
  }
  function updateWatch(dt) {
    const s = S.s, w = G.watch;
    if (w.paused) return false;
    if (s.hold) {
      if (w.holdId !== s.hold.id) { w.holdId = s.hold.id; w.phase = 'think'; w.timer = THINK_STEPS[G.settings.thinkIdx]; w.info = describeHold(s, s.hold); w.marks = w.info.marks; }
      w.timer -= dt;
      if (w.phase === 'think' && w.timer <= 0) { w.phase = 'reveal'; w.timer = 2; }
      else if (w.phase === 'reveal' && w.timer <= 0) { w.phase = 'act'; S.release(); return true; }
      return false;
    }
    return true;
  }

  // ---- controls --------------------------------------------------------------------------------------------------------------------------
  const pointersOf = (input) => {
    if (env.touches) return env.touches();
    const p = input.pointer, out = [];
    if (p.down || p.released || p.pressed) out.push({ id: 'mouse', x: p.x, y: p.y, down: p.down, fresh: p.pressed, up: p.released && !p.down });
    return out;
  };
  function readControls(input, L) {
    const Z = L.stickZone, c = G.c, keys = input.keys;
    c.actEdge = false; c.passEdge = false; c.swapEdge = false;
    let uiAction = null;
    const hasRole = (r) => Object.values(c.bind).includes(r);
    for (const t of pointersOf(input)) {
      let role = c.bind[t.id];
      if (t.fresh && !role) {
        if (inCircle(L.act, t.x, t.y, 22)) { role = 'act'; c.actEdge = true; }
        else if (inCircle(L.pass, t.x, t.y, 18)) { role = 'pass'; c.passEdge = true; }
        else if (inCircle(L.sprint, t.x, t.y, 18)) role = 'sprint';
        else if (inCircle(L.swap, t.x, t.y, 22)) { role = 'swap'; c.swapEdge = true; }
        else if (inRect(L.think, t.x, t.y)) { role = 'ui'; uiAction = 'think'; }
        else if (inRect(L.pause, t.x, t.y)) { role = 'ui'; uiAction = 'pause'; }
        else if (inRect(L.call, t.x, t.y)) { role = 'ui'; uiAction = 'call'; }
        else if (inRect(Z, t.x, t.y) && !hasRole('stick')) {
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
    const liveIds = new Set(pointersOf(input).map((t) => t.id));
    for (const id of Object.keys(c.bind)) if (!liveIds.has(id) && !liveIds.has(+id)) { if (c.bind[id] === 'stick') c.stick = null; delete c.bind[id]; }
    const kd = keys.down;
    const kAct = kd.has('Space') || kd.has('KeyJ') && false;
    c.actHeld = hasRole('act') || kAct;
    if (keys.pressed.has('Space')) c.actEdge = true;
    if (keys.pressed.has('KeyE') || keys.pressed.has('KeyJ')) c.passEdge = true;
    if (keys.pressed.has('KeyQ') || keys.pressed.has('Tab')) c.swapEdge = true;
    const kx = (kd.has('ArrowRight') || kd.has('KeyD') ? 1 : 0) - (kd.has('ArrowLeft') || kd.has('KeyA') ? 1 : 0);
    const kz = (kd.has('ArrowDown') || kd.has('KeyS') ? 1 : 0) - (kd.has('ArrowUp') || kd.has('KeyW') ? 1 : 0);
    let mx = 0, mz = 0, mag = 0;
    if (c.stick) { mx = c.stick.dx; mz = -c.stick.dz; mag = c.stick.mag; if (mag > 0.001) { mx /= Math.max(0.001, hyp(mx, mz)); mz /= Math.max(0.001, hyp(mx, mz)); } }
    if (kx || kz) { const m = Math.hypot(kx, kz); mx = kx / m; mz = kz / m; mag = 1; }
    c.sprintOn = hasRole('sprint') || kd.has('ShiftLeft') || kd.has('ShiftRight');
    c.out = { mx, mz, mag: mag > 0.12 ? mag : 0, sprint: c.sprintOn, act: c.actHeld, actPressed: c.actEdge, pass: c.passEdge, switch: c.swapEdge };
    if (keys.pressed.has('KeyT')) uiAction = 'think';
    if (keys.pressed.has('KeyP') || keys.pressed.has('Escape')) uiAction = 'pause';
    if (keys.pressed.has('KeyC')) uiAction = 'call';
    return uiAction;
  }

  // ---- menus ---------------------------------------------------------------------------------------------------------------------------------
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
    else if (id === 'ladder') go('ladder');
    else if (id === 'play') { G.setup.watch = false; go('setup'); G.setupMsg = ''; }
    else if (id === 'watch') { G.setup.watch = true; go('setup'); G.setupMsg = ''; }
    else if (id === 'howto') { G.back = 'title'; go('howto'); }
    else if (id === 'rules') { G.back = 'title'; go('rules'); }
    else if (id === 'about') { G.back = 'title'; go('about'); }
    else if (id === 'settings') go('settings');
    else if (id === 'sound') { G.settings.sound = !G.settings.sound; audio.setMuted?.(!G.settings.sound); saveSettings(); MN.invalidateLayout(); }
  }
  function handleLadder(id) {
    if (!id) return;
    sfx.tick();
    if (id === 'back') go('title');
    else if (id.startsWith('rung')) { G.setup.rung = +id.slice(4); startMatch('ladder'); }
  }
  function handleSetup(id) {
    if (!id) return;
    const st = G.setup;
    sfx.tick();
    if (id.startsWith('size')) { st.size = +id.slice(4); MN.invalidateLayout(); saveSettings(); }
    else if (id.startsWith('tac')) { st.tactic = +id.slice(3); MN.invalidateLayout(); saveSettings(); }
    else if (id.startsWith('wa')) { st.watchA = +id.slice(2); MN.invalidateLayout(); }
    else if (id.startsWith('opp')) { st.opp = +id.slice(3); MN.invalidateLayout(); saveSettings(); }
    else if (id.startsWith('len')) { st.lenIdx = +id.slice(3); MN.invalidateLayout(); saveSettings(); }
    else if (id === 'start') {
      if (demo && st.opp > 1 && !st.watch) { G.setupMsg = 'The free demo has the first two rivals.'; return; }
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
    if (id === 'nextrung') { G.setup.rung = Math.min(LADDER.length - 1, G.setup.rung + 1); startMatch('ladder'); }
    else if (id === 'again') startMatch(G.setup.lastMode === 'watch' ? 'watch' : G.setup.lastMode === 'ladder' ? 'ladder' : 'match');
    else if (id === 'new') { if (G.setup.lastMode === 'watch') startMatch('watch'); else if (G.setup.lastMode === 'ladder') { go('ladder'); startDemoBg(); } else { go('setup'); startDemoBg(); } }
    else if (id === 'menu') { go('title'); startDemoBg(); }
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

  // ---- the play update ------------------------------------------------------------------------------------------------------------------
  function openPause() { G.paused = true; G.pauseMenu = true; G.ui.scroll = 0; G.c.stick = null; G.c.bind = {}; persistMatch(); MN.invalidateLayout(); }
  function updatePlay(dt, input) {
    const L = playLayout(G.settings.textIdx);
    if (G.mode === 'shot') { S.update(dt, null); processEvents(); return; }
    if (G.pauseMenu) { MN.ensureLayout(G, 'pause'); updateFlowScene(dt, input, handlePause, null); return; }
    if (G.mode === 'watch') {
      const ptr = input.pointer;
      if (ptr.pressed) {
        const i = watchHit(L, ptr.x, ptr.y);
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
      if ((ptr.pressed && G.thinkRects && inRect(G.thinkRects.close, ptr.x, ptr.y)) || input.keys.pressed.has('Enter') || input.keys.pressed.has('Space')) { G.think = null; sfx.tick(); }
      return;
    }
    if (act === 'pause') { openPause(); return; }
    if (act === 'think') { openThink(); return; }
    if (act === 'call') { S.s.call[0] = 1 - S.s.call[0]; sfx.tick(); }
    S.update(dt, G.c.out);
    processEvents();
  }

  function startShot() {
    G.mode = 'shot'; G.setup.lastMode = 'shot'; G.homeTeam = 0; G.awayTeam = 3;
    setSim(createSim({ human: 0, size: 3, mateLevel: 3, oppLevel: 3, periods: 2, periodSecs: 90, autoHuman: true, kick: 0 }, simRng.fork()));
    G.scene = 'play';
  }
  if (config.shot) startShot(); else startDemoBg();

  // picture-only upkeep: camera, dust, confetti
  function viewStep(dt) {
    const V = G.view, s = S.s;
    const L = playLayout(G.settings.textIdx);
    updateView(V, s, dt, L.area);
    stepParticles(V, dt);
    if (V.cheer > 0) V.cheer -= dt;
    V.dust -= dt;
    if (V.dust <= 0) {
      V.dust = 0.07;
      for (const r of s.riders) if (r.spd > 4.5) emitDust(V, r.x - r.face * 0.6, r.z, r.vx, 1, r.id * 13 + Math.floor(V.t * 20));
    }
  }

  return {
    isPreviewExempt: () => !(G.scene === 'play' && (G.mode === 'match' || G.mode === 'ladder')) || G.paused || G.pauseMenu || !!G.think || (S && ['goal', 'break', 'end', 'ready'].includes(S.s.phase)),
    update(dt, input) {
      syncSize(meta.width, meta.height);
      // keep the preview pill clear of the scoreboard (it sits just under the top safe area)
      meta.previewBadge = { y: host.t + 2 };
      G.owned = !!env.monetization?.owns?.('unlock_game');
      const sk = sizeKey();
      if (sk !== lastSize) { if (lastSize) { G.c.stick = null; G.c.bind = {}; G.c.actHeld = false; G.ui.drag = null; MN.invalidateLayout(); } lastSize = sk; }
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
        case 'ladder': updateFlowScene(dt, input, handleLadder, 'ladder'); break;
        case 'settings': updateFlowScene(dt, input, handleSettings, 'settings'); break;
        case 'result': updateFlowScene(dt, input, handleResult, 'result'); break;
        case 'demolimit': updateFlowScene(dt, input, (id) => { if (id === 'menu') go('title'); }, 'demolimit'); break;
        case 'howto': case 'about': case 'rules': updatePages(input); break;
        case 'play': updatePlay(dt, input); break;
        default: break;
      }
      viewStep(dt);
    },
    render(ctx, view) {
      syncSize(meta.width, meta.height);
      ctx.clearRect(0, 0, live.w, live.h);
      void view;
      if (G.scene === 'play') {
        renderPlay(ctx, G, S);
        if (G.pauseMenu) MN.renderPause(ctx, G);
        return;
      }
      // menus: the live demo match behind a scrim
      const L = playLayout(G.settings.textIdx);
      const full = { x: 0, y: 0, w: live.w, h: live.h };
      void L;
      const cam = makeCam(full, G.view);
      drawWorld(ctx, cam, G.view, S.s, { noCtl: true, homeTeam: G.homeTeam, awayTeam: G.awayTeam });
      switch (G.scene) {
        case 'title': MN.renderTitle(ctx, G); break;
        case 'setup': MN.renderSetup(ctx, G); break;
        case 'ladder': MN.renderLadder(ctx, G); break;
        case 'settings': MN.renderSettings(ctx, G); break;
        case 'result': MN.renderResult(ctx, G); break;
        case 'demolimit': MN.renderDemoLimit(ctx, G); break;
        case 'howto': MN.renderPages(ctx, G, HOWTO, 'How to Play'); break;
        case 'about': MN.renderPages(ctx, G, aboutList, 'About'); break;
        case 'rules': MN.renderPages(ctx, G, RULES, 'Rules'); break;
        default: break;
      }
    },
    getState: () => G,
  };
}
void LEVELS; void TEAMS; void GOAL_R; void DT;

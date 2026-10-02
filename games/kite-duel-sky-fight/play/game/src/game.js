// Kite Duel: state and flow. Physics lives in sim.js, the rivals in ai.js, drawing in view.js / art.js /
// menus.js. This is the only file that mutates `state`.
//
// Scenes: title, setup, settings, play (also Watch & Learn), result, howto/about/rules, demolimit.
// A duel is a match of rounds. A round is one pair of kites in one sky: phases ready -> fly -> cut -> between.
// Watch & Learn runs the same world in beats: THINK (frozen) -> REVEAL (frozen) -> ACT (the sky runs).
import { W, H, K, BOUNDS, newWorld, stepWorld, clamp, SKY_IDS } from './sim.js';
import { createBrain, createPlanner, PROFILES, PERFECT } from './ai.js';
import { KITE_PAL } from './art.js';
import { inRect, playLayout, TEXT_DEC, TEXT_INC, REF_BACK, REF_NEXT, TEXT_SCALES, THINK_STEPS, SETUP_PINS } from './layout.js';
import { renderPlay, drawBanner, palsOf } from './view.js';
import { renderTitle, renderSetup, renderSettings, renderResult, renderPause, renderPages, renderDemoLimit, hitScreen, flowMeta, pageCount, ensureLayout } from './menus.js';
import { ABOUT, HOWTO, RULES } from './content.js';
import { setPress } from './ui.js';

export const meta = { width: W, height: H };
const DEMO_ROUND_CAP = 3;
const REVEAL_SECS = 2;
const ACT_SECS = 2.4;
const HINT_SECS = 5;
const MAX_PARTS = 150;

export function createGame(env) {
  const { rng, audio, storage, config, monetization } = env;
  const fx = rng.fork();
  const aiRng = rng.fork();
  const worldRng = rng.fork();
  const state = {
    scene: 'title', back: 'title', t: 0, wp: 0, paused: false, pauseMenu: false, demo: !!config.demo,
    settings: { sound: true, calm: false, textIdx: 0, thinkIdx: 1 },
    record: { wins: [0, 0, 0, 0, 0], played: 0, streak: 0, best: 0, demoRounds: 0, cuts: 0 },
    setup: { opp: 0, sky: 'dawn', rounds: 3 }, setupMsg: '', restoreMsg: '',
    ui: { scroll: 0, drag: null }, page: 0,
    att: null, match: null, w: null, ph: 'ready', phT: 0, banner: null, pals: null,
    parts: [], shake: null, flash: 0, toast: '', toastT: 0, hint: null, hintBusy: false, wl: null, steer: false, loaded: false,
    thinSeen: [false, false], crossToast: false, saved: null,
  };
  let brain = null, hintPlanner = null, attBrains = null, fxT = 0, sawT = 0, windT = 0, humT = 0, attSky = 0;
  let planners = null;
  let savedSnap = null, saveT = 0;

  // ---- persistence -----------------------------------------------------------------------------
  const save = () => { storage.set('settings', state.settings); storage.set('record', state.record); };

  // A duel in progress is saved at safe points (round start, about every second of flight, and when the pause menu
  // opens) so an app kill or background never loses it. The snapshot is the whole sim world (plain numbers) plus the
  // match; the rival's hand is rebuilt on resume. Only Play a Duel is saved, never Watch & Learn.
  const DUEL_VERSION = 1;
  const metaOf = (snap) => ({ opp: PROFILES[snap.cfg.opp]?.name ?? 'Rival', round: snap.round, wins: [...snap.wins], rounds: snap.cfg.rounds, sky: snap.cfg.sky });
  const validSnap = (d) => d && d.v === DUEL_VERSION && d.cfg && d.cfg.mode === 'ai' && PROFILES[d.cfg.opp] && Array.isArray(d.wins) && d.w && Array.isArray(d.w.k) && d.w.k.length === 2 && d.w.wind && !d.w.over;
  const persistDuel = () => {
    const m = state.match, w = state.w;
    if (!m || !w || m.cfg.mode !== 'ai' || m.over || w.over || state.scene !== 'play') return;
    const snap = { v: DUEL_VERSION, cfg: { ...m.cfg }, round: m.round, wins: [...m.wins], stats: { ...m.stats }, w: { ...w, ev: [], contact: null, sever: null }, ph: state.ph === 'fly' ? 'fly' : 'ready', phT: 0, wp: state.wp, thinSeen: [...state.thinSeen], crossToast: state.crossToast };
    savedSnap = JSON.parse(JSON.stringify(snap));
    state.saved = metaOf(savedSnap);
    saveT = 0;
    storage.set('duel', snap);
  };
  const clearDuel = () => { savedSnap = null; state.saved = null; storage.remove('duel'); };
  const resumeDuel = () => {
    if (!savedSnap) return;
    const snap = JSON.parse(JSON.stringify(savedSnap));
    state.match = { cfg: snap.cfg, round: snap.round, wins: snap.wins, stats: snap.stats, over: null };
    state.w = snap.w; state.w.ev = []; state.w.contact = null; state.w.contactT = 0;
    state.pals = palsOf(state.match);
    state.ph = snap.ph; state.phT = 0; state.wp = snap.wp; state.banner = null; state.parts = []; state.hint = null; state.hintBusy = false;
    state.shake = null; state.flash = 0; state.steer = false; state.toastT = 0; state.wl = null;
    state.thinSeen = snap.thinSeen; state.crossToast = snap.crossToast;
    hintPlanner = null; planners = null; fxT = 0; sawT = 0; saveT = 0;
    brain = createBrain(PROFILES[snap.cfg.opp], aiRng.fork(), 1);
    state.scene = 'play'; state.ui.scroll = 0; state.ui.drag = null;
    openPause();                       // never an instant loss: the duel waits on the pause menu
  };

  Promise.all([storage.get('settings', null), storage.get('record', null), storage.get('duel', null)]).then(([s, r, d]) => {
    if (s) Object.assign(state.settings, s);
    if (r) Object.assign(state.record, r);
    if (validSnap(d)) { savedSnap = d; state.saved = metaOf(d); }
    state.settings.textIdx = clamp(state.settings.textIdx | 0, 0, TEXT_SCALES.length - 1);
    state.settings.thinkIdx = clamp(state.settings.thinkIdx | 0, 0, THINK_STEPS.length - 1);
    state.loaded = true;
    audio.setMuted?.(!state.settings.sound);
  });

  // ---- sound -----------------------------------------------------------------------------------
  const tone = (o) => { if (state.settings.sound) audio.tone(o); };
  const sfx = {
    tick: () => tone({ freq: 760, dur: 0.04, type: 'triangle', vol: 0.05 }),
    no: () => tone({ freq: 220, to: 140, dur: 0.2, type: 'sawtooth', vol: 0.05 }),
    cross: () => { tone({ freq: 1400, to: 900, dur: 0.1, type: 'square', vol: 0.04 }); tone({ freq: 520, to: 300, dur: 0.14, type: 'sawtooth', vol: 0.04 }); },
    saw: (q) => tone({ freq: 700 + fx.next() * 500, to: 380, dur: 0.05, type: 'sawtooth', vol: 0.012 + 0.03 * q }),
    snap: () => { tone({ freq: 2200, to: 260, dur: 0.16, type: 'square', vol: 0.1 }); tone({ freq: 140, to: 50, dur: 0.3, type: 'sine', vol: 0.16 }); },
    win: () => [0, 2, 4, 7].forEach((n, i) => tone({ freq: 440 * Math.pow(2, n / 12), dur: 0.25 + i * 0.05, type: 'triangle', vol: 0.1 })),
    lose: () => [0, -3, -7].forEach((n, i) => tone({ freq: 392 * Math.pow(2, n / 12), dur: 0.3 + i * 0.05, type: 'triangle', vol: 0.08 })),
    wind: (v) => tone({ freq: 90 + v * 90, to: 70 + v * 60, dur: 0.9, type: 'sine', vol: 0.008 + 0.014 * v }),
    hum: (T) => tone({ freq: 260 + T * 320, dur: 0.22, type: 'triangle', vol: 0.006 + 0.012 * T }),
    go: () => tone({ freq: 880, dur: 0.2, type: 'triangle', vol: 0.1 }),
  };
  const toast = (text, secs = 2.6) => { state.toast = text; state.toastT = secs; };

  // ---- particles ---------------------------------------------------------------------------------
  const spark = (parts, x, y, n, power = 1) => {
    for (let i = 0; i < n && parts.length < MAX_PARTS; i++) {
      const a = fx.next() * Math.PI * 2, sp = (60 + fx.next() * 260) * power;
      parts.push({ kind: 'spark', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, t: 0, max: 0.25 + fx.next() * 0.35, size: 1 });
    }
  };
  const stepParts = (parts, dt) => {
    for (const p of parts) {
      p.t += dt; p.x += (p.vx ?? 0) * dt; p.y += (p.vy ?? 0) * dt;
      if (p.kind === 'spark') p.vy += 420 * dt;
      else if (p.kind === 'shred') { p.vy += 160 * dt; p.rot += (p.vr ?? 3) * dt; p.vx *= 0.99; }
    }
    for (let i = parts.length - 1; i >= 0; i--) if (parts[i].t >= parts[i].max) parts.splice(i, 1);
  };

  // ---- the attract duel behind the menus ---------------------------------------------------------
  const ATT_PAIRS = [[1, 3], [2, 4], [3, 2], [0, 4]];
  const startAttract = () => {
    const pair = ATT_PAIRS[attSky % ATT_PAIRS.length];
    const sky = SKY_IDS[attSky % SKY_IDS.length]; attSky++;
    const pa = PROFILES[pair[0]], pb = PROFILES[pair[1]];
    const w = newWorld(worldRng.fork(), { sky, styles: [pa.style, pb.style], stats: [{ steer: pa.steer }, { steer: pb.steer }] });
    attBrains = [createBrain(pa, aiRng.fork(), 0), createBrain(pb, aiRng.fork(), 1)];
    state.att = { w, t: 0, wp: 0, parts: [], sky, pals: [KITE_PAL[1 + pair[0]], KITE_PAL[1 + pair[1]]], wait: 0, fxT: 0 };
  };
  const updateAttract = (dt) => {
    const a = state.att;
    if (!a) return;
    a.t += dt;
    const w = a.w;
    if (w.over) { a.wait += dt; if (a.wait > 4.5) startAttract(); }
    let sdt = dt;
    if (w.slow > 0) { sdt = dt * K.SLOWMO; w.slow = Math.max(0, w.slow - dt); }
    for (const b of attBrains) b.update(w, sdt);
    for (const k of w.k) if (!k.free) k.ty = clamp(k.ty, 450, 580);   // keep the show above the menu buttons
    stepWorld(w, sdt);
    a.wp += w.wnow * sdt;
    for (const e of w.ev) {
      if (e.t === 'cross') spark(a.parts, e.x, e.y, 6, 0.8);
      else if (e.t === 'cut') { spark(a.parts, e.x, e.y, 30, 1.4); a.parts.push({ kind: 'ring', x: e.x, y: e.y, vx: 0, vy: 0, t: 0, max: 0.6, size: 120 }); }
    }
    w.ev.length = 0;
    if (w.contact) { a.fxT -= sdt; if (a.fxT <= 0) { spark(a.parts, w.contact.x, w.contact.y, 2, 0.6); a.fxT = 0.07; } }
    stepParts(a.parts, dt);
  };

  // ---- match flow --------------------------------------------------------------------------------
  const isWatch = () => state.match && state.match.cfg.mode === 'watch';
  const nameOf = (side) => {
    const m = state.match;
    if (m.cfg.mode === 'watch') return PROFILES[side === 0 ? m.cfg.watchA : m.cfg.opp].name;
    return side === 0 ? 'You' : PROFILES[m.cfg.opp].name;
  };

  const startRound = () => {
    const m = state.match, c = m.cfg;
    const pa = c.mode === 'watch' ? PROFILES[c.watchA] : { style: 'patang', steer: 1 }, pb = PROFILES[c.opp];
    state.w = newWorld(worldRng.fork(), { sky: c.sky, styles: [pa.style, pb.style], stats: [{ steer: pa.steer }, { steer: pb.steer }] });
    state.pals = palsOf(m);
    state.ph = 'ready'; state.phT = 0; state.banner = null; state.parts = []; state.hint = null; state.hintBusy = false; hintPlanner = null;
    state.shake = null; state.flash = 0; state.steer = false; state.toastT = 0; state.crossToast = false;
    state.wp = 0; fxT = 0; sawT = 0; planners = null; state.wl = null;
    brain = c.mode === 'watch' ? null : createBrain(pb, aiRng.fork(), 1);
    state.thinSeen = [false, false];
    if (c.mode === 'watch') beginBeat();
    else { toast('Touch the sky to set a heading', 2.4); persistDuel(); }
  };

  const startMatch = (cfg) => {
    if (state.demo && cfg.mode !== 'watch' && state.record.demoRounds >= DEMO_ROUND_CAP) { state.scene = 'demolimit'; state.ui.scroll = 0; return; }
    state.match = { cfg: { mode: 'ai', opp: 0, sky: 'dawn', rounds: 3, watchA: 3, ...cfg }, round: 1, wins: [0, 0], stats: { cuts: 0, worst: 100 }, over: null };
    state.scene = 'play'; state.paused = false; state.pauseMenu = false; state.ui.scroll = 0;
    startRound();
  };
  const startWatch = () => {
    const picks = [1, 2, 3, 4];
    const a = picks.splice(aiRng.int(picks.length), 1)[0], b = picks[aiRng.int(picks.length)];
    startMatch({ mode: 'watch', watchA: a, opp: b, sky: SKY_IDS[aiRng.int(SKY_IDS.length)], rounds: 1 });
  };

  const onCut = (e) => {
    const m = state.match, w = state.w;
    state.ph = 'cut'; state.phT = 0;
    state.flash = state.settings.calm ? 0 : 0.5;
    spark(state.parts, e.x, e.y, 46, 1.6);
    state.parts.push({ kind: 'ring', x: e.x, y: e.y, vx: 0, vy: 0, t: 0, max: 0.7, size: 160 });
    const pal = state.pals[e.side];
    for (let i = 0; i < 16 && state.parts.length < MAX_PARTS; i++) state.parts.push({ kind: 'shred', x: e.x, y: e.y, vx: (fx.next() - 0.5) * 220, vy: -fx.next() * 220, rot: fx.next() * 6, vr: (fx.next() - 0.5) * 12, t: 0, max: 1.4 + fx.next() * 0.8, size: 10 + fx.next() * 10, col: i % 2 ? pal.a : pal.b });
    sfx.snap();
    const winner = w.over.winner;
    m.wins[winner]++;
    m.stats.worst = Math.min(m.stats.worst, w.minInteg[0]);
    if (m.cfg.mode === 'ai' && winner === 0) m.stats.cuts++;
    if (m.cfg.mode !== 'watch' && state.demo) state.record.demoRounds++;
    const need = m.cfg.rounds === 1 ? 1 : 2;
    if (m.wins[winner] >= need) m.over = { win: winner };
    // the banner
    const timed = w.over.why === 'time';
    let title, line, win = winner === 0;
    if (m.cfg.mode === 'watch') { title = `${nameOf(winner)} wins the round`; line = timed ? `Time ran out. ${nameOf(winner)} had more string left.` : `${nameOf(w.over.loser)}'s string parted.`; win = true; }
    else if (winner === 0) { title = timed ? 'You win on string' : 'Line cut!'; line = timed ? 'Time ran out and you had more string left.' : 'You cut their string. Their kite drifts away.'; }
    else { title = timed ? 'They win on string' : 'Your string parted'; line = timed ? 'Time ran out and they had more string left.' : 'Your kite is loose. Cross sooner, or ease off before the gust.'; }
    state.banner = { title, line, score: m.cfg.rounds === 3 ? `Rounds ${m.wins[0]} - ${m.wins[1]}` : (timed ? 'Decided on string' : 'Line cut'), win, last: !!m.over, auto: m.cfg.mode === 'watch' };
    if (m.cfg.mode !== 'watch') { if (winner === 0) sfx.win(); else sfx.lose(); }
  };

  const afterBanner = () => {
    const m = state.match;
    if (m.over) {
      state.scene = 'result'; state.ui.scroll = 0;
      if (m.cfg.mode === 'ai') clearDuel();
      if (m.cfg.mode === 'ai') {
        state.record.played++; state.record.cuts += m.stats.cuts;
        if (m.over.win === 0) { state.record.wins[m.cfg.opp]++; state.record.streak++; state.record.best = Math.max(state.record.best, state.record.streak); } else state.record.streak = 0;
      }
      save();
      if (state.demo && m.cfg.mode !== 'watch' && state.record.demoRounds >= DEMO_ROUND_CAP) { state.scene = 'demolimit'; state.ui.scroll = 0; }
    } else {
      save();
      if (state.demo && state.record.demoRounds >= DEMO_ROUND_CAP) { clearDuel(); state.scene = 'demolimit'; state.ui.scroll = 0; return; }
      m.round++; startRound();
    }
  };

  const handleEvents = (w) => {
    for (const e of w.ev) {
      if (e.t === 'cross') { spark(state.parts, e.x, e.y, 10, 0.9); sfx.cross(); if (!state.crossToast) { state.crossToast = true; if (!isWatch()) toast('The strings have crossed: watch the bars', 2.4); } }
      else if (e.t === 'cut') onCut(e);
    }
    w.ev.length = 0;
  };

  const contactFx = (dt) => {
    const w = state.w;
    if (w.contact && !w.over) {
      fxT -= dt; sawT -= dt;
      const q = clamp(Math.max(w.contact.rate[0], w.contact.rate[1]) / 30, 0.2, 1);
      if (fxT <= 0) { spark(state.parts, w.contact.x, w.contact.y, 2, 0.5 + q * 0.5); fxT = 0.06; }
      if (sawT <= 0) { sfx.saw(q); sawT = 0.1; }
    }
    for (const k of w.k) {
      if (!state.thinSeen[k.side] && k.integ < 25 && !k.free) { state.thinSeen[k.side] = true; if (!isWatch() && k.side === 0) toast('Your string is getting thin', 2.2); }
    }
    windT -= dt; humT -= dt;
    if (windT <= 0) { sfx.wind(w.wnow); windT = 0.8; }
    const T = Math.max(w.k[0].T, w.k[1].T);
    if (humT <= 0 && T > 0.7 && !w.over) { sfx.hum(T); humT = 0.25; }
  };

  const stepPlaySim = (dt) => {
    const w = state.w;
    let sdt = dt;
    if (w.slow > 0) { sdt = dt * K.SLOWMO; w.slow = Math.max(0, w.slow - dt); }
    if (brain) brain.update(w, sdt);
    stepWorld(w, sdt);
    state.wp += w.wnow * sdt;
    handleEvents(w);
    contactFx(sdt);
    if (!isWatch() && !w.over) { saveT += dt; if (saveT >= 1) persistDuel(); }
  };

  // ---- Watch & Learn: Think -> Reveal -> Act ----------------------------------------------------
  function beginBeat() {
    const m = state.match, w = state.w;
    const profs = [PROFILES[m.cfg.watchA], PROFILES[m.cfg.opp]];
    planners = [0, 1].map((s) => createPlanner(w, s, profs[s], aiRng.fork(), {}));
    state.wl = { phase: 'think', t: 0, dur: THINK_STEPS[state.settings.thinkIdx], plans: [null, null], show: [], beat: (state.wl?.beat ?? 0) + 1 };
  }
  const updateWatch = (dt) => {
    const wl = state.wl, w = state.w;
    if (wl.phase !== 'act' && w.over) return;
    wl.t += dt;
    if (wl.phase === 'think') {
      let ready = true;
      planners.forEach((p, i) => { if (!p.done) p.step(10); if (p.done) wl.plans[i] = p.result; else ready = false; });
      if (wl.plans[0] && !wl.show.length) wl.show = wl.plans[0].all.slice(0, 18).reverse().map((c) => ({ tx: c.tx, ty: c.ty }));
      if (wl.t >= wl.dur && ready) { wl.phase = 'reveal'; wl.t = 0; wl.dur = REVEAL_SECS; sfx.tick(); }
    } else if (wl.phase === 'reveal') {
      if (wl.t >= wl.dur) {
        wl.phase = 'act'; wl.t = 0; wl.dur = ACT_SECS;
        [0, 1].forEach((s) => { const p = wl.plans[s].params; w.k[s].tx = p.tx; w.k[s].ty = p.ty; w.k[s].mode = p.mode; });
        sfx.go();
      }
    } else {
      stepPlaySim(dt);
      if (wl.t >= wl.dur && !w.over) beginBeat();
    }
  };

  // ---- the play scene ----------------------------------------------------------------------------
  const openPause = () => { state.paused = true; state.pauseMenu = true; state.ui.scroll = 0; persistDuel(); };
  const closePause = () => { state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; };
  const leaveMatch = () => { state.scene = 'title'; state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; planners = null; hintPlanner = null; state.hintBusy = false; state.wl = null; state.hint = null; brain = null; };

  const requestHint = () => {
    if (state.hintBusy || state.w.over || state.ph === 'between') return;
    state.hintBusy = true;
    hintPlanner = createPlanner(state.w, 0, PERFECT, aiRng.fork(), { perfect: true });
  };
  const updateHint = (dt) => {
    if (hintPlanner) {
      hintPlanner.step(14);
      if (hintPlanner.done) {
        const r = hintPlanner.result; hintPlanner = null; state.hintBusy = false;
        if (!state.w.over) state.hint = { tx: r.params.tx, ty: r.params.ty, mode: r.params.mode, reason: r.reason, t: 0, dur: HINT_SECS };
      }
    }
    if (state.hint) { state.hint.t += dt; if (state.hint.t > state.hint.dur + 0.1) state.hint = null; }
  };

  const setMode = (id) => {
    const k = state.w.k[0];
    if (id === 1 && k.lock) { toast('Grip is spent. Ease off to recover it', 2); sfx.no(); return; }
    k.mode = id; sfx.tick();
  };

  const updatePlay = (dt, input) => {
    const ptr = input.pointer, keys = input.keys, m = state.match;
    const watch = m.cfg.mode === 'watch';
    const L = playLayout(state.settings.textIdx);
    if (config.dev && keys.pressed.has('KeyK') && state.w) state.w.k[1].integ = 0;
    if (keys.pressed.has('KeyP') || keys.pressed.has('Escape')) { if (state.pauseMenu) closePause(); else if (!watch) openPause(); else state.paused = !state.paused; }
    // overlays
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
    if (watch) {
      if (ptr.pressed) {
        if (inRect(L.watch.pause, ptr.x, ptr.y)) { state.paused = !state.paused; sfx.tick(); }
        else if (inRect(L.watch.dec, ptr.x, ptr.y)) { state.settings.thinkIdx = Math.max(0, state.settings.thinkIdx - 1); sfx.tick(); save(); }
        else if (inRect(L.watch.inc, ptr.x, ptr.y)) { state.settings.thinkIdx = Math.min(THINK_STEPS.length - 1, state.settings.thinkIdx + 1); sfx.tick(); save(); }
        else if (inRect(L.watch.exit, ptr.x, ptr.y)) { leaveMatch(); return; }
      }
    } else if (state.ph === 'between') {
      if (ptr.pressed && state.phT > 0.6) { sfx.tick(); afterBanner(); return; }
    } else {
      const k = state.w.k[0];
      if (ptr.pressed) {
        if (inRect(L.pause, ptr.x, ptr.y)) { openPause(); return; }
        if (inRect(L.think, ptr.x, ptr.y)) { requestHint(); sfx.tick(); }
        for (const r of L.modes) if (inRect(r, ptr.x, ptr.y)) setMode(r.id);
        if (inRect(L.sky, ptr.x, ptr.y) && !state.w.over) state.steer = true;
      }
      if (state.steer && ptr.down && !state.w.over) { k.tx = clamp(ptr.x, BOUNDS.x0, BOUNDS.x1); k.ty = clamp(ptr.y, BOUNDS.y0, BOUNDS.y1); }
      if (!ptr.down) state.steer = false;
      if (!state.w.over) {
        if (keys.down.has('ArrowLeft') || keys.down.has('KeyA')) k.tx = clamp(k.tx - 9, BOUNDS.x0, BOUNDS.x1);
        if (keys.down.has('ArrowRight') || keys.down.has('KeyD')) k.tx = clamp(k.tx + 9, BOUNDS.x0, BOUNDS.x1);
        if (keys.down.has('ArrowUp') || keys.down.has('KeyW')) k.ty = clamp(k.ty - 9, BOUNDS.y0, BOUNDS.y1);
        if (keys.down.has('ArrowDown') || keys.down.has('KeyS')) k.ty = clamp(k.ty + 9, BOUNDS.y0, BOUNDS.y1);
        if (keys.pressed.has('KeyZ') || keys.pressed.has('KeyQ')) setMode(-1);
        if (keys.pressed.has('KeyX')) setMode(0);
        if (keys.pressed.has('KeyC') || keys.pressed.has('KeyE')) setMode(1);
        if (keys.pressed.has('KeyH')) requestHint();
      }
    }
    // everything below is frozen while paused (clocks, searches, in-flight animation)
    if (state.paused) return;
    if (state.toastT > 0) state.toastT -= dt;
    if (state.flash > 0) state.flash = Math.max(0, state.flash - dt * 1.4);
    if (state.shake) { state.shake.t += dt; if (state.shake.t >= state.shake.dur) state.shake = null; }
    if (state.ph === 'between') { state.phT += dt; stepParts(state.parts, dt); if (watch && state.phT > 4.5) afterBanner(); return; }
    if (watch) updateWatch(dt); else { updateHint(dt); stepPlaySim(dt); }
    stepParts(state.parts, dt);
    if (!watch && state.ph === 'ready' && state.w.t >= K.ARM) { state.ph = 'fly'; sfx.go(); }
    if (state.ph === 'cut') { state.phT += dt; if (state.phT > 3.2) { state.ph = 'between'; state.phT = 0; } }
  };

  // ---- menus ------------------------------------------------------------------------------------
  function scrollFlow(ptr) {
    const d = state.ui.drag;
    const mt = flowMeta();
    d.moved = Math.max(d.moved, Math.abs(ptr.y - d.y0));
    if (d.moved >= 10 && mt.lay) {
      const max = Math.max(0, mt.lay.contentH - (mt.bottom - mt.top));
      state.ui.scroll = clamp(d.s0 - (ptr.y - d.y0), 0, max);
    }
  }
  function handlePauseTap(id) {
    if (!id) return;
    sfx.tick();
    if (id === 'resume') closePause();
    else if (id === 'p-rules') { state.back = 'play'; state.scene = 'rules'; state.page = 0; }
    else if (id === 'p-howto') { state.back = 'play'; state.scene = 'howto'; state.page = 0; }
    else if (id === 'p-sound') { state.settings.sound = !state.settings.sound; audio.setMuted?.(!state.settings.sound); save(); }
    else if (id === 'p-calm') { state.settings.calm = !state.settings.calm; save(); }
    else if (id === 'p-txt-dec') { state.settings.textIdx = Math.max(0, state.settings.textIdx - 1); state.ui.scroll = 0; save(); }
    else if (id === 'p-txt-inc') { state.settings.textIdx = Math.min(TEXT_SCALES.length - 1, state.settings.textIdx + 1); state.ui.scroll = 0; save(); }
    else if (id === 'quit') leaveMatch();
  }

  const handleTitle = (id) => {
    if (!id) return;
    sfx.tick();
    if (id === 'continue') resumeDuel();
    else if (id === 'play') { state.scene = 'setup'; state.ui.scroll = 0; state.setupMsg = ''; }
    else if (id === 'watch') startWatch();
    else if (id === 'howto' || id === 'rules' || id === 'about') { state.back = 'title'; state.scene = id; state.page = 0; }
    else if (id === 'settings') { state.scene = 'settings'; state.ui.scroll = 0; }
    else if (id === 'sound') { state.settings.sound = !state.settings.sound; audio.setMuted?.(!state.settings.sound); save(); }
  };
  const handleSetup = (id) => {
    if (!id) return;
    const s = state.setup;
    sfx.tick();
    if (id.startsWith('opp')) { const i = Number(id.slice(3)); if (state.demo && i > 1) { state.setupMsg = 'That rival is in the full game.'; return; } s.opp = i; state.setupMsg = ''; }
    else if (id.startsWith('sky')) { const p = id.slice(3); if (state.demo && (p === 'dusk' || p === 'storm')) { state.setupMsg = 'That sky is in the full game.'; return; } s.sky = p; state.setupMsg = ''; }
    else if (id === 'len3') s.rounds = 3;
    else if (id === 'len1') s.rounds = 1;
    else if (id === 'start') startMatch({ mode: 'ai', opp: s.opp, sky: s.sky, rounds: s.rounds });
    else if (id === 'back') { state.scene = 'title'; state.ui.scroll = 0; }
  };
  const handleSettings = (id) => {
    if (!id) return;
    const st = state.settings;
    sfx.tick();
    if (id === 'set-sound') { st.sound = !st.sound; audio.setMuted?.(!st.sound); }
    else if (id === 'set-calm') st.calm = !st.calm;
    else if (id === 'txt-dec') st.textIdx = Math.max(0, st.textIdx - 1);
    else if (id === 'txt-inc') st.textIdx = Math.min(TEXT_SCALES.length - 1, st.textIdx + 1);
    else if (id === 'think-dec') st.thinkIdx = Math.max(0, st.thinkIdx - 1);
    else if (id === 'think-inc') st.thinkIdx = Math.min(THINK_STEPS.length - 1, st.thinkIdx + 1);
    else if (id === 'restore') {
      state.restoreMsg = 'Checking with the store...';
      Promise.resolve(monetization.restore?.()).then(() => { state.restoreMsg = monetization.owns('unlock_game') ? 'Purchase restored. Thank you!' : 'No previous purchase found.'; }).catch(() => { state.restoreMsg = 'The store is not available right now.'; });
    } else if (id === 'back') { state.scene = 'title'; state.ui.scroll = 0; state.restoreMsg = ''; }
    save();
  };
  const handleResult = (id) => {
    if (!id) return;
    sfx.tick();
    const cfg = state.match.cfg;
    if (id === 'again') startMatch({ ...cfg });
    else if (id === 'new') { if (cfg.mode === 'watch') startWatch(); else { state.scene = 'setup'; state.ui.scroll = 0; } }
    else if (id === 'menu') { state.scene = 'title'; state.ui.scroll = 0; }
  };

  const updateFlowScene = (dt, input, handler, key) => {
    const ptr = input.pointer;
    if (key) ensureLayout(state, key);
    if (ptr.pressed) state.ui.drag = { y0: ptr.y, x0: ptr.x, s0: state.ui.scroll, moved: 0 };
    if (state.ui.drag && ptr.down) scrollFlow(ptr);
    if (ptr.released && state.ui.drag) {
      const d = state.ui.drag; state.ui.drag = null;
      const lay = flowMeta();
      const scrollable = lay.lay && lay.lay.contentH > lay.bottom - lay.top;
      if (d.moved < 10) handler(hitScreen(ptr.x, ptr.y, state.ui.scroll));
      else if (!scrollable) handler(hitScreen(d.x0, d.y0, state.ui.scroll));
    }
    const mt = flowMeta();
    const max = mt.lay ? Math.max(0, mt.lay.contentH - (mt.bottom - mt.top)) : 0;
    if (input.keys.pressed.has('Equal') || input.keys.pressed.has('NumpadAdd')) { state.settings.textIdx = Math.min(TEXT_SCALES.length - 1, state.settings.textIdx + 1); save(); }
    if (input.keys.pressed.has('Minus') || input.keys.pressed.has('NumpadSubtract')) { state.settings.textIdx = Math.max(0, state.settings.textIdx - 1); save(); }
    if (input.keys.down.has('ArrowDown')) state.ui.scroll = clamp(state.ui.scroll + 14, 0, max);
    if (input.keys.down.has('ArrowUp')) state.ui.scroll = clamp(state.ui.scroll - 14, 0, max);
  };

  const updateSetup = (dt, input) => {
    const ptr = input.pointer, k = input.keys;
    if (k.pressed.has('KeyO')) state.setup.opp = (state.setup.opp + 1) % (state.demo ? 2 : PROFILES.length);
    if (k.pressed.has('Enter')) { handleSetup('start'); return; }
    if (k.pressed.has('Escape')) { handleSetup('back'); return; }
    if (ptr.pressed && (inRect(SETUP_PINS.start, ptr.x, ptr.y) || inRect(SETUP_PINS.back, ptr.x, ptr.y))) {
      handleSetup(inRect(SETUP_PINS.start, ptr.x, ptr.y) ? 'start' : 'back');
      return;
    }
    updateFlowScene(dt, input, handleSetup, 'setup');
  };

  const updatePages = (input) => {
    const ptr = input.pointer, keys = input.keys;
    const n = pageCount();
    const close = () => { state.scene = state.back === 'play' ? 'play' : 'title'; state.page = 0; };
    const next = () => { if (state.page >= n - 1) close(); else state.page++; };
    const prev = () => { if (state.page <= 0) close(); else state.page--; };
    if (ptr.pressed) {
      if (inRect(REF_NEXT, ptr.x, ptr.y)) next();
      else if (inRect(REF_BACK, ptr.x, ptr.y)) prev();
      else if (inRect(TEXT_DEC, ptr.x, ptr.y)) { state.settings.textIdx = Math.max(0, state.settings.textIdx - 1); save(); }
      else if (inRect(TEXT_INC, ptr.x, ptr.y)) { state.settings.textIdx = Math.min(TEXT_SCALES.length - 1, state.settings.textIdx + 1); save(); }
    }
    if (keys.pressed.has('ArrowRight')) next();
    if (keys.pressed.has('ArrowLeft')) prev();
    if (keys.pressed.has('Escape')) close();
  };

  startAttract();

  return {
    // Watch & Learn and every menu are free; only real play counts against the free preview (a paused duel, or the
    // round summary between rounds, does not).
    isPreviewExempt: () => !(state.scene === 'play' && state.match && state.match.cfg.mode !== 'watch') || state.paused || state.ph === 'between',
    update(dt, input) {
      setPress(input.pointer);
      const frozen = state.paused && (state.scene === 'play' || state.back === 'play');
      if (!frozen) state.t += dt;
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
    render(ctx) {
      switch (state.scene) {
        case 'title': renderTitle(ctx, state); break;
        case 'setup': renderSetup(ctx, state); break;
        case 'settings': renderSettings(ctx, state); break;
        case 'result': renderResult(ctx, state); break;
        case 'demolimit': renderDemoLimit(ctx, state); break;
        case 'howto': renderPages(ctx, state, HOWTO, 'How to Play'); break;
        case 'about': renderPages(ctx, state, ABOUT, 'About'); break;
        case 'rules': renderPages(ctx, state, RULES, 'Rules'); break;
        case 'play':
          if (state.match && state.w) { renderPlay(ctx, state); if (state.ph === 'between' && state.banner) drawBanner(ctx, state); }
          if (state.pauseMenu) renderPause(ctx, state);
          break;
        default: break;
      }
    },
    getState: () => state,
  };
}

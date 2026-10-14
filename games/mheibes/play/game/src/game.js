// Mheibes (Hunt the Ring). State and flow. Drawing is in view.js, the rule book in rules.js, the computer's brains in ai.js, text in content.js.
//
// A match is a few rounds: you are the seeker in one (Stare at faces, Bat fists open, Bas to answer) and the hider in the next (choose the
// fist that holds the ring and a performer, then watch the computer team read you). Two players can pass one phone.
import { layoutFor, TEXT_SCALES, THINK_STEPS, inRect } from './layout.js';
import { HANDS, LEVELS, makeTeam, newRound, doStare, doBat, doBas, handPlayer, handName, kindWords } from './rules.js';
import { newMemory, learn, seekerChoose, hiderChoose } from './ai.js';
import { LESSONS } from './content.js';
import { CARPET_KEYS } from './art.js';
import { render, ui, docMetrics, SETTINGS_ITEMS } from './view.js';

// Fluid viewport (kit 1.7.0): the short side is always 720 units and the long side follows the screen, in portrait and landscape.
export const meta = { width: 720, height: 1560, fluid: { short: 720 } };
export const wheelInput = { dy: 0 };
const DEMO_MATCHES = 2, DEMO_ROUNDS = 2, HINTS = 2, AUTO_REVEAL = 2, STEP_DELAY = 1.25, DONE_HOLD = 1.1, TELL_HOLD = 1.9;
export const ROUND_CHOICES = [4, 6, 8];
export const UNLOCK = { carpet: { garnet: 0, indigo: 1, jade: 3 } };
export const isOpen = (stats, group, key) => (stats.wins || 0) >= (UNLOCK[group][key] || 0);

export function createGame(env) {
  const { rng, storage, audio, monetization, config } = env;
  const state = {
    scene: 'title', t: 0, sceneT: 1, level: 0, rounds: 6, sound: true, calm: false, carpet: 'garnet', textScaleIdx: 0, autoThinkIdx: 1,
    stats: { matches: 0, wins: 0, rounds: 0 }, learned: false, demoMatches: 0, hist: Array(HANDS).fill(0), bas: Array(HANDS).fill(0),
    m: null, rd: null, sel: -1, cursor: 4, kb: false, msg: null, hint: null, hintsLeft: HINTS, tellShow: null, menuArm: 0, lesson: null, result: null,
    doc: { kind: 'rules', scroll: 0 }, autoMode: false, autoPhase: null, autoMove: null, autoTimer: 0, autoPaused: false, frozen: false, dev: config.dev === true,
    lockupRect: null, openAt: Array(HANDS).fill(-9), shake: 0,
  };
  let lastScene = state.scene, docDrag = null;
  const lay = () => layoutFor(meta.width, meta.height);

  // ---- persistence
  storage.get('prefs', null).then((v) => {
    if (!v) return;
    state.level = Math.max(0, Math.min(LEVELS.length - 1, v.level ?? 0)); state.sound = v.sound ?? true; state.calm = v.calm ?? false;
    if (ROUND_CHOICES.includes(v.rounds)) state.rounds = v.rounds;
    if (CARPET_KEYS.includes(v.carpet)) state.carpet = v.carpet;
    state.textScaleIdx = Math.max(0, Math.min(TEXT_SCALES.length - 1, v.textScaleIdx ?? 0)); state.autoThinkIdx = Math.max(0, Math.min(THINK_STEPS.length - 1, v.autoThinkIdx ?? 1));
    audio.setMuted?.(!state.sound);
  });
  storage.get('stats', null).then((v) => { if (v) state.stats = { ...state.stats, ...v }; });
  storage.get('learned', false).then((v) => { state.learned = state.learned || !!v; });
  storage.get('demoMatches', 0).then((v) => { state.demoMatches = Math.max(state.demoMatches, v); });
  storage.get('habits', null).then((v) => { if (v && Array.isArray(v.hist) && v.hist.length === HANDS) { state.hist = v.hist.map(Number); state.bas = (v.bas || state.bas).map(Number); } });
  const savePrefs = () => storage.set('prefs', { level: state.level, sound: state.sound, calm: state.calm, carpet: state.carpet, rounds: state.rounds, textScaleIdx: state.textScaleIdx, autoThinkIdx: state.autoThinkIdx });
  const saveHabits = () => {
    const decay = (a) => { if (a.reduce((x, y) => x + y, 0) > 60) for (let i = 0; i < a.length; i++) a[i] = Math.floor(a[i] / 2); };
    decay(state.hist); decay(state.bas); storage.set('habits', { hist: state.hist, bas: state.bas });
  };

  const dur = (d) => (state.calm ? d * 0.5 : d);
  state.owned = !!monetization.owns?.('unlock_game'); state.restoreBusy = false; state.demo = config.demo === true;
  monetization.onChange?.(() => { state.owned = !!monetization.owns('unlock_game'); });
  const say = (text, hold = 4.5) => { state.msg = { text, t: 0, hold }; };
  const tone = (o) => { if (state.sound && !state.autoMode) audio.tone(o); };
  const clack = (f = 420) => tone({ freq: f * 0.8, to: f * 0.4, dur: 0.07, type: 'sine', vol: 0.12 });
  const thump = () => tone({ freq: 140, to: 70, dur: 0.14, type: 'sine', vol: 0.2 });
  const chime = () => { tone({ freq: 880, to: 1320, dur: 0.3, type: 'triangle', vol: 0.12 }); tone({ freq: 1320, to: 1760, dur: 0.4, type: 'sine', vol: 0.07 }); };
  const buzz = () => tone({ freq: 200, to: 110, dur: 0.3, type: 'sawtooth', vol: 0.07 });
  const tellTone = (k) => tone({ freq: k === 'tense' ? 260 : k === 'glance' ? 520 : k === 'smirk' ? 400 : k === 'bright' ? 680 : 330, dur: 0.1, type: 'sine', vol: 0.08 });
  const level = () => (state.autoMode ? Math.max(1, state.level) : state.level);
  // How disciplined the hiding side is: only the computer's own team holds its poker face; your team shows what its personalities show.
  const hideLevel = () => (state.m && state.m.mode === 'ai' && state.rd && state.rd.role === 'seek' ? level() : 0);
  const forced = () => (state.lesson ? 'tense' : null);

  // ---- match and rounds
  function newMatch(mode, n) {
    const mine = makeTeam(rng), them = makeTeam(rng);
    state.m = { mode, n, i: 0, score: [0, 0], teams: { mine, them }, memAI: newMemory(mine, level()), memMe: newMemory(them, 1) };
  }
  const roleOf = (i) => (i % 2 === 0 ? 'seek' : 'hide');
  function startMatch(mode) {
    if (config.demo && state.demoMatches >= DEMO_MATCHES) { state.scene = 'demo-limit'; return; }
    if (config.demo) { state.demoMatches += 1; storage.set('demoMatches', state.demoMatches); }
    state.autoMode = false; state.lesson = null;
    newMatch(mode, config.demo ? DEMO_ROUNDS : state.rounds);
    startRound();
    monetization.track('match_start', { level: state.level, mode });
  }
  function startAuto() {
    state.autoMode = true; state.autoPaused = false; state.lesson = null;
    newMatch('ai', 4);
    startRound();
  }
  function startRound() {
    const m = state.m, role = roleOf(m.i), hide = role === 'hide';
    const team = hide ? m.teams.mine : m.teams.them;
    Object.assign(state, { scene: 'play', sel: -1, msg: null, hint: null, hintsLeft: HINTS, tellShow: null, menuArm: 0, result: null, shake: 0, autoPhase: null, autoMove: null });
    state.openAt.fill(-9);
    const rd = state.rd = { i: m.i, role, team, round: null, phase: 'pick', timer: 0, pick: -1, performer: -1, doneT: 0, notes: {}, hiderName: '', seekerName: '', after: null, cover: '' };
    if (m.mode === 'two') {
      rd.hiderName = hide ? 'Player 1' : 'Player 2'; rd.seekerName = hide ? 'Player 2' : 'Player 1';
      rd.phase = 'cover'; rd.after = 'pick'; rd.cover = `${rd.hiderName}: you hide the ring. ${rd.seekerName}, look away.`;
      return;
    }
    if (state.autoMode) {
      const h = hiderChoose(rng, team, level(), state.bas);
      rd.round = newRound(h.ring, h.performer);
      rd.phase = 'watch'; rd.timer = 0.8;
      say(hide ? 'Auto Play: your team hides the ring and the computer reads it as the other captain.' : 'Auto Play: the computer is the seeker. Watch it think, then act.', 999);
      return;
    }
    if (hide) { rd.phase = 'pick'; say(`Round ${m.i + 1} of ${m.n}. You are hiding: tap the fist that will hold the ring.`, 8); }
    else {
      const h = hiderChoose(rng, team, state.level, state.bas);
      rd.round = newRound(h.ring, h.performer); rd.phase = 'seek';
      say(`Round ${m.i + 1} of ${m.n}. You seek: tap a face to Stare, then Bat or Bas a fist.`, 7);
    }
  }

  // After the hider's picks (two players, or against the computer): the seeker takes over.
  function beginSeeking() {
    const rd = state.rd, m = state.m;
    rd.round = newRound(rd.pick, rd.performer);
    state.sel = -1; state.msg = null;
    if (m.mode === 'two') { rd.phase = 'cover'; rd.after = 'seek'; rd.cover = `${rd.seekerName}: you seek. ${rd.hiderName}, hand the phone over and look away.`; return; }
    rd.phase = 'watch'; rd.timer = dur(1.2);
    say('The other captain studies the faces. Watch what your team gives away.', 6);
  }

  // The seeker's actions (shared by the human, the lessons and the computer).
  function showTell(t, free) { state.tellShow = { p: t.p, kind: t.kind, side: t.side, t: 0, free: !!free }; tellTone(t.kind); }
  function doStareAt(p, quiet) {
    const rd = state.rd, r = rd.round;
    const res = doStare(r, rng, rd.team, p, hideLevel(), forced());
    if (!res.ok) return res;
    showTell(res.tell, false); (rd.notes[p] ||= []).push(res.tell);
    if (!quiet) say(`${kindWords(res.tell, rd.team)}. ${r.staresLeft} stare${r.staresLeft === 1 ? '' : 's'} left.`, 5);
    return res;
  }
  function doBatAt(h) {
    const rd = state.rd, r = rd.round;
    const res = doBat(r, h, rng, rd.team, hideLevel(), forced());
    if (!res.ok) return res;
    state.openAt[h] = state.t;
    if (res.ring) { buzz(); state.shake = 0.5; finishRound('hit', h); }
    else { thump(); if (res.tell) { showTell(res.tell, true); (rd.notes[res.tell.p] ||= []).push(res.tell); } }
    return res;
  }
  function doBasAt(h) {
    const rd = state.rd, r = rd.round;
    const res = doBas(r, h);
    if (!res.ok) return res;
    state.openAt[h] = state.t;
    finishRound(res.right ? 'right' : 'wrong', h);
    return res;
  }
  function finishRound(kind, h) {
    const rd = state.rd, m = state.m, r = rd.round;
    rd.phase = 'finale'; rd.doneT = 0; state.sel = -1; state.hint = null;
    state.openAt[r.ring] = state.t;
    const seekerIsMe = rd.role === 'seek';
    const toMe = seekerIsMe ? r.scoreSeeker : r.scoreHider, toThem = seekerIsMe ? r.scoreHider : r.scoreSeeker;
    m.score[0] += toMe; m.score[1] += toThem;
    rd.res = { kind, toMe, toThem, seekerIsMe };
    const nm = handName(rd.team, r.ring);
    if (kind === 'right') { chime(); rd.text = `Found it: the ring was in ${nm}. The seeker scores ${r.scoreSeeker}.`; }
    else if (kind === 'hit') rd.text = `That fist held the ring, so the round ends. The hiders score 1.`;
    else { buzz(); rd.text = `Not that one. The ring was in ${nm}. The hiders score 1.`; }
    // learning: the ring is shown, so every stare becomes a labelled example
    if (!state.autoMode) {
      if (rd.role === 'hide' && m.mode === 'ai') { learn(m.memAI, r.stares, r.ring, 1); state.hist[r.ring] += 1; saveHabits(); }
      if (rd.role === 'seek') { learn(m.memMe, r.stares, r.ring, 0.8); if (m.mode === 'ai') { state.bas[h] += 1; saveHabits(); } }
    } else learn(rd.role === 'hide' ? m.memAI : m.memMe, r.stares, r.ring, 1);
  }
  function roundDone() { state.rd.phase = 'done'; state.rd.doneT = 0; }
  function nextRound() {
    const m = state.m; m.i += 1;
    if (m.i >= m.n) { endMatch(); return; }
    startRound();
  }
  function endMatch() {
    const m = state.m, win = m.score[0] > m.score[1] ? 1 : m.score[0] < m.score[1] ? 2 : 0;
    state.result = { score: m.score.slice(), winner: win };
    if (!state.autoMode && m.mode === 'ai') {
      state.stats.matches += 1; state.stats.rounds += m.n; if (win === 1) state.stats.wins += 1;
      storage.set('stats', state.stats);
      monetization.track('match_end', { me: m.score[0], them: m.score[1], level: state.level });
    }
    state.scene = 'over'; state.msg = null;
    tone({ freq: win === 2 ? 330 : 523, to: win === 2 ? 260 : 784, dur: 0.45, type: 'triangle', vol: 0.1 });
  }

  // ---- title and documents
  function updateTitle(tap) {
    if (!tap) return;
    const T = lay().title(), Rw = T.rows, hit = (r) => inRect(r, tap.x, tap.y);
    if (state.lockupRect && inRect(state.lockupRect, tap.x, tap.y)) { env.openArcforgeHome?.(); return; }
    if (state.scene === 'demo-limit') return;
    if (hit(Rw.play)) startMatch('ai');
    else if (hit(Rw.two)) startMatch('two');
    else if (hit(Rw.learn)) startLesson(0);
    else if (hit(Rw.auto)) startAuto();
    else if (hit(Rw.rules)) openDoc('rules'); else if (hit(Rw.how)) openDoc('how'); else if (hit(Rw.about)) openDoc('about'); else if (hit(Rw.settings)) openDoc('settings');
  }
  function openDoc(kind) { state.doc = { kind, scroll: 0 }; docDrag = null; state.msg = null; state.scene = 'doc'; clack(); }
  const settingsAct = (id, v, locked, need) => {
    if (locked) { say(`Win ${need} match${need === 1 ? '' : 'es'} against the computer to unlock this.`, 4); return; }
    if (id === 'level') state.level = v;
    else if (id === 'rounds') state.rounds = v;
    else if (id === 'sound') { state.sound = !!v; audio.setMuted?.(!state.sound); } else if (id === 'calm') state.calm = !!v;
    else if (id === 'carpet') state.carpet = v;
    else if (id === 'restore') {
      clack();
      if (state.owned || state.restoreBusy) return;
      state.restoreBusy = true; say('Checking with the store...', 8);
      Promise.resolve(monetization.restore()).then(() => {
        state.owned = !!monetization.owns?.('unlock_game');
        say(state.owned ? 'Purchase restored. Full game unlocked.' : 'No earlier purchase found on this account.', 4);
      }).catch(() => say('Could not reach the store. Try again later.', 4)).finally(() => { state.restoreBusy = false; });
      return;
    }
    savePrefs(); clack();
  };
  function updateDoc(tap, input) {
    const D = lay().doc, p = input.pointer, keys = input.keys.pressed, max = () => docMetrics.max;
    const setScroll = (v) => { state.doc.scroll = Math.max(0, Math.min(v, max())); };
    if (wheelInput.dy) { setScroll(state.doc.scroll + wheelInput.dy); wheelInput.dy = 0; }
    if (keys.has('ArrowDown')) setScroll(state.doc.scroll + 70); if (keys.has('ArrowUp')) setScroll(state.doc.scroll - 70);
    if (keys.has('PageDown')) setScroll(state.doc.scroll + docMetrics.view * 0.9); if (keys.has('PageUp')) setScroll(state.doc.scroll - docMetrics.view * 0.9);
    if (keys.has('Home')) setScroll(0); if (keys.has('End')) setScroll(max());
    if (p.pressed && max() > 0) {
      if (inRect(D.scrollbar, p.x, p.y)) docDrag = { bar: true };
      else if (inRect(D.viewport, p.x, p.y)) docDrag = { y0: p.y, s0: state.doc.scroll, moved: false };
    }
    if (docDrag) {
      if (!p.down) docDrag = null;
      else if (docDrag.bar) setScroll(((p.y - D.scrollbar.y) / D.scrollbar.h) * max());
      else { if (Math.abs(p.y - docDrag.y0) > 10) docDrag.moved = true; setScroll(docDrag.s0 - (p.y - docDrag.y0)); }
    }
    state.doc.scroll = Math.max(0, Math.min(state.doc.scroll, max()));
    if (keys.has('Escape')) { state.scene = 'title'; return; }
    if (!tap) return;
    if (inRect(D.nav.back, tap.x, tap.y)) { state.scene = 'title'; state.msg = null; clack(); }
    else if (inRect(D.nav.next, tap.x, tap.y)) { if (max() <= 0 || state.doc.scroll >= max() - 1) { state.scene = 'title'; state.msg = null; } else setScroll(state.doc.scroll + docMetrics.view * 0.85); clack(); }
    else if (inRect(D.header.textDec, tap.x, tap.y)) { if (state.textScaleIdx > 0) { state.textScaleIdx--; state.doc.scroll = 0; savePrefs(); clack(); } }
    else if (inRect(D.header.textInc, tap.x, tap.y)) { if (state.textScaleIdx < TEXT_SCALES.length - 1) { state.textScaleIdx++; state.doc.scroll = 0; savePrefs(); clack(); } }
    else if (state.doc.kind === 'settings' && inRect(D.viewport, tap.x, tap.y)) {
      for (const h of ui.hits) if (inRect(h.r, tap.x, tap.y)) { settingsAct(h.id, h.v, h.locked, h.need); break; }
    }
  }

  // ---- the computer as the seeker: one action decided at a time
  function aiDecide() {
    const rd = state.rd, m = state.m;
    const mem = rd.role === 'hide' ? m.memAI : m.memMe;
    return seekerChoose({ round: rd.round, mem, hist: state.hist, level: level(), rng, team: rd.team });
  }
  function aiApply(a) {
    if (a.type === 'stare') doStareAt(a.p, true);
    else if (a.type === 'bat') doBatAt(a.h);
    else doBasAt(a.h);
  }
  function describeAction(a) {
    const rd = state.rd;
    if (a.type === 'stare') return `The seeker stares at ${rd.team[a.p].name}.`;
    if (a.type === 'bat') return `The seeker asks for ${handName(rd.team, a.h)} to be opened.`;
    return `The seeker answers: ${handName(rd.team, a.h)}.`;
  }
  const targetOf = (a) => (a.type === 'stare' ? { p: a.p } : { h: a.h });

  // Auto Play: THINK (the move is decided but held back) -> REVEAL (shown with a glow) -> ACT, for the whole match
  function autoTick(dt) {
    const rd = state.rd;
    if (state.autoPhase === 'reveal') {
      state.autoTimer -= dt; if (state.autoTimer > 0) return;
      const a = state.autoMove; state.autoPhase = null; state.autoMove = null; state.hint = null;
      if (a) aiApply(a); return;
    }
    if (state.autoPhase === 'think') {
      state.autoTimer -= dt; if (state.autoTimer > 0) return;
      const a = state.autoMove; if (a) state.hint = { ...targetOf(a), t: 0 };
      state.autoPhase = 'reveal'; state.autoTimer = AUTO_REVEAL;
      say(a ? `${describeAction(a)} ${a.why}` : 'This is the move.', AUTO_REVEAL + 0.5); return;
    }
    const a = aiDecide(); state.autoMove = a; state.autoPhase = 'think'; state.autoTimer = THINK_STEPS[state.autoThinkIdx];
    say(`${rd.role === 'seek' ? 'You are the seeker' : 'The other captain'} is thinking. What would you do?`, state.autoTimer + AUTO_REVEAL + 1);
  }

  // ---- the play screen
  function leave() { state.scene = 'title'; state.msg = null; state.autoMode = false; state.autoPhase = null; state.autoMove = null; state.autoPaused = false; state.m = null; state.rd = null; state.lesson = null; state.hint = null; state.tellShow = null; }
  function pressMenu(tap, BTN) {
    if (!tap || !inRect(BTN.menu, tap.x, tap.y)) return false;
    if (state.menuArm > 0 || state.rd.phase === 'done') { leave(); return true; }
    state.menuArm = 3; say('Tap Menu again to leave this match.', 3); return true;
  }
  function updatePlay(dt, tap, p, input) {
    const L = lay(), BTN = L.BTN, rd = state.rd;
    if (state.menuArm > 0) state.menuArm = Math.max(0, state.menuArm - dt);
    if (state.tellShow) { state.tellShow.t += dt; if (state.tellShow.t > dur(TELL_HOLD)) state.tellShow = null; }
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt);
    if (state.autoMode) {
      if (tap && inRect(BTN.auto.exit, tap.x, tap.y)) { leave(); return; }
      if (tap && inRect(BTN.auto.pause, tap.x, tap.y)) { state.autoPaused = !state.autoPaused; return; }
      if (tap && inRect(BTN.auto.dec, tap.x, tap.y)) { if (state.autoThinkIdx > 0) { state.autoThinkIdx--; savePrefs(); } return; }
      if (tap && inRect(BTN.auto.inc, tap.x, tap.y)) { if (state.autoThinkIdx < THINK_STEPS.length - 1) { state.autoThinkIdx++; savePrefs(); } return; }
      if (state.autoPaused) { if (state.tellShow) state.tellShow.t -= dt; return; }   // freezes the loop, the search and any tell on screen
      if (state.hint) state.hint.t += dt;
      if (rd.phase === 'finale') { rd.doneT += dt; if (rd.doneT > dur(DONE_HOLD) + 1.4) roundDone(); return; }
      if (rd.phase === 'done') { rd.doneT += dt; if (rd.doneT > 2.4) nextRound(); return; }
      if (rd.phase === 'watch') {
        if (rd.timer > 0) { rd.timer -= dt; return; }
        if (state.tellShow && state.tellShow.t < 1.1 && !state.autoPhase) return;
        autoTick(dt);
      }
      return;
    }
    if (rd.phase === 'finale') { rd.doneT += dt; if (rd.doneT > dur(DONE_HOLD)) roundDone(); return; }
    if (rd.phase === 'done') {
      if (pressMenu(tap, BTN)) return;
      if ((tap && inRect(BTN.cont, tap.x, tap.y)) || input.keys.pressed.has('Enter')) nextRound();
      return;
    }
    if (pressMenu(tap, BTN)) return;
    if (rd.phase === 'cover') {
      if (tap || input.keys.pressed.has('Enter') || input.keys.pressed.has('Space')) {
        rd.phase = rd.after; state.msg = null;
        if (rd.after === 'pick') say(`${rd.hiderName}: tap the fist that will hold the ring.`, 8); else say(`${rd.seekerName}: stare at faces, then Bat or Bas a fist.`, 8);
      }
      return;
    }
    if (rd.phase === 'pick') {
      const hand = tap ? L.fistAt(tap.x, tap.y) : -1;
      if (hand >= 0) { state.sel = hand; rd.pick = hand; clack(520); say(`${handName(rd.team, hand)} will hold the ring. Press Hide here, or tap another fist.`, 8); }
      if ((tap && inRect(BTN.confirm, tap.x, tap.y) && rd.pick >= 0) || (input.keys.pressed.has('Enter') && rd.pick >= 0)) { rd.phase = 'perf'; state.sel = rd.pick; say('Now tap a teammate to be the performer, or press Skip.', 8); clack(); }
      keyCursor(input, (h) => { state.sel = h; rd.pick = h; });
      return;
    }
    if (rd.phase === 'perf') {
      const pl = tap ? L.faceAt(tap.x, tap.y) : -1, ph = tap ? L.fistAt(tap.x, tap.y) : -1;
      const pick = pl >= 0 ? pl : ph >= 0 ? handPlayer(ph) : -1;
      if (pick >= 0) {
        if (pick === handPlayer(rd.pick)) say('The ring holder cannot be the performer. Pick someone else.', 4);
        else { rd.performer = pick; clack(600); beginSeeking(); }
      }
      if (tap && inRect(BTN.skip, tap.x, tap.y)) { rd.performer = -1; beginSeeking(); }
      if (tap && inRect(BTN.undo, tap.x, tap.y)) { rd.phase = 'pick'; say('Tap the fist that will hold the ring.', 6); }
      return;
    }
    if (rd.phase === 'watch') {                                     // the computer seeks; the human only watches
      if (state.tellShow && state.tellShow.t < 1.0) return;
      if (rd.timer > 0) { rd.timer -= dt; return; }
      const a = aiDecide(); say(describeAction(a), 3); aiApply(a); rd.timer = dur(STEP_DELAY);
      return;
    }
    seekInput(tap, input, BTN, L);                                  // the human seeks
  }

  function keyCursor(input, onSelect) {
    const k = input.keys.pressed;
    if (k.has('ArrowLeft')) { state.cursor = (state.cursor + HANDS - 1) % HANDS; state.kb = true; }
    else if (k.has('ArrowRight')) { state.cursor = (state.cursor + 1) % HANDS; state.kb = true; }
    else if (k.has('ArrowUp')) { state.cursor = (state.cursor + HANDS - 2) % HANDS; state.kb = true; }
    else if (k.has('ArrowDown')) { state.cursor = (state.cursor + 2) % HANDS; state.kb = true; }
    if (k.has('Space')) { state.kb = true; onSelect(state.cursor); }
  }
  function seekInput(tap, input, BTN, L) {
    const rd = state.rd, r = rd.round, k = input.keys.pressed;
    if (!r || r.status !== 'seek') return;
    const lesson = state.lesson;
    const select = (h) => { if (r.open[h]) { say('That fist is already open.'); return; } state.sel = state.sel === h ? -1 : h; clack(500); };
    const stare = (p) => {
      if (r.staresLeft <= 0) { say('No stares left this round. Open a fist or answer.', 4); return; }
      const res = doStareAt(p); if (res.ok && lesson && LESSONS[lesson.i].goal.type === 'stare') lessonDone();
    };
    if (tap) {
      const hand = L.fistAt(tap.x, tap.y), face = L.faceAt(tap.x, tap.y);
      if (hand >= 0) select(hand);
      else if (face >= 0) stare(face);
    }
    keyCursor(input, select);
    if (k.has('KeyS')) stare(handPlayer(state.cursor));
    const wantBat = (tap && inRect(BTN.bat, tap.x, tap.y)) || k.has('KeyB'), wantBas = (tap && inRect(BTN.bas, tap.x, tap.y)) || k.has('KeyA') || k.has('Enter');
    const wantHint = (tap && inRect(BTN.hint, tap.x, tap.y)) || k.has('KeyH');
    if (wantBat || wantBas) {
      if (state.sel < 0) { say('First tap a fist.'); return; }
      const h = state.sel;
      if (lesson) {
        const g = LESSONS[lesson.i].goal;
        if (wantBat) {
          if (h === r.ring) { say('That is the ring fist: not that one yet. Pick another.', 4); state.sel = -1; return; }
          doBatAt(h); state.sel = -1; if (g.type === 'bat') lessonDone(); return;
        }
        if (g.type === 'bas' && h === r.ring) { r.status = 'right'; state.openAt[h] = state.t; chime(); state.sel = -1; lessonDone(); return; }
        say(LESSONS[lesson.i].hint, 5); return;
      }
      if (wantBat) doBatAt(h); else doBasAt(h);
      return;
    }
    if (wantHint) {
      if (state.hintsLeft <= 0) { say('No hints left in this round.'); return; }
      state.hintsLeft -= 1;
      const a = seekerChoose({ round: r, mem: state.m.memMe, hist: [], level: 2, rng, team: rd.team });   // honest: it does not know where the ring is
      state.hint = { ...targetOf(a), t: 0 };
      say(`Hint: ${a.why}`, 9);
    }
  }
  function lessonDone() {
    state.lesson.done = true; state.hint = null; chime();
    say(state.lesson.i + 1 < LESSONS.length ? 'Well done. Press Next.' : 'Well done. You know the game.', 20);
  }

  // ---- lessons: the same play screen with a fixed round
  function startLesson(i) {
    const mine = makeTeam(rng), them = makeTeam(rng);
    for (const t of [mine, them]) t.forEach((q, k) => { q.pers = k === 1 ? 'open' : 'steady'; });
    mine[1].name = 'Nawaf'; them[1].name = 'Nawaf';
    state.m = { mode: 'ai', n: 1, i: 0, score: [0, 0], teams: { mine, them }, memAI: newMemory(), memMe: newMemory() };
    Object.assign(state, { scene: 'lesson', sel: -1, msg: null, hint: null, hintsLeft: 99, tellShow: null, autoMode: false, lesson: { i, done: false }, result: null });
    state.openAt.fill(-9);
    const hide = LESSONS[i].goal.type === 'hide';
    const rd = state.rd = { i: 0, role: hide ? 'hide' : 'seek', team: hide ? mine : them, round: null, phase: hide ? 'pick' : 'seek', timer: 0, pick: -1, performer: -1, doneT: 0, notes: {}, hiderName: '', seekerName: '' };
    if (!hide) rd.round = newRound(3, -1);
    say(LESSONS[i].text, 999);
  }
  function updateLesson(dt, tap, p, input) {
    const L = lay(), BTN = L.BTN, ls = state.lesson, rd = state.rd;
    if (state.tellShow) { state.tellShow.t += dt; if (state.tellShow.t > dur(TELL_HOLD)) state.tellShow = null; }
    if (tap && inRect(BTN.menu, tap.x, tap.y)) { leave(); return; }
    if (ls.done) {
      if (tap && inRect(BTN.cont, tap.x, tap.y)) {
        if (ls.i + 1 < LESSONS.length) startLesson(ls.i + 1);
        else { state.learned = true; storage.set('learned', true); leave(); say('You know the game. Try a match against the computer.', 7); }
      }
      return;
    }
    if (rd.phase === 'pick') {
      const hand = tap ? L.fistAt(tap.x, tap.y) : -1;
      if (hand >= 0) { state.sel = hand; rd.pick = hand; clack(520); say('That fist will hold the ring. Now tap a teammate to be your performer.', 9); rd.phase = 'perf'; }
      return;
    }
    if (rd.phase === 'perf') {
      const pl = tap ? L.faceAt(tap.x, tap.y) : -1;
      if (pl >= 0) { if (pl === handPlayer(rd.pick)) say('The ring holder cannot also be the performer.', 4); else { rd.performer = pl; lessonDone(); } }
      return;
    }
    seekInput(tap, input, BTN, L);
  }

  function keyboardTap(input) {
    const k = input.keys.pressed, sc = state.scene, L = lay();
    if (input.pointer.pressed) { state.kb = false; return null; }
    const at = (r) => ({ x: r.x + 5, y: r.y + 5 });
    if (sc === 'title') { if (k.has('Enter') || k.has('Space')) return at(L.title().rows.play); return null; }
    if (sc === 'over') { if (k.has('Enter') || k.has('Space')) return at(L.over.again); if (k.has('Escape')) return at(L.over.back); return null; }
    return null;
  }

  // Developer / screenshot hook (used with ?shot=1&seed=... or ?spec=... by main.js; never reachable by a player).
  function devScene(spec) {
    state.frozen = true; if (spec.textScale !== undefined) state.textScaleIdx = spec.textScale;
    if (spec.carpet) state.carpet = spec.carpet; if (spec.calm !== undefined) state.calm = spec.calm;
    if (spec.level !== undefined) state.level = spec.level;
    if (spec.scene === 'title') { state.scene = 'title'; }
    else if (spec.scene === 'doc') { openDoc(spec.doc || 'rules'); state.doc.scroll = spec.scroll || 0; }
    else if (spec.scene === 'lesson') { startLesson(spec.lesson || 0); if (spec.sel !== undefined) state.sel = spec.sel; if (spec.tell) state.tellShow = { p: spec.tell.p, kind: spec.tell.kind, side: spec.tell.side || 0, t: 0.2 }; }
    else if (spec.scene === 'play' || spec.scene === 'over' || spec.scene === 'auto') {
      if (spec.scene === 'auto') startAuto(); else { startMatch('ai'); state.m.i = spec.round ?? 0; startRound(); }
      const m = state.m, rd = state.rd; state.msg = null;
      if (spec.score) m.score = spec.score.slice();
      if (spec.team) rd.team.forEach((q, i) => { if (spec.team[i]) Object.assign(q, spec.team[i]); });
      if (spec.ring !== undefined) {
        rd.round = newRound(spec.ring, spec.performer ?? -1); rd.pick = spec.ring; rd.performer = spec.performer ?? -1;
        rd.phase = rd.role === 'hide' ? 'watch' : 'seek'; if (rd.phase === 'watch') rd.timer = 99;
      }
      const r = rd.round;
      if (r) {
        for (const h of spec.open || []) { r.open[h] = true; r.opened += 1; }
        for (const s of spec.stares || []) { const o = { p: s.p, kind: s.kind, side: s.side || 0 }; r.stares.push(o); r.staresLeft -= 1; (rd.notes[s.p] ||= []).push(o); }
        if (spec.end) { if (spec.end === 'right') doBasAt(r.ring); else if (spec.end === 'hit') doBatAt(r.ring); else doBasAt(r.ring === 0 ? 2 : 0); rd.phase = 'done'; }
      }
      if (spec.tell) state.tellShow = { p: spec.tell.p, kind: spec.tell.kind, side: spec.tell.side || 0, t: 0.2 };
      if (spec.sel !== undefined) state.sel = spec.sel;
      if (spec.pick !== undefined && rd.phase === 'pick') { rd.pick = spec.pick; state.sel = spec.pick; }
      if (spec.hint) state.hint = { ...spec.hint, t: 0 };
      if (spec.phase) rd.phase = spec.phase;
      if (spec.msg) say(spec.msg, 99);
      if (spec.scene === 'auto') state.autoPaused = !!spec.paused;
      if (spec.scene === 'over') { m.i = m.n - 1; endMatch(); }
    }
    state.sceneT = 1; lastScene = state.scene;
  }

  return {
    update(dt, input) {
      state.t += dt;
      if (state.scene !== lastScene) { lastScene = state.scene; state.sceneT = 0; } else state.sceneT += dt;
      if (state.scene !== 'doc') wheelInput.dy = 0;
      if (state.msg && !(state.autoMode && state.autoPaused)) { state.msg.t += dt; if (state.msg.t > state.msg.hold) state.msg = null; }
      if (state.frozen) return;
      const p = input.pointer, kbd = keyboardTap(input);
      const tap = p.pressed ? { x: p.x, y: p.y } : kbd;
      if (state.scene === 'title' || state.scene === 'demo-limit') updateTitle(tap);
      else if (state.scene === 'doc') updateDoc(tap, input);
      else if (state.scene === 'play') updatePlay(dt, tap, p, input);
      else if (state.scene === 'lesson') updateLesson(dt, tap, p, input);
      else if (state.scene === 'over' && tap) {
        const O = lay().over;
        if (inRect(O.again, tap.x, tap.y)) { if (state.autoMode) startAuto(); else startMatch(state.m && state.m.mode === 'two' ? 'two' : 'ai'); }
        else if (inRect(O.back, tap.x, tap.y)) leave();
      }
    },
    render(ctx, view) {
      const L = layoutFor(view?.width ?? meta.width, view?.height ?? meta.height);
      // the kit's "Preview 1:23" pill: top centre in portrait; in landscape it moves into the side card, clear of the players
      meta.previewBadge = L.land && L.panel ? { x: L.panel.x + L.panel.w / 2, y: L.header.y + L.header.h + 6, align: 'center' } : { x: L.w / 2, y: L.ins.t + 4, align: 'center' };
      render(ctx, state, L, { settings: (st) => SETTINGS_ITEMS(st, isOpen, UNLOCK, ROUND_CHOICES) });
    },
    getState: () => state,
    devScene,
    // kit 1.6.1: the free-preview timer counts real play only: a live round (picking, seeking or watching). Menus, Rules, lessons, Auto Play,
    // cover screens, results and the demo-limit screen are exempt.
    isPreviewExempt() { return !(state.scene === 'play' && !state.autoMode && state.rd && ['pick', 'perf', 'seek', 'watch'].includes(state.rd.phase)); },
  };
}

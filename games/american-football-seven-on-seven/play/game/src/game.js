// American Football: 7 on 7. State and flow. The play engine is in sim.js / match.js / engine.js, the computer's coach in coach.js, drawing in view.js / menus.js / art.js.
// Scenes: title, setup, settings, learn, howto / about / rules, demolimit, play (a real game, Watch & Learn and the lessons), result.
// The 3D presenter (web/view3d, web/main.js) only reads getState(): state.E (the engine: match, play, ball, events).
import { W, H, PLAY, TEXT_SCALES, THINK_STEPS, REVEAL_SECS, TEXT_DEC, TEXT_INC, REF_BACK, REF_NEXT, SETUP_PINS, READ, LY, syncLayout, inRect, resetPlayLayout } from './layout.js';
import { LEVELS, ROLES, roleById, FIELD, TEAM_LEVEL } from './consts.js';
import { OFF_PLAYS, DEF_CALLS } from './plays.js';
import { createEngine, step as engineStep, choose, exportSave, importSave, validSave, aiPick } from './engine.js';
import { receiverRead } from './sim.js';
import { thinkOffense, thinkDefense, callName } from './coach.js';
import { controlButtons, ctlHit, ctlRects, renderPlay, playLayoutNow, drawOverlayFor } from './view.js';
import { renderTitle, renderSetup, renderSettings, renderResult, renderPause, renderPages, renderDemoLimit, renderLearn, renderHint, renderLesson, renderCall, renderWatchCall, renderRoleIntro, hitScreen, flowMeta, readerMeta, ensureLayout, resetMenus, resetPages, PAIRS, getLockTap, setLockDown } from './menus.js';
import { ABOUT, HOWTO, RULES, LESSONS } from './content.js';
import { setPress } from './ui.js';

export const meta = { width: W, height: H, fluid: { short: 720 } };
const DEMO_GAME_CAP = 1;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function createGame(env) {
  const { rng, audio, storage, config, monetization } = env;
  resetMenus(); resetPlayLayout();
  const fx = rng.fork();
  let shotMode = false, shotZoom = -1;
  try { shotMode = /[?&]shot=/.test(globalThis.location.search); } catch { shotMode = false; }
  try { const z = /[?&]zoom=(\d)/.exec(globalThis.location.search); if (z) shotZoom = Number(z[1]); } catch { shotZoom = -1; }
  const shotSeed = config.seed | 0;

  const state = {
    scene: 'title', back: 'title', t: 0, paused: false, pauseMenu: false, demo: !!config.demo, v3: false, credits: '', headless: false,
    settings: { sound: true, textIdx: 0, thinkIdx: 1, women: false },
    record: { played: 0, wins: [0, 0, 0, 0, 0], draws: 0, lost: 0, demoGames: 0, lessons: [] },
    setup: { level: 0, quarter: 1, role: 'QB' },
    ui: { scroll: 0, drag: null, stick: null, press: null, holdT: 0, cscroll: 0 },
    page: 0, resume: null, loaded: false, E: null, mode: 'ai', hint: null, watch: null, lesson: null, over: null, toast: '', toastT: 0, restoreMsg: '', setupMsg: '', sel: null, roleIntro: false,
    buttons: [], viewRect: { x: 0, y: 176, w: W, h: 880 }, lyKey: '', shot: false, seenSeq: 0, lastPhase: '', evSeen: 0, evP: null, hide3d: false,
  };

  // ---- persistence -----------------------------------------------------------------------------------------------------------------------------------
  const save = () => { storage.set('settings', state.settings); storage.set('record', state.record); };
  const clearResume = () => { state.resume = null; storage.remove('resume'); };
  const saveResume = () => {
    const E = state.E;
    if (!E || state.mode !== 'ai' || E.m.over) { clearResume(); return; }
    state.resume = exportSave(E); storage.set('resume', state.resume);
  };
  Promise.all([storage.get('settings', null), storage.get('record', null), storage.get('resume', null)]).then(([s, r, res]) => {
    if (s) Object.assign(state.settings, s);
    if (r) Object.assign(state.record, r);
    const st = state.settings;
    st.textIdx = clamp(st.textIdx | 0, 0, TEXT_SCALES.length - 1); st.thinkIdx = clamp(st.thinkIdx | 0, 0, THINK_STEPS.length - 1);
    if (!Array.isArray(state.record.wins) || state.record.wins.length < 5) state.record.wins = [0, 0, 0, 0, 0];
    if (!Array.isArray(state.record.lessons)) state.record.lessons = [];
    if (validSave(res) && !shotMode) state.resume = res;
    state.loaded = true; audio.setMuted?.(!st.sound);
  }).catch(() => { state.loaded = true; });

  // ---- sound ---------------------------------------------------------------------------------------------------------------------------------------------
  const tone = (o) => { if (state.settings.sound) audio.tone(o); };
  const sfx = {
    tick: () => tone({ freq: 880, dur: 0.04, type: 'triangle', vol: 0.05 }),
    whistle: () => { tone({ freq: 2300, to: 2150, dur: 0.22, type: 'sine', vol: 0.06 }); tone({ freq: 2420, to: 2250, dur: 0.22, type: 'sine', vol: 0.04 }); },
    thud: () => { tone({ freq: 150, to: 55, dur: 0.18, type: 'sine', vol: 0.26 }); tone({ freq: 400, to: 200, dur: 0.05, type: 'triangle', vol: 0.05 }); },
    kick: () => tone({ freq: 220, to: 90, dur: 0.14, type: 'sine', vol: 0.22 }),
    catch: () => tone({ freq: 700, to: 500, dur: 0.07, type: 'triangle', vol: 0.12 }),
    throw: () => tone({ freq: 500, to: 900, dur: 0.12, type: 'sine', vol: 0.05 }),
    score: () => [0, 4, 7, 12].forEach((n, i) => tone({ freq: 523 * Math.pow(2, n / 12), dur: 0.25 + i * 0.05, type: 'triangle', vol: 0.1 })),
    lose: () => tone({ freq: 300, to: 120, dur: 0.4, type: 'sawtooth', vol: 0.05 }),
    win: () => [0, 2, 4, 7, 9, 12].forEach((n, i) => tone({ freq: 440 * Math.pow(2, n / 12), dur: 0.3 + i * 0.05, type: 'triangle', vol: 0.1 })),
    block: () => tone({ freq: 120, to: 90, dur: 0.06, type: 'square', vol: 0.04 }),
  };
  const toast = (text) => { state.toast = text; state.toastT = 2; };

  // ---- starting games -------------------------------------------------------------------------------------------------------------------------------------
  const afterNewEngine = () => {
    state.hint = null; state.watch = null; state.over = null; state.paused = false; state.pauseMenu = false; state.scene = 'play'; state.ui.scroll = 0; state.sel = null; state.seenSeq = 0; state.evSeen = 0; state.evP = null; state.lastPhase = '';
    resetPlayLayout(); onNeed();
  };
  const startGame = (cfg) => {
    if (state.demo && cfg.mode === 'ai' && state.record.demoGames >= DEMO_GAME_CAP) { state.scene = 'demolimit'; state.ui.scroll = 0; return; }
    state.mode = cfg.mode; state.lesson = null;
    const role = cfg.role || state.setup.role;
    const first = cfg.first ?? fx.int(2);
    state.E = createEngine(rng.fork(), { mode: cfg.mode, level: cfg.level, quarter: cfg.quarter, first, role, levels: cfg.levels, auto: cfg.auto });
    state.roleIntro = cfg.mode === 'ai' && !state.shot;
    afterNewEngine();
    if (state.roleIntro) state.paused = true;
  };
  const startWatch = () => { const a = 1 + fx.int(3), b = Math.min(4, a + 1 + fx.int(2)); startGame({ mode: 'watch', level: b, quarter: 0, levels: [a, b], role: 'QB' }); };
  const resumeGame = () => {
    if (!state.resume) return;
    if (state.demo && state.record.demoGames >= DEMO_GAME_CAP) { clearResume(); state.scene = 'demolimit'; return; }
    state.mode = 'ai'; state.lesson = null;
    state.setup.level = state.resume.cfg.level ?? 0; state.setup.role = state.resume.cfg.role || 'QB';
    state.E = importSave(rng.fork(), state.resume);
    state.roleIntro = false; afterNewEngine(); state.paused = true; state.pauseMenu = true;
  };
  const startLesson = (idx) => {
    const def = LESSONS[idx];
    state.mode = 'lesson';
    state.E = createEngine(rng.fork(), { mode: 'ai', level: 0, quarter: 1, first: def.kind === 'stop' ? 1 : 0, role: state.setup.role, lesson: def.id });
    state.E.m.clock = 9999;
    state.lesson = { idx, def, phase: 'intro' };
    state.roleIntro = false;
    afterNewEngine(); state.paused = true;
  };
  const leaveGame = () => {
    if (state.mode === 'ai') saveResume();
    state.scene = state.mode === 'lesson' ? 'learn' : 'title'; state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; state.hint = null; state.watch = null; state.lesson = null;
  };
  const finishGame = () => {
    if (state.scene === 'result') return;
    const E = state.E, m = E.m, rec = state.record;
    state.scene = 'result'; state.ui.scroll = 0;
    state.over = { winner: m.over.winner, score: [...m.score], mode: state.mode, level: state.setup.level, stats: JSON.parse(JSON.stringify(m.stats)) };
    clearResume();
    if (state.mode === 'ai') {
      rec.played++;
      if (m.over.winner === 0) { rec.wins[state.setup.level] = (rec.wins[state.setup.level] | 0) + 1; sfx.win(); } else if (m.over.winner === 1) { rec.lost++; sfx.lose(); } else rec.draws++;
      if (state.demo) rec.demoGames++;
    }
    save();
  };

  // ---- needs: what the engine asks the screen ---------------------------------------------------------------------------------------------------------------
  const onNeed = () => {
    const E = state.E;
    state.watch = null; state.ui.scroll = 0; state.hint = null;
    if (E.phase === 'call' && E.need && state.mode === 'ai') saveResume();
    if (E.need && E.need.kind === 'offcall' && E.need.human) state.sel = null;
    state.ui.stick = null; state.ui.press = null;
    if (state.lesson && state.lesson.phase === 'play' && E.need && E.need.kind === 'offcall' && state.lesson.def.call) state.sel = state.lesson.def.call;
  };
  const humanNeed = () => { const E = state.E; return !!E && E.phase === 'call' && !!E.need && E.need.human; };
  const watchNeed = () => { const E = state.E; return !!E && E.phase === 'call' && !!E.need && !E.need.human && !!E.need.pick && state.mode === 'watch'; };

  // ---- Think ------------------------------------------------------------------------------------------------------------------------------------------------------------
  const sideWord = (dx) => (dx < -0.5 ? 'to your left' : dx > 0.5 ? 'to your right' : 'right at you');
  function liveHint() {
    const E = state.E, P = E.P;
    if (!P || P.phase !== 'live' || P.dead || E.humanId < 0) return null;
    const a = P.actors[E.humanId];
    const lines = [];
    const near = (pred) => { let b = null, bd = 1e9; for (const o of P.actors) { if (!pred(o) || o.wrap || o.down) continue; const d = Math.hypot(o.x - a.x, o.z - a.z); if (d < bd) { bd = d; b = o; } } return b ? { o: b, d: bd } : null; };
    if (a.slot === 'QB' && a.q && P.ball.holder === a.id && (a.q.mode === 'read' || a.q.mode === 'drop')) {
      const reads = receiverRead(P, a).filter((r) => r.inb && r.d > 2.5).sort((p, q) => q.sep - p.sep);
      const lab = { WA: 'the left receiver', TE: 'the tight end', WB: 'the right receiver', RB: 'the running back' };
      if (reads.length) { const r = reads[0]; const ideal = clamp((r.d - 8) / 24, 0, 1); lines.push(`Best read: ${lab[r.slot]}, about ${r.sep.toFixed(1)} yards from the nearest defender, ${Math.round(r.d)} yards away.`, ideal < 0.1 ? 'Tap the button for a flat, fast throw.' : `Hold the button until the white bar reaches the gold mark (about ${(Math.round((0.18 + 0.6 * ideal) * 10) / 10).toFixed(1)} s) and let go.`); }
      const rush = near((o) => o.team !== a.team && o.job && (o.job.k === 'rush' || o.job.k === 'pursue'));
      if (rush && rush.d < 5) lines.push(`A rusher is ${rush.d.toFixed(1)} yards away: throw soon or drag away from him.`);
    } else if (a.hasBall) {
      const t = near((o) => o.team !== a.team);
      if (t) lines.push(`The nearest defender is ${t.d.toFixed(1)} yards away ${sideWord(t.o.x - a.x)}.`, t.d < 3 ? `Juke ${t.o.x > a.x ? 'left' : 'right'}, away from him, just before he reaches you.` : 'Keep running toward the goal line and tap Burst in open space.');
    } else if (a.unit === 'off') {
      if (P.thrown && P.passTarget === a.id) { const rem = P.ball.fly ? Math.max(0, P.ball.fly.t0 + P.ball.fly.T - P.t) : 0; lines.push(`The ball is coming to you and arrives in ${rem.toFixed(1)} seconds: tap Hands as it reaches you.`); }
      else { const d = near((o) => o.team !== a.team); lines.push('Run your route; the quarterback looks for open receivers.'); if (d) lines.push(`Nearest defender: ${d.d.toFixed(1)} yards ${sideWord(d.o.x - a.x)}.`); }
    } else {
      const c = P.ball.holder >= 0 ? P.actors[P.ball.holder] : null;
      if (c && c.team !== a.team) { const d = Math.hypot(c.x - a.x, c.z - a.z); lines.push(`The ball carrier is ${d.toFixed(1)} yards away ${sideWord(c.x - a.x)}.`, d < 3.4 ? 'Tackle now; the dive reaches about 3 yards.' : 'Run at him; use Burst to close the gap.'); }
      else if (P.thrown && P.ball.st === 'air') lines.push('The ball is in the air: get to where it lands and tap Swat just as it arrives.');
      else lines.push(a.slot.startsWith('DL') ? 'Rush the quarterback. If a blocker grabs you, tap Move once the block has held for a moment.' : 'Cover your man and watch the quarterback.');
    }
    return lines.length ? { title: 'Think', lines, apply: null } : null;
  }
  function buildHint() {
    const E = state.E;
    if (humanNeed()) {
      const n = E.need;
      if (n.kind === 'offcall') { const th = thinkOffense(E.m); return { title: 'Think', lines: th.lines, apply: { kind: 'sel', value: th.best }, applyLabel: `Select ${callName(th.best)}` }; }
      if (n.kind === 'defcall') { const th = thinkDefense(E.m); return { title: 'Think', lines: th.lines, apply: { kind: 'sel', value: th.best }, applyLabel: `Select ${callName(th.best)}` }; }
      if (n.kind === 'fourth' || n.kind === 'try') { const p = aiPick(E, n); return { title: 'Think', lines: p.why, apply: { kind: n.kind, value: p.value }, applyLabel: 'Do it' }; }
    }
    return liveHint();
  }
  const openHint = () => { const h = buildHint(); if (!h) { toast('Nothing to think about right now'); return; } state.hint = h; state.paused = true; state.ui.scroll = 0; sfx.tick(); };
  const closeHint = () => { state.hint = null; state.paused = false; state.ui.scroll = 0; };
  const applyHint = () => {
    const h = state.hint; if (!h || !h.apply) { closeHint(); return; }
    const a = h.apply; closeHint();
    if (a.kind === 'sel') state.sel = a.value; else if (choose(state.E, a.value)) onNeed();
  };

  // ---- Watch & Learn: think -> reveal -> act ----------------------------------------------------------------------------------------------------------------------------
  const watchStep = (dt) => {
    const E = state.E, need = E.need;
    if (!need || !need.pick) { state.watch = null; return; }
    const key = `${need.kind}:${E.m.plays}:${E.m.down}:${E.calls.off || ''}`;
    if (!state.watch || state.watch.key !== key) state.watch = { key, phase: 'think', t: 0, dur: THINK_STEPS[state.settings.thinkIdx] };
    const w = state.watch; w.t += dt;
    if (w.phase === 'think' && w.t >= w.dur) { w.phase = 'reveal'; w.t = 0; }
    else if (w.phase === 'reveal' && w.t >= REVEAL_SECS) { state.watch = null; choose(E, need.pick.value); onNeed(); }
  };

  // ---- the user's player: gestures and buttons -> intents ------------------------------------------------------------------------------------------------------------------------
  const lobOf = (hold) => (hold < 0.18 ? 0 : clamp((hold - 0.18) / 0.6, 0, 1));
  const throwTo = (slot, hold) => { const P = state.E.P; if (!P) return; P.intent.throwTo = slot; P.intent.lob = lobOf(hold); sfx.throw(); };
  const pressId = (id) => {
    const P = state.E.P; if (!P) return; const I = P.intent;
    if (id === 'burst') I.burst = true; else if (id === 'juke-l') I.juke = -1; else if (id === 'juke-r') I.juke = 1; else if (id === 'spin') I.spin = true;
    else if (id === 'hands') I.catchPress = true; else if (id === 'tackle') I.tackle = true; else if (id === 'swat') I.swat = true; else if (id === 'move') I.rush = true;
  };
  const intentFrom = (input) => {
    const E = state.E, P = E.P;
    if (!P || P.phase !== 'live' || E.humanId < 0) return;
    const I = P.intent, k = input.keys;
    let mx = 0, mz = 0;
    const side = state.v3 && LY.land;      // landscape 3D: the camera is on the sideline, so the controls turn with the picture (screen right = downfield)
    if (state.ui.stick) { if (side) { mx = state.ui.stick.dy / 70; mz = state.ui.stick.dx / 70; } else { mx = state.ui.stick.dx / 70; mz = -state.ui.stick.dy / 70; } }
    const kl = k.down.has('ArrowLeft') || k.down.has('KeyA'), kr = k.down.has('ArrowRight') || k.down.has('KeyD'), ku = k.down.has('ArrowUp') || k.down.has('KeyW'), kd = k.down.has('ArrowDown') || k.down.has('KeyS');
    if (side) { if (kl) mz -= 1; if (kr) mz += 1; if (ku) mx -= 1; if (kd) mx += 1; } else { if (kl) mx -= 1; if (kr) mx += 1; if (ku) mz += 1; if (kd) mz -= 1; }
    const l = Math.hypot(mx, mz); if (l > 1) { mx /= l; mz /= l; }
    I.mx = mx; I.mz = mz;
    const a = P.actors[E.humanId];
    if (k.pressed.has('KeyB')) pressId('burst'); if (k.pressed.has('KeyJ')) pressId('juke-l'); if (k.pressed.has('KeyL')) pressId('juke-r'); if (k.pressed.has('KeyK')) pressId('spin');
    if (k.pressed.has('Space')) pressId(a.hasBall ? 'spin' : a.unit === 'off' ? 'hands' : 'tackle');
    if (k.pressed.has('KeyM')) pressId('move'); if (k.pressed.has('KeyZ')) pressId('swat');
    ['WA', 'TE', 'WB', 'RB'].forEach((s, i) => { const code = `Digit${i + 1}`; if (k.pressed.has(code)) state.ui.keyHold = { slot: s, t: 0, code }; });
    if (state.ui.keyHold) {
      state.ui.keyHold.t += 1 / 60; state.ui.holdT = state.ui.keyHold.t;
      if (!k.down.has(state.ui.keyHold.code)) { throwTo(state.ui.keyHold.slot, state.ui.keyHold.t); state.ui.keyHold = null; state.ui.holdT = 0; }
    }
  };

  // ---- pause ------------------------------------------------------------------------------------------------------------------------------------------------------------------
  const openPause = () => { if (state.scene !== 'play') return; state.paused = true; state.pauseMenu = true; state.ui.scroll = 0; state.ui.stick = null; state.ui.press = null; };
  const closePause = () => { state.paused = false; state.pauseMenu = false; state.ui.scroll = 0; };

  // ---- events from the sim: sounds -----------------------------------------------------------------------------------------------------------------------------------
  const consumeEvents = () => {
    const P = state.E.P; if (!P) return;
    if (P !== state.evP) { state.evP = P; state.evSeen = 0; }
    for (const e of P.events) {
      if (e.id <= state.evSeen) continue;
      state.evSeen = e.id;
      if (e.type === 'snap' || e.type === 'handoff') sfx.tick(); else if (e.type === 'catch' || e.type === 'intercept') sfx.catch(); else if (e.type === 'tackle') sfx.thud(); else if (e.type === 'kick') sfx.kick();
      else if (e.type === 'block') sfx.block(); else if (e.type === 'whistle') sfx.whistle();
    }
  };
  const onResult = () => {
    const E = state.E, out = E.res;
    if (!out) return;
    if (out.score && out.scoringTeam >= 0) { if (E.humanTeam === out.scoringTeam || state.mode === 'watch') sfx.score(); else sfx.lose(); }
    lessonCheck(out);
  };

  // ---- lessons ----------------------------------------------------------------------------------------------------------------------------------------------------------------
  const lessonCheck = (out) => {
    const L = state.lesson; if (!L || L.phase !== 'play') return;
    const E = state.E, r = E.lastPlay && E.lastPlay.result;
    const k = L.def.kind;
    let ok = false;
    if (k === 'first') ok = !!out.firstDown || !!(r && r.td);
    else if (k === 'complete') ok = !!(r && r.completed);
    else if (k === 'any') ok = true;
    else if (k === 'stop') ok = !!(r && (r.kind === 'incomplete' || r.yards <= 3 || r.sack || r.turnover));
    if (ok) { L.phase = 'done'; state.record.lessons = Array.from(new Set([...state.record.lessons, L.def.id])); save(); sfx.win(); }
    else if (k !== 'first' || E.m.down === 1 && !out.firstDown && E.m.plays > 6) L.phase = 'retry';
    if (L.phase !== 'play') { state.paused = true; state.ui.scroll = 0; }
  };

  // ---- the play scene -----------------------------------------------------------------------------------------------------------------------------------------------------------
  function scrollFlow(ptr) {
    const d = state.ui.drag, mt = flowMeta();
    d.moved = Math.max(d.moved, Math.abs(ptr.y - d.y0));
    const P = d.left && mt.left ? mt.left : mt;
    if (d.moved >= 10 && P.lay) { const max = Math.max(0, P.lay.contentH - (P.bottom - P.top)); const v = clamp(d.s0 - (ptr.y - d.y0), 0, max); if (d.left) state.ui.scrollL = v; else state.ui.scroll = v; }
  }
  const updateFlowOverlay = (input, key, handler) => {
    const ptr = input.pointer;
    ensureLayout(state, key);
    if (ptr.pressed) { const lf = !!(flowMeta().left && ptr.x < flowMeta().left.box.x + flowMeta().left.box.w + 12); state.ui.drag = { y0: ptr.y, x0: ptr.x, s0: lf ? (state.ui.scrollL || 0) : state.ui.scroll, moved: 0, left: lf }; }
    if (state.ui.drag && ptr.down) scrollFlow(ptr);
    if (ptr.released && state.ui.drag) { const d = state.ui.drag; state.ui.drag = null; if (d.moved < 10) handler(hitScreen(ptr.x, ptr.y, state.ui.scroll)); }
    const mt = flowMeta(), max = mt && mt.lay ? Math.max(0, mt.lay.contentH - (mt.bottom - mt.top)) : 0;
    if (input.keys.down.has('ArrowDown')) state.ui.scroll = clamp(state.ui.scroll + 14, 0, max);
    if (input.keys.down.has('ArrowUp')) state.ui.scroll = clamp(state.ui.scroll - 14, 0, max);
  };
  const handlePauseTap = (id) => {
    if (!id) return; sfx.tick();
    if (id === 'resume') closePause();
    else if (id === 'p-rules') { state.back = 'play'; state.scene = 'rules'; state.page = 0; } else if (id === 'p-howto') { state.back = 'play'; state.scene = 'howto'; state.page = 0; }
    else if (id === 'p-sound') { state.settings.sound = !state.settings.sound; audio.setMuted?.(!state.settings.sound); save(); }
    else if (id === 'quit') leaveGame();
  };
  const handleLessonTap = (id) => {
    const L = state.lesson; if (!id || !L) return; sfx.tick();
    if (id === 'ls-start') { L.phase = 'play'; state.paused = false; state.ui.scroll = 0; if (state.E.need && state.E.need.kind === 'offcall' && L.def.call) state.sel = L.def.call; }
    else if (id === 'ls-retry') startLesson(L.idx);
    else if (id === 'ls-next') { const n = L.idx + 1; if (n < LESSONS.length) startLesson(n); else { state.scene = 'learn'; state.lesson = null; state.paused = false; state.ui.scroll = 0; } }
    else if (id === 'ls-back') { state.scene = 'learn'; state.lesson = null; state.paused = false; state.ui.scroll = 0; }
  };
  const handleCallTap = (id) => {
    if (!id) return;
    const E = state.E, need = E.need; sfx.tick();
    if (need.kind === 'fourth') { if (id === 'think4') openHint(); else if (choose(E, id)) onNeed(); return; }
    if (need.kind === 'try') { if (choose(E, id)) onNeed(); return; }
    if (id.startsWith('pick-')) {
      const v = id.slice(5);
      if (state.lesson && state.lesson.phase === 'play' && state.lesson.def.call && need.kind === 'offcall' && v !== state.lesson.def.call) { toast('Pick the play the lesson asks for'); return; }
      state.sel = v;
    }
  };
  const runSelected = () => {
    const E = state.E, need = E.need; if (!need || (need.kind !== 'offcall' && need.kind !== 'defcall')) return;
    const list = need.kind === 'offcall' ? OFF_PLAYS : DEF_CALLS;
    const v = state.sel && list.some((p) => p.id === state.sel) ? state.sel : list[0].id;
    if (choose(E, v)) onNeed();
  };
  const updateCall = (input) => {
    const ptr = input.pointer, k = input.keys, need = state.E.need;
    const key = need.kind === 'fourth' ? 'fourth' : need.kind === 'try' ? 'try' : 'call';
    if (state.hint) { updateFlowOverlay(input, 'hint', (id) => { if (id === 'hint-do') applyHint(); else if (id === 'hint-close') closeHint(); }); return; }
    ensureLayout(state, key);
    if (key === 'call') {
      if (k.pressed.has('Enter') || k.pressed.has('Space')) { runSelected(); return; }
      if (ptr.pressed && inRect(SETUP_PINS.start, ptr.x, ptr.y)) { runSelected(); return; }
      if (ptr.pressed && inRect(SETUP_PINS.back, ptr.x, ptr.y)) { openHint(); return; }
    }
    if (k.pressed.has('KeyH')) openHint();
    updateFlowScene(input, handleCallTap, key);
  };
  const updateWatchCall = (input, dt) => {
    const ptr = input.pointer;
    if (ptr.pressed && inRect(LY.watchPause, ptr.x, ptr.y)) { state.paused = !state.paused; sfx.tick(); return; }
    if (input.keys.pressed.has('KeyP')) state.paused = !state.paused;
    if (state.paused) return;
    watchStep(dt);
  };
  const addMarks = (E) => {
    const P = E.P; if (!P) return;
    const a = P.actors[E.humanId];
    if (!a || !a.q || a.slot !== 'QB') return;
    const reads = receiverRead(P, a);
    for (const b of state.buttons) if (b.slot) { const r = reads.find((x) => x.slot === b.slot); if (r) { const ideal = clamp((r.d - 8) / 24, 0, 1); b.mark = ideal < 0.05 ? 0.02 : (0.18 + 0.6 * ideal) / 0.9; } }
  };
  const trackResult = () => {
    const E = state.E;
    if (E.seq !== state.seenSeq) { state.seenSeq = E.seq; onResult(); }
    if (E.phase === 'call' && state.lastPhase !== 'call') onNeed();
    if (E.m.over && E.phase === 'over') finishGame();
    state.lastPhase = E.phase;
  };
  const updatePlay = (dt, input) => {
    const ptr = input.pointer, keys = input.keys, E = state.E;
    if (!E) { state.scene = 'title'; return; }
    if (state.pauseMenu) { updateFlowOverlay(input, 'pause', handlePauseTap); if (keys.pressed.has('Escape')) closePause(); return; }
    if (state.roleIntro) { updateFlowOverlay(input, 'roleintro', (id) => { if (id === 'role-go') { state.roleIntro = false; state.paused = false; state.ui.scroll = 0; sfx.tick(); } }); return; }
    if (state.hint) { updateFlowOverlay(input, 'hint', (id) => { if (id === 'hint-do') applyHint(); else if (id === 'hint-close') closeHint(); }); return; }
    if (state.lesson && state.lesson.phase !== 'play') { updateFlowOverlay(input, 'lesson', handleLessonTap); return; }
    if (E.phase === 'over') { finishGame(); return; }
    if (state.toastT > 0) { state.toastT -= dt; if (state.toastT <= 0) state.toast = ''; }
    // Watch & Learn: the computer plays both sides
    if (state.mode === 'watch') {
      if (E.phase === 'call') { if (watchNeed()) updateWatchCall(input, dt); return; }
      if (ptr.pressed) {
        if (inRect(PLAY.think, ptr.x, ptr.y)) { state.paused = !state.paused; sfx.tick(); return; }
        if (inRect(PLAY.menu, ptr.x, ptr.y)) { leaveGame(); return; }
      }
      if (keys.pressed.has('KeyP')) state.paused = !state.paused;
      if (state.paused) return;
      engineStep(E, dt); consumeEvents(); trackResult();
      return;
    }
    if (E.phase === 'call') { if (humanNeed()) { updateCall(input); return; } engineStep(E, dt); trackResult(); return; }
    if (keys.pressed.has('KeyP') || keys.pressed.has('Escape')) { openPause(); return; }
    if (keys.pressed.has('KeyH')) { openHint(); return; }
    if (state.paused) return;
    // buttons and the stick: one pointer, so a touch is either a button or a stick
    state.buttons = controlButtons(E);
    addMarks(E);
    if (ptr.pressed) {
      if (inRect(PLAY.think, ptr.x, ptr.y)) { openHint(); return; }
      if (inRect(PLAY.menu, ptr.x, ptr.y)) { openPause(); return; }
      const hit = ctlHit(state.buttons, ptr.x, ptr.y, state.ui.cscroll || 0);
      if (hit) { state.ui.press = { id: hit.id, t: 0, slot: hit.slot, hold: !!hit.hold }; sfx.tick(); if (!hit.hold) state.pendingPress = hit.id; }
      else if (inRect(PLAY.view, ptr.x, ptr.y) && E.phase === 'play') state.ui.stick = { ox: ptr.x, oy: ptr.y, dx: 0, dy: 0 };
    }
    if (ptr.down) {
      if (state.ui.stick) { let dx = ptr.x - state.ui.stick.ox, dy = ptr.y - state.ui.stick.oy; const l = Math.hypot(dx, dy); if (l > 70) { dx = (dx / l) * 70; dy = (dy / l) * 70; } state.ui.stick.dx = dx; state.ui.stick.dy = dy; }
      if (state.ui.press && state.ui.press.hold) { state.ui.press.t += dt; state.ui.holdT = state.ui.press.t; }
    } else if (state.ui.stick || state.ui.press) {
      if (state.ui.press && state.ui.press.hold && ptr.released) throwTo(state.ui.press.slot, state.ui.press.t);
      state.ui.press = null; state.ui.stick = null; state.ui.holdT = 0;
    }
    if (E.phase === 'play' && E.P) { intentFrom(input); if (state.pendingPress) { pressId(state.pendingPress); state.pendingPress = null; } }
    engineStep(E, dt);
    consumeEvents();
    trackResult();
  };

  // ---- menus -------------------------------------------------------------------------------------------------------------------------------------------------------------------------
  const handleTitle = (id) => {
    if (!id) return; sfx.tick();
    if (id === 'play') { state.scene = 'setup'; state.ui.scroll = 0; state.setupMsg = ''; } else if (id === 'learn') { state.scene = 'learn'; state.ui.scroll = 0; }
    else if (id === 'watch') startWatch(); else if (id === 'continue') resumeGame();
    else if (id === 'howto' || id === 'rules' || id === 'about') { state.back = 'title'; state.scene = id; state.page = 0; }
    else if (id === 'settings') { state.scene = 'settings'; state.ui.scroll = 0; }
  };
  const handleSetup = (id) => {
    if (!id) return; const s = state.setup; sfx.tick();
    if (id.startsWith('role-')) s.role = id.slice(5);
    else if (id.startsWith('lv')) { const i = Number(id.slice(2)); if (state.demo && i > 1) { state.setupMsg = 'That opponent is in the full game.'; return; } s.level = i; state.setupMsg = ''; }
    else if (/^q\d$/.test(id)) { const i = Number(id.slice(1)); if (state.demo && i !== 0) { state.setupMsg = 'Longer quarters are in the full game.'; return; } s.quarter = i; }
    else if (id === 'start') startGame({ mode: 'ai', level: s.level, quarter: state.demo ? 0 : s.quarter, role: s.role, levels: [TEAM_LEVEL, s.level] });
    else if (id === 'back') { state.scene = 'title'; state.ui.scroll = 0; }
  };
  const handleSettings = (id) => {
    if (!id) return; const st = state.settings; sfx.tick();
    if (id === 'set-sound') { st.sound = !st.sound; audio.setMuted?.(!st.sound); }
    else if (id === 'txt-dec') st.textIdx = Math.max(0, st.textIdx - 1); else if (id === 'txt-inc') st.textIdx = Math.min(TEXT_SCALES.length - 1, st.textIdx + 1);
    else if (id === 'think-dec') st.thinkIdx = Math.max(0, st.thinkIdx - 1); else if (id === 'think-inc') st.thinkIdx = Math.min(THINK_STEPS.length - 1, st.thinkIdx + 1);
    else if (id === 'set-women') st.women = !st.women;
    else if (id === 'restore') { state.restoreMsg = 'Checking with the store...'; Promise.resolve(monetization.restore?.()).then(() => { state.restoreMsg = monetization.owns('unlock_game') ? 'Purchase restored. Thank you!' : 'No previous purchase found.'; }).catch(() => { state.restoreMsg = 'The store is not available right now.'; }); }
    else if (id === 'back') { state.scene = 'title'; state.ui.scroll = 0; state.restoreMsg = ''; }
    save();
  };
  const handleLearn = (id) => { if (!id) return; sfx.tick(); if (id === 'back') { state.scene = 'title'; state.ui.scroll = 0; } else if (id.startsWith('lesson')) startLesson(Number(id.slice(6))); };
  const handleResult = (id) => {
    if (!id) return; sfx.tick(); const mode = state.over?.mode;
    if (id === 'again') { if (mode === 'watch') startWatch(); else startGame({ mode: 'ai', level: state.setup.level, quarter: state.setup.quarter, role: state.setup.role, levels: [TEAM_LEVEL, state.setup.level] }); }
    else if (id === 'new') { state.scene = 'setup'; state.ui.scroll = 0; } else if (id === 'menu') { state.scene = 'title'; state.ui.scroll = 0; }
  };
  function updateFlowScene(input, handler, key) {
    const ptr = input.pointer;
    if (key) ensureLayout(state, key);
    if (ptr.pressed) { const lf = !!(flowMeta().left && ptr.x < flowMeta().left.box.x + flowMeta().left.box.w + 12); state.ui.drag = { y0: ptr.y, x0: ptr.x, s0: lf ? (state.ui.scrollL || 0) : state.ui.scroll, moved: 0, left: lf }; }
    if (state.ui.drag && ptr.down) scrollFlow(ptr);
    if (ptr.released && state.ui.drag) {
      const d = state.ui.drag; state.ui.drag = null;
      const lay = flowMeta(); const scrollable = lay.lay && lay.lay.contentH > lay.bottom - lay.top;
      if (d.moved < 10) handler(hitScreen(ptr.x, ptr.y, state.ui.scroll)); else if (!scrollable) handler(hitScreen(d.x0, d.y0, state.ui.scroll));
    }
    const mt = flowMeta(), max = mt.lay ? Math.max(0, mt.lay.contentH - (mt.bottom - mt.top)) : 0;
    if (input.keys.pressed.has('Equal') || input.keys.pressed.has('NumpadAdd')) { state.settings.textIdx = Math.min(TEXT_SCALES.length - 1, state.settings.textIdx + 1); save(); }
    if (input.keys.pressed.has('Minus') || input.keys.pressed.has('NumpadSubtract')) { state.settings.textIdx = Math.max(0, state.settings.textIdx - 1); save(); }
    if (input.keys.down.has('ArrowDown')) state.ui.scroll = clamp(state.ui.scroll + 14, 0, max);
    if (input.keys.down.has('ArrowUp')) state.ui.scroll = clamp(state.ui.scroll - 14, 0, max);
  }
  const updateSetup = (input) => {
    const ptr = input.pointer, k = input.keys;
    if (k.pressed.has('Enter')) { handleSetup('start'); return; }
    if (k.pressed.has('Escape')) { handleSetup('back'); return; }
    if (ptr.pressed && (inRect(SETUP_PINS.start, ptr.x, ptr.y) || inRect(SETUP_PINS.back, ptr.x, ptr.y))) { handleSetup(inRect(SETUP_PINS.start, ptr.x, ptr.y) ? 'start' : 'back'); return; }
    updateFlowScene(input, handleSetup, 'setup');
  };
  const updatePages = (input) => {
    const ptr = input.pointer, keys = input.keys, R = readerMeta();
    const close = () => { state.scene = state.back === 'play' ? 'play' : 'title'; state.page = 0; state.ui.drag = null; };
    const setS = (v) => { state.page = clamp(v, 0, R.max); };
    const zoom = (d) => { state.settings.textIdx = clamp(state.settings.textIdx + d, 0, TEXT_SCALES.length - 1); state.page = 0; save(); };
    if (ptr.pressed) {
      if (inRect(REF_NEXT, ptr.x, ptr.y)) { if (state.page >= R.max - 4) close(); else setS(state.page + R.view * 0.85); state.ui.drag = null; }
      else if (inRect(REF_BACK, ptr.x, ptr.y)) close();
      else if (inRect(TEXT_DEC, ptr.x, ptr.y)) zoom(-1); else if (inRect(TEXT_INC, ptr.x, ptr.y)) zoom(1);
      else if (R.max > 0 && ptr.x >= READ.bar.x - 14 && ptr.x <= READ.bar.x + READ.bar.w + 14 && ptr.y >= READ.view.y && ptr.y <= READ.view.y + READ.view.h) state.ui.drag = { bar: true };
      else state.ui.drag = { y0: ptr.y, s0: state.page };
    }
    if (state.ui.drag && state.ui.drag.bar && ptr.down) setS(((ptr.y - READ.view.y) / READ.view.h) * R.max);
    else if (state.ui.drag && ptr.down) setS(state.ui.drag.s0 - (ptr.y - state.ui.drag.y0));
    if (ptr.released) state.ui.drag = null;
    if (state.wheel) { setS(state.page + state.wheel); state.wheel = 0; }
    if (keys.down.has('ArrowDown')) setS(state.page + 36); if (keys.down.has('ArrowUp')) setS(state.page - 36);
    if (keys.pressed.has('PageDown') || keys.pressed.has('Space')) setS(state.page + R.view * 0.85); if (keys.pressed.has('PageUp')) setS(state.page - R.view * 0.85);
    if (keys.pressed.has('End')) setS(R.max); if (keys.pressed.has('Home')) setS(0);
    if (keys.pressed.has('Escape')) close();
  };

  // ---- shot presets: ?shot=1&seed=N picks a fixed, deterministic screen -----------------------------------------------------------------------------------------------
  const autoChoose = (E) => { const n = E.need; const v = n.kind === 'offcall' ? thinkOffense(E.m).best : n.kind === 'defcall' ? thinkDefense(E.m).best : aiPick(E, n).value; choose(E, v); };
  const gameUntil = (test, max = 600) => {
    const E = state.E; let g = 0;
    while (!test(E) && g++ < max * 60) { if (E.need && E.need.pick && !E.need.human) choose(E, E.need.pick.value); else if (E.need && E.need.human) autoChoose(E); engineStep(E, 1 / 60); }
  };
  const shotGame = (cfg, test, max) => { startGame({ mode: 'ai', level: 2, quarter: 1, role: 'QB', levels: [2, 2], first: 0, auto: true, ...cfg }); state.roleIntro = false; state.paused = false; state.headless = true; gameUntil(test, max); state.E.cfg.auto = false; };
  const applyPreset = () => {
    state.shot = true; state.headless = true;
    if (shotZoom >= 0 && shotZoom < TEXT_SCALES.length) state.settings.textIdx = shotZoom;
    const n = ((shotSeed % 100) + 100) % 100;
    const live = (t) => (E) => E.phase === 'play' && E.P.phase === 'live' && E.P.t - E.P.tLive >= t;
    if (n === 1) { state.scene = 'title'; return; }
    if (n === 2) { shotGame({ role: 'QB' }, live(2.2)); return; }
    if (n === 3) { shotGame({ role: 'RB' }, (E) => E.phase === 'play' && E.P.phase === 'live' && E.P.events.some((e) => e.type === 'handoff') && E.P.t - E.P.tLive >= 2.2); return; }
    if (n === 4) { shotGame({ role: 'WR' }, (E) => E.phase === 'play' && E.P.events.some((e) => e.type === 'catch')); return; }
    if (n === 5) { shotGame({ role: 'LB', first: 1 }, (E) => E.phase === 'play' && E.P.events.some((e) => e.type === 'tackle') && E.P.events.find((e) => e.type === 'tackle').t + 0.7 < E.P.t); return; }
    if (n === 6) { shotGame({ role: 'CB', first: 1 }, (E) => E.phase === 'result' && E.timer > 0.5); return; }
    if (n === 7) { state.back = 'title'; state.scene = 'rules'; state.page = 900; return; }
    if (n === 8) { state.back = 'title'; state.scene = 'howto'; return; }
    if (n === 9) { state.scene = 'setup'; return; }
    if (n === 10) { state.scene = 'settings'; return; }
    if (n === 11) { state.back = 'title'; state.scene = 'about'; return; }
    if (n === 12) { state.scene = 'learn'; return; }
    if (n === 13) { shotGame({}, (E) => E.phase === 'call' && E.m.plays >= 1); state.E.need.human = true; state.sel = 'playaction'; return; }
    if (n === 14) { startGame({ mode: 'watch', level: 3, quarter: 0, levels: [2, 3], role: 'QB', first: 0 }); state.headless = true; gameUntil((E) => E.phase === 'call' && E.m.plays >= 2 && !!E.need.pick, 400); state.watch = { key: 'x', phase: 'reveal', t: 0.4, dur: 5 }; return; }
    if (n === 15) { state.settings.textIdx = 4; state.back = 'title'; state.scene = 'rules'; state.page = 4000; return; }
    if (n === 16) { state.settings.textIdx = 4; state.scene = 'title'; return; }
    if (n === 17) { state.settings.textIdx = 4; shotGame({}, live(2.2)); return; }
    if (n === 18) { state.settings.textIdx = 4; state.scene = 'settings'; return; }
    if (n === 19) { state.settings.textIdx = 4; state.scene = 'setup'; return; }
    if (n === 20) { shotGame({ quarter: 0 }, (E) => E.phase === 'over' || !!E.m.over, 900); finishGame(); return; }
    if (n === 21) { shotGame({}, (E) => E.phase === 'play' && E.P.kick && E.P.events.some((e) => e.type === 'kick')); return; }
  };

  // ---- the object the kit and the shell see ---------------------------------------------------------------------------------------------------------------------------------------
  const aboutList = () => state.creditsList ?? ABOUT;
  function renderPlayScene(ctx) {
    const E = state.E;
    if (E.phase === 'call' && humanNeed()) renderCall(ctx, state);
    else if (E.phase === 'call' && watchNeed()) renderWatchCall(ctx, state);
    else renderPlay(ctx, state);
    if (state.pauseMenu) renderPause(ctx, state);
    else if (state.roleIntro) renderRoleIntro(ctx, state);
    else if (state.hint) renderHint(ctx, state);
    else if (state.lesson && state.lesson.phase !== 'play') renderLesson(ctx, state);
    if (state.toast) { ctx.save(); ctx.fillStyle = 'rgba(12,22,28,0.9)'; ctx.fillRect(LY.toast.x, LY.toast.y, LY.toast.w, LY.toast.h); ctx.fillStyle = '#ffe9bf'; ctx.font = `600 ${Math.max(24, LY.minText)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillText(state.toast, LY.toast.x + LY.toast.w / 2, LY.toast.y + 36); ctx.restore(); }
  }
  // the live size follows the kit's fluid viewport; on a change (rotation, resize) a held touch is released cleanly and the layouts are rebuilt
  function relayout() {
    syncLayout(meta.width, meta.height);
    if (state.lyKey !== LY.key) {
      if (state.lyKey) { state.ui.stick = null; state.ui.press = null; state.ui.holdT = 0; state.ui.keyHold = null; state.ui.drag = null; state.pendingPress = null; resetPages(); }
      state.lyKey = LY.key; resetPlayLayout();
    }
  }
  const game = {
    // Everything except the live play is free: menus, calls, Rules, About, Learn, Watch & Learn, pause.
    // mouse wheel / trackpad from main.js: scrolls the reader or the current flow screen
    scrollBy(dy) { if (['rules', 'howto', 'about'].includes(state.scene)) state.wheel = (state.wheel || 0) + dy; else { const mt = flowMeta(); const max = mt && mt.lay ? Math.max(0, mt.lay.contentH - (mt.bottom - mt.top)) : 0; state.ui.scroll = clamp(state.ui.scroll + dy, 0, max); } },
    isPreviewExempt: () => !(state.scene === 'play' && state.mode === 'ai' && !!state.E && state.E.phase === 'play' && !state.paused && !state.roleIntro),
    setView3d(on) { state.v3 = !!on; },
    drawOverlay: (ctx, proj) => drawOverlayFor(state)(ctx, proj),
    debugStart: (cfg) => startGame(cfg),
    setCredits(text) {
      state.credits = String(text || '');
      const paras = state.credits.split(/\n{2,}/).map((s) => s.replace(/^#+\s*/gm, '').replace(/\n/g, ' ').trim()).filter(Boolean);
      if (paras.length) { state.creditsList = [...ABOUT, { title: 'Credits', p: paras }]; resetPages(); }
    },
    update(dt, input) {
      relayout();
      setPress(input.pointer);
      if (state.shot) { state.t += dt; return; }
      state.t += state.paused && state.scene === 'play' ? 0 : dt;
      switch (state.scene) {
        case 'title': {
          const lt = getLockTap(), pp = input.pointer;
          setLockDown(state.lockDown > state.t);
          if (lt && pp.pressed && pp.x >= lt.x && pp.x <= lt.x + lt.w && pp.y >= lt.y && pp.y <= lt.y + lt.h) { state.lockDown = state.t + 0.25; env.openArcforgeHome?.(); break; }
          updateFlowScene(input, handleTitle, 'title'); break;
        }
        case 'setup': updateSetup(input); break;
        case 'settings': updateFlowScene(input, handleSettings, 'settings'); break;
        case 'learn': updateFlowScene(input, handleLearn, 'learn'); break;
        case 'result': updateFlowScene(input, handleResult, 'result'); break;
        case 'demolimit': updateFlowScene(input, (id) => { if (id === 'menu') { state.scene = 'title'; state.ui.scroll = 0; } }, 'demolimit'); break;
        case 'howto': case 'about': case 'rules': updatePages(input); break;
        case 'play': updatePlay(dt, input); break;
        default: break;
      }
    },
    render(ctx) {
      relayout();
      ctx.clearRect(0, 0, W, H);
      switch (state.scene) {
        case 'title': renderTitle(ctx, state); break;
        case 'setup': renderSetup(ctx, state); break;
        case 'settings': renderSettings(ctx, state); break;
        case 'learn': renderLearn(ctx, state); break;
        case 'result': renderResult(ctx, state); break;
        case 'demolimit': renderDemoLimit(ctx, state); break;
        case 'howto': renderPages(ctx, state, HOWTO, 'How to Play'); break;
        case 'about': renderPages(ctx, state, aboutList(), 'About'); break;
        case 'rules': renderPages(ctx, state, RULES, 'Rules'); break;
        case 'play': if (state.E) renderPlayScene(ctx); break;
        default: break;
      }
      state.viewRect = { x: PLAY.cam.x, y: PLAY.cam.y, w: PLAY.cam.w, h: PLAY.cam.h };
      state.hide3d = state.scene === 'play' && !!state.E && (state.E.phase === 'call' || state.E.phase === 'over' || state.roleIntro);
    },
    getState: () => state,
  };
  if (shotMode) applyPreset();
  void roleById; void FIELD; void LEVELS; void ROLES; void PAIRS; void playLayoutNow; void ctlRects;
  return game;
}

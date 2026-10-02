// Bao la Kiswahili: state and flow. The rule book (rules.js) plays a whole move at once and hands back an EVENT list
// (place / lift / capture / drop / note); `state.anim` replays those events seed by seed against `state.shown` (what the
// player sees) and only then commits the new position. Part-way choices (which kichwa, safari) pause the replay and ask.
// Drawing is view.js; the computer is engine.js; text is content.js; lessons.js holds the guided positions.
import { W, H, BTN, setRows, titleRows, inRect, pitNear, pitPos, trayPos, TEXT_SCALES, AP_THINK_STEPS, PITCH } from './layout.js';
import { newGame, clone, simulate, legalMoves, kutActive, NYUMBA } from './rules.js';
import { LEVELS, createThinker } from './engine.js';
import { LESSONS } from './lessons.js';
import { RULES, HOWTO, ABOUT } from './content.js';
import { render } from './view.js';

export const meta = { width: W, height: H };
const DEMO_GAMES = 2, HINT_LEVEL = 2, SEEDSETS = ['mbono', 'cowries', 'amber'], WOODS = ['teak', 'ebony'], AP_LEVEL = 2;
const NODES_PER_TICK = 5000;
const DOCLEN = { about: ABOUT.length, howto: HOWTO.length, rules: RULES.length };

export function createGame(env) {
  const { rng, storage, audio, monetization, config } = env;
  const state = {
    scene: 'title', t: 0, game: newGame(), shown: null, two: false, level: 1, sound: true, calm: false, textScaleIdx: 0, seeds: 'mbono', wood: 'teak',
    anim: null, msg: null, coach: null, think: 0, thinking: false, undo: [], hint: null, hintBusy: false, sel: null, prompt: null,
    legal: [], legalMarks: [], legalKey: '', kbPit: null, shake: null, stats: { games: 0, wins: 0, badges: {} }, saved: null, learned: false, demoGames: 0,
    lesson: null, page: 0, pageCount: 1e9, dev: config.dev === true, apThinkIdx: 1, ap: null, apPaused: false, apMarks: null,
  };
  state.shown = { pits: [state.game.pits[0].slice(), state.game.pits[1].slice()], stock: state.game.stock.slice(), hand: null };
  let thinker = null, hintThinker = null, apThinker = null;
  const isAutoplay = () => state.scene === 'autoplay' || state.scene === 'autoplay-over';

  storage.get('prefs', null).then((v) => {
    if (!v) return;
    state.level = Math.min(Math.max(v.level ?? 1, 0), LEVELS.length - 1); state.sound = v.sound ?? true; state.calm = v.calm ?? false;
    state.seeds = SEEDSETS.includes(v.seeds) ? v.seeds : 'mbono'; state.wood = WOODS.includes(v.wood) ? v.wood : 'teak';
    state.textScaleIdx = Math.min(Math.max(v.textScaleIdx ?? 0, 0), TEXT_SCALES.length - 1); state.apThinkIdx = Math.min(Math.max(v.apThinkIdx ?? 1, 0), AP_THINK_STEPS.length - 1);
    audio.setMuted?.(!state.sound);
  });
  storage.get('stats', null).then((v) => { if (v) state.stats = { ...state.stats, ...v, badges: { ...(v.badges || {}) } }; });
  storage.get('learned', false).then((v) => { state.learned = state.learned || !!v; });
  storage.get('demoGames', 0).then((v) => { state.demoGames = Math.max(state.demoGames, v); });
  storage.get('save', null).then((v) => { if (v && v.game && v.game.winner === null && state.scene === 'title') state.saved = v; });
  const savePrefs = () => storage.set('prefs', { level: state.level, sound: state.sound, calm: state.calm, seeds: state.seeds, wood: state.wood, textScaleIdx: state.textScaleIdx, apThinkIdx: state.apThinkIdx });
  const saveGame = () => { if (state.scene === 'play' && state.game.winner === null) { state.saved = { game: clone(state.game), two: state.two, level: state.level }; storage.set('save', state.saved); } };
  const clearSave = () => { state.saved = null; storage.remove('save'); };
  const saveStats = () => { storage.set('stats', state.stats); storage.set('progress', { played: state.stats.games, wins: state.stats.wins }); };

  const say = (text, hold = 5) => { state.msg = { text, t: 0, hold }; };
  const tone = (o) => { if (state.sound && !isAutoplay()) audio.tone(o); };
  const clack = (f = 420) => tone({ freq: f, to: f * 0.5, dur: 0.05, type: 'sine', vol: 0.1 });
  const seedTick = (n) => tone({ freq: 300 + (n % 24) * 24, to: 180 + (n % 24) * 10, dur: 0.045, type: 'triangle', vol: 0.09 });
  const chime = (k = 0) => tone({ freq: 620 + k * 90, to: 900 + k * 120, dur: 0.24, type: 'sine', vol: 0.09 });
  const thud = () => tone({ freq: 190, to: 120, dur: 0.14, type: 'triangle', vol: 0.07 });
  const syncShown = () => { const g = state.game; state.shown = { pits: [g.pits[0].slice(), g.pits[1].slice()], stock: g.stock.slice(), hand: null }; };
  const reset = (extra) => {
    thinker = hintThinker = apThinker = null;
    Object.assign(state, { anim: null, msg: null, think: 0, thinking: false, undo: [], hint: null, hintBusy: false, sel: null, prompt: null, kbPit: null, shake: null, ap: null, apMarks: null, apPaused: false, legalKey: '', legal: [], legalMarks: [], coach: null }, extra);
    syncShown();
  };
  const durf = (d) => (state.calm ? d * 0.5 : d);
  const humanTurn = () => state.game.winner === null && !state.anim && (state.scene === 'lesson' ? state.game.turn === 0 : (state.two || state.game.turn === 0));
  const dirWord = (d) => (d > 0 ? 'clockwise' : 'anticlockwise');
  const endWord = (p, d) => ((p === 0) === (d > 0) ? 'left' : 'right'); // screen side of the kichwa that direction d starts from
  const plural = (n) => (n === 1 ? '' : 's');

  // ---- words about a move: Think, Watch & Learn and the move summary ----------------------------------------------------
  // `who` null = imperative (a hint: "Put your seed ..."), otherwise a seat name ("Bottom seat puts ...").
  function describeMove(g, mv, who) {
    const p = g.turn, r = simulate(g, mv, false), dir = dirWord(mv.d), ch = mv.ch || [];
    const sub = (a, b) => (who ? `${who} ${a}` : b);
    let t;
    if (r.kind === 'namua-capture') {
      t = sub('puts a store seed into the glowing pit', 'Put your store seed into the glowing pit') + ` and ${who ? 'captures' : 'capture'} ${r.gain} seed${plural(r.gain)}`;
      if (r.caps > 1) t += ` in ${r.caps} chained captures`;
      t += '.';
      if (ch.length && typeof ch[0] === 'number') t += ` The captured seeds start from the ${endWord(p, ch[0])} kichwa.`;
    } else if (r.kind === 'capture') {
      t = sub(`sows the glowing pit ${dir}.`, `Sow the glowing pit ${dir}.`) + ` Its last seed lands on a pit facing enemy seeds, so it captures ${r.gain} seed${plural(r.gain)}`;
      if (r.caps > 1) t += ` in ${r.caps} chained captures`;
      t += '.';
    } else if (g.stock[p] > 0) {
      t = who ? `No capture is possible, so ${who} plays a takata: a store seed into the glowing pit, then sows it ${dir}.` : `No capture is possible, so play a takata: a store seed into the glowing pit, then sow it ${dir}.`;
    } else {
      t = who ? `No capture is possible, so ${who} plays a takata: sows the glowing pit ${dir}.` : `No capture is possible, so play a takata: sow the glowing pit ${dir}.`;
    }
    if (ch.includes(true)) t += ' It carries on from the nyumba (safari).';
    const g2 = r.g;
    if (g2.winner === null) {
      let best = 0;
      for (const m of legalMoves(g2)) {
        const x = simulate(g2, { ...m, ch: [] }, false);
        if (x.pending) { for (const o of x.pending.options) { const y = simulate(g2, { ...m, ch: [o] }, false); if (!y.pending && y.gain > best) best = y.gain; } } else if (x.gain > best) best = x.gain;
      }
      if (r.gain === 0 && best === 0) t += ' It leaves no capture for the opponent.';
      else if (best > 0) t += ` Afterwards the opponent could capture up to ${best}.`;
    } else if (g2.winner === p) t += ' That wins the game.';
    return t;
  }

  function start(two) {
    if (config.demo && state.demoGames >= DEMO_GAMES) { state.scene = 'demo-limit'; return; }
    if (config.demo) { state.demoGames += 1; storage.set('demoGames', state.demoGames); }
    reset({ scene: 'play', game: newGame(), two });
    monetization.track('game_start', { two, level: state.level });
  }
  function resume() {
    const v = state.saved;
    reset({ scene: 'play', game: clone(v.game), two: v.two, level: v.level ?? state.level });
    say('Game restored.'); if (!humanTurn()) state.think = 0.5;
  }
  function startLesson(i) { reset({ scene: 'lesson', game: LESSONS[i].game(), two: true, lesson: { i, done: false } }); }
  function startAutoPlay() { reset({ scene: 'autoplay', game: newGame(), two: true }); state.ap = { phase: 'think', timer: 0, move: null, text: '' }; }

  // ---- playing a move out ------------------------------------------------------------------------------------------
  const dropSpeed = (A) => { let D = 0; for (const e of A.events) if (e.k === 'drop') D++; return Math.max(0.03, Math.min(0.16, 5 / Math.max(1, D))) * (state.calm ? 0.5 : 1); };
  function startMove(mv, human) {
    const S0 = clone(state.game);
    const A = { S0, mv: { r: mv.r, d: mv.d, ch: (mv.ch || []).slice() }, idx: 0, timer: 0, entered: -1, vis: null, last: null, from: null, res: null, events: null, waiting: false, drops: 0, human, capSeen: false };
    A.res = simulate(S0, A.mv, true); A.events = A.res.events; A.sd = dropSpeed(A);
    Object.assign(state, { anim: A, coach: null, hint: null, sel: null, prompt: null, legalMarks: [], apMarks: null, kbPit: null, msg: null, legalKey: '' });
  }
  const durOf = (A, e) => (e.k === 'place' ? durf(0.36) : e.k === 'lift' ? durf(0.26) : e.k === 'cap' ? durf(0.5) : e.k === 'drop' ? A.sd : durf(0.5));
  function enter(A, e) {
    const sh = state.shown;
    if (e.k === 'lift') { sh.pits[e.p][e.r] -= e.n; sh.hand = { p: e.p, n: e.n }; A.from = pitPos(e.p, e.r); clack(520); }
    else if (e.k === 'cap') {
      sh.pits[e.p][e.r] = 0; sh.hand = { p: e.by, n: e.n }; A.from = pitPos(e.p, e.r); chime(0); A.capSeen = true;
      if (e.r === NYUMBA && A.S0.house[e.p] && !A.houseSeen) { A.houseSeen = true; say('A nyumba (house) was captured.', 3); }
    } else if (e.k === 'note') {
      const m = { kut: 'Kutakatia: that pit is protected, so the move stops there.', 'house-stop': 'The sowing ended in the nyumba, so the turn stops.', 'house-stay': 'Stopped in the nyumba: the house stays closed.', safari: 'Safari: the nyumba is opened and sown on.' }[e.t];
      if (m) say(m, 3.5);
      if (e.t === 'safari') chime(2); else thud();
    }
  }
  function finishEvent(A, e) {
    const sh = state.shown;
    if (e.k === 'place') { sh.stock[e.p] -= 1; sh.pits[e.p][e.r] += 1; A.last = { p: e.p, r: e.r, t: 0 }; clack(380); }
    else if (e.k === 'drop') {
      sh.pits[e.p][e.r] += 1; if (sh.hand) { sh.hand.n -= 1; if (sh.hand.n <= 0) sh.hand = null; }
      A.from = pitPos(e.p, e.r); A.last = { p: e.p, r: e.r, t: 0 }; A.drops++; seedTick(A.drops);
    }
  }
  function visual(A, e, f) {
    const sh = state.shown, V = {};
    if (e.k === 'place') { const a = trayPos(e.p), b = pitPos(e.p, e.r); V.place = { f, x0: a.x, y0: a.y, x1: b.x, y1: b.y }; }
    else if (e.k === 'lift') { const q = pitPos(e.p, e.r); if (sh.hand) V.hand = { x: q.x, y: q.y, hop: 12 * f, n: sh.hand.n }; }
    else if (e.k === 'cap') { const q = pitPos(e.p, e.r); V.cap = { q, f, n: e.n }; if (sh.hand) V.hand = { x: q.x, y: q.y, hop: 10 + 10 * f, n: sh.hand.n }; }
    else if (e.k === 'drop') {
      const from = A.from || pitPos(e.p, e.r), to = pitPos(e.p, e.r), k = f * f * (3 - 2 * f);
      const far = Math.hypot(to.x - from.x, to.y - from.y) > PITCH * 1.5;
      if (sh.hand) V.hand = { x: from.x + (to.x - from.x) * k, y: from.y + (to.y - from.y) * k, hop: state.calm ? 0 : Math.sin(Math.PI * f) * (far ? 60 : 26), n: sh.hand.n };
    } else if (sh.hand && A.from) V.hand = { x: A.from.x, y: A.from.y, hop: 6, n: sh.hand.n };
    A.vis = V;
  }
  // returns 'run' | 'wait' | 'done'
  function stepAnim(dt) {
    const A = state.anim;
    if (A.last) A.last.t += dt;
    if (A.waiting) { if (state.shown.hand && A.from) A.vis = { hand: { x: A.from.x, y: A.from.y, hop: 6 + (state.calm ? 0 : 4 * Math.sin(state.t * 6)), n: state.shown.hand.n } }; return 'wait'; }
    A.timer += dt;
    for (let guard = 0; guard < 500; guard++) {
      if (A.idx >= A.events.length) {
        if (A.res.pending) { A.waiting = true; openPrompt(A.res.pending); return A.waiting ? 'wait' : 'run'; }
        A.vis = null;
        return A.timer >= durf(A.capSeen ? 0.5 : 0.3) ? 'done' : 'run';
      }
      const e = A.events[A.idx];
      if (A.entered !== A.idx) { enter(A, e); A.entered = A.idx; }
      const dur = durOf(A, e);
      if (A.timer < dur) { visual(A, e, dur > 0 ? A.timer / dur : 1); return 'run'; }
      A.timer -= dur; finishEvent(A, e); A.idx++;
    }
    return 'run';
  }
  function openPrompt(pend) {
    const A = state.anim, p = A.S0.turn;
    if (!A.human) { A.mv.ch.push(pend.options[0]); resumeAfterAnswer(); return; } // a computer move carries all its answers; safety only
    if (pend.type === 'kichwa') {
      const opts = [1, -1].map((v) => ({ val: v, side: endWord(p, v), label: endWord(p, v) === 'left' ? 'Left end' : 'Right end' })).sort((a, b) => (a.side === 'left' ? -1 : 1) - (b.side === 'left' ? -1 : 1));
      state.prompt = { type: 'kichwa', text: 'Captured! Sow the captured seeds from which end of your front row?', opts, labels: opts.map((o) => o.label), marks: [{ p, r: 0, c: 'green' }, { p, r: 7, c: 'green' }], arrows: [{ p, r: 0, cw: true }, { p, r: 7, cw: false }] };
    } else {
      state.prompt = { type: 'safari', text: 'Your last seed fell in your nyumba. Carry on from it (safari), or stop?', opts: [{ val: true, label: 'Carry on (safari)' }, { val: false, label: 'Stop here' }], labels: ['Carry on (safari)', 'Stop here'], marks: [{ p, r: NYUMBA, c: 'gold' }] };
    }
  }
  function resumeAfterAnswer() {
    const A = state.anim; A.res = simulate(A.S0, A.mv, true); A.events = A.res.events; A.waiting = false; A.sd = dropSpeed(A);
  }
  function answerPrompt(i) {
    const P = state.prompt; if (!P) return;
    const o = P.opts[i]; if (!o) return;
    if (P.type === 'dir') { const mv = { r: P.r, d: o.val, ch: [] }; state.prompt = null; state.undo.push(clone(state.game)); startMove(mv, true); return; }
    state.prompt = null; state.anim.mv.ch.push(o.val); resumeAfterAnswer(); clack(520);
  }
  function summary(A) {
    const r = A.res, p = A.S0.turn;
    const who = state.scene === 'autoplay' ? (p === 0 ? 'Bottom seat' : 'Top seat') : state.two ? (p === 0 ? 'Player one' : 'Player two') : p === 0 ? 'You' : 'The computer';
    if (r.gain > 0) return `${who} captured ${r.gain} seed${plural(r.gain)}${r.caps > 1 ? ` in ${r.caps} captures` : ''}.`;
    return `${who} played a takata: no capture.`;
  }
  function afterMove(A) {
    const text = summary(A);
    state.game = A.res.g; state.anim = null; syncShown(); state.legalKey = '';
    const g = state.game;
    if (state.scene === 'lesson') { state.lesson.done = true; state.coach = null; say(LESSONS[state.lesson.i].done, 600); tone({ freq: 660, to: 990, dur: 0.2, type: 'triangle', vol: 0.08 }); return; }
    say(text, 4);
    if (state.scene === 'autoplay') { apAfterMove(); return; }
    if (g.winner !== null) { finish(); return; }
    saveGame();
    if (!humanTurn()) state.think = 0.55;
  }
  function finish() {
    const g = state.game;
    state.scene = 'over'; state.stats.games += 1; clearSave();
    if (!state.two && g.winner === 0) { state.stats.wins += 1; state.stats.badges['L' + state.level] = true; }
    saveStats();
    tone({ freq: g.winner === 'draw' ? 330 : 523, to: g.winner === 'draw' ? 330 : 880, dur: 0.45, type: 'triangle', vol: 0.09 });
    monetization.track('game_end', { winner: g.winner, moves: g.moves, level: state.level });
  }

  // ---- the player's turn --------------------------------------------------------------------------------------------
  function whyNot(g, r) {
    const p = g.turn, me = g.pits[p];
    if (g.stock[p] > 0) {
      if (state.legal.some((m) => m.d === 0)) return 'Capture is compulsory in namua: tap one of the glowing pits that face enemy seeds.';
      if (r >= 8) return 'In namua your store seed goes into a pit of your front row.';
      if (me[r] === 0) return 'A takata needs a pit that already holds seeds.';
      if (r === NYUMBA && g.house[p]) return 'While other front pits hold seeds, the nyumba cannot be used for a takata.';
      return 'That pit cannot be played now.';
    }
    if (me[r] < 2) return 'A pit needs 2 or more seeds to be sown.';
    if (kutActive(g) && g.kut.ring === r) return 'Kutakatia: that pit is protected this turn.';
    if (state.legal.some((m) => simulate(g, { ...m, ch: [] }, false).kind !== 'takata')) return 'You must capture: only the glowing pits can capture.';
    if (r >= 8) return 'No capture is possible, so sow from your front row. Back pits only when no front pit has 2 seeds.';
    if (r === NYUMBA && g.house[p]) return 'The nyumba is kept closed unless nothing else can be played.';
    return 'That pit cannot be played now.';
  }
  function landing(g, r, d) { // where the first sowing ends, for the direction preview
    const p = g.turn, me = g.pits[p];
    let n = me[r]; if (g.stock[p] > 0) { n = me[r] + 1; if (r === NYUMBA && g.house[p]) n = 2; }
    return ((r + d * n) % 16 + 16) % 16;
  }
  function tapPit(r) {
    const g = state.game, p = g.turn;
    const wantOk = (m) => state.scene !== 'lesson' || LESSONS[state.lesson.i].want(m);
    const cands = state.legal.filter((m) => m.r === r && wantOk(m));
    if (!cands.length) {
      if (state.scene === 'lesson' && state.legal.some((m) => m.r === r)) say('That is a real move, but not the one this lesson teaches. Tap a glowing pit.', 5);
      else say(whyNot(g, r), 6);
      state.shake = { p, r, t: 0 }; thud(); return;
    }
    state.hint = null;
    if (cands.length === 1) { state.undo.push(clone(g)); startMove({ r, d: cands[0].d, ch: [] }, true); return; }
    state.sel = { p, r };
    const opts = [{ val: 1, label: 'Clockwise' }, { val: -1, label: 'Anticlockwise' }].filter((o) => cands.some((m) => m.d === o.val));
    state.prompt = { type: 'dir', p, r, text: 'Which way should the seeds go?', opts, labels: opts.map((o) => o.label),
      marks: opts.map((o) => ({ p, r: landing(g, r, o.val), c: o.val > 0 ? 'green' : 'amber' })), arrows: opts.map((o) => ({ p, r: landing(g, r, o.val), cw: o.val > 0 })), dots: opts.map((o) => (o.val > 0 ? '#7dffae' : '#ffc46e')) };
  }
  function undoMove() {
    if (!state.undo.length || state.anim || state.hintBusy) { say('Nothing to take back yet.'); return; }
    thinker = null; state.thinking = false; state.think = 0;
    state.game = state.undo.pop(); syncShown(); state.hint = null; state.sel = null; state.prompt = null; state.legalKey = ''; say('Move taken back.'); clack(360); saveGame();
  }
  function think(dt) {
    state.think -= dt; if (state.think > 0) return;
    if (!thinker) { thinker = createThinker(state.game, state.level, rng); state.thinking = true; }
    const n0 = thinker.nodes();
    for (;;) {
      const r = thinker.step();
      if (r.move !== undefined) { thinker = null; state.thinking = false; if (r.move) startMove(r.move, false); return; }
      if (thinker.nodes() - n0 >= NODES_PER_TICK) return;
    }
  }
  function updateHint() {
    const n0 = hintThinker.nodes();
    for (;;) {
      const r = hintThinker.step();
      if (r.move !== undefined) {
        hintThinker = null; state.hintBusy = false;
        if (r.move) {
          const g = state.game, mv = r.move, text = 'Think: ' + describeMove(g, mv, null);
          state.hint = { p: g.turn, r: mv.r, show: true, t: 0 }; say(text, 10);
        }
        return;
      }
      if (hintThinker.nodes() - n0 >= NODES_PER_TICK) return;
    }
  }
  function coachFor(g) {
    if (g.winner !== null) return null;
    const p = g.turn;
    if (state.scene === 'lesson') return state.lesson.done ? null : LESSONS[state.lesson.i].text;
    const caps = g.stock[p] > 0 ? state.legal.some((m) => m.d === 0) : state.legal.some((m) => simulate(g, { ...m, ch: [] }, false).kind !== 'takata');
    let t;
    if (g.stock[p] > 0) t = caps ? 'Namua: you must capture. Tap a glowing pit: your store seed goes in and takes the seeds facing it.' : 'Namua: no capture is possible, so play a takata. Tap a glowing pit, then choose a direction.';
    else t = caps ? 'Mtaji: you must capture. Tap a glowing pit, then a direction. Its last seed must land on a pit that faces enemy seeds.' : 'Mtaji: no capture is possible. Sow a front-row pit that holds 2 or more seeds.';
    if (kutActive(g)) t += ' The red pit is protected (kutakatia) this turn.';
    return t;
  }
  function refreshLegal() {
    const g = state.game;
    if (g.winner !== null || state.anim || (state.scene !== 'play' && state.scene !== 'lesson') || !humanTurn()) { state.legal = []; state.legalMarks = []; state.coach = null; state.legalKey = ''; return; }
    const key = g.moves + ':' + g.turn + ':' + state.scene + ':' + (state.lesson ? state.lesson.i : '');
    if (state.legalKey === key) return;
    state.legalKey = key; state.legal = legalMoves(g);
    const seen = new Set(), marks = [];
    for (const m of state.legal) {
      if (state.scene === 'lesson' && !LESSONS[state.lesson.i].want(m)) continue;
      if (!seen.has(m.r)) { seen.add(m.r); marks.push({ p: g.turn, r: m.r, c: 'gold', pulse: true }); }
    }
    if (kutActive(g)) marks.push({ p: g.turn, r: g.kut.ring, c: 'red', pulse: false });
    state.legalMarks = marks; state.coach = coachFor(g);
  }

  function updatePlay(dt, tap) {
    if (state.hint) { state.hint.t += dt; if (state.hint.t > 14) state.hint = null; }
    if (state.shake) { state.shake.t += dt; if (state.shake.t > 0.6) state.shake = null; }
    const A = state.anim;
    // Menu works at any moment: the game is only committed when a move finishes, so the saved position is the one before it
    if (tap && inRect(BTN.menu, tap.x, tap.y)) { saveGame(); thinker = hintThinker = null; Object.assign(state, { anim: null, prompt: null, sel: null, thinking: false, hintBusy: false, scene: 'title' }); syncShown(); return; }
    if (A) {
      const st = stepAnim(dt);
      if (st === 'done') afterMove(A);
      else if (st === 'wait' && tap && state.prompt) promptTap(tap);
      return;
    }
    if (!humanTurn()) { think(dt); return; }
    refreshLegal();
    if (hintThinker) updateHint();
    if (state.prompt) { if (tap) promptTap(tap); return; }
    if (!tap) return;
    if (inRect(BTN.undo, tap.x, tap.y)) { undoMove(); return; }
    if (inRect(BTN.hint, tap.x, tap.y)) { if (!hintThinker) { hintThinker = createThinker(state.game, HINT_LEVEL, rng); state.hintBusy = true; say('Thinking about the position…', 3); } return; }
    if (hintThinker) return;
    const r = pitNear(state.game.turn, tap.x, tap.y); if (r < 0) return;
    tapPit(r);
  }
  function promptTap(tap) {
    const P = state.prompt;
    if (inRect(BTN.pick1, tap.x, tap.y)) answerPrompt(0);
    else if (inRect(BTN.pick2, tap.x, tap.y)) answerPrompt(1);
    else if (P.type === 'dir' && inRect(BTN.pickCancel, tap.x, tap.y)) { state.prompt = null; state.sel = null; }
    else if (P.type === 'dir') { const r = pitNear(state.game.turn, tap.x, tap.y); if (r >= 0 && r !== P.r) { state.prompt = null; state.sel = null; tapPit(r); } }
  }

  function updateLesson(dt, tap) {
    const L = state.lesson;
    if (state.shake) { state.shake.t += dt; if (state.shake.t > 0.6) state.shake = null; }
    if (state.anim) { const A = state.anim, st = stepAnim(dt); if (st === 'done') afterMove(A); else if (st === 'wait' && tap && state.prompt) promptTap(tap); return; }
    if (tap && inRect(BTN.menu, tap.x, tap.y)) { state.scene = 'title'; return; }
    if (L.done) {
      if (tap && inRect(BTN.next, tap.x, tap.y)) {
        if (L.i + 1 < LESSONS.length) startLesson(L.i + 1);
        else { state.learned = true; storage.set('learned', true); state.scene = 'title'; say('You know the game. Try a game against the computer.', 7); }
      }
      return;
    }
    refreshLegal();
    if (state.prompt) { if (tap) promptTap(tap); return; }
    if (!tap) return;
    const r = pitNear(0, tap.x, tap.y); if (r < 0) return;
    tapPit(r);
  }

  // ---- Watch & Learn (Auto Play): THINK -> REVEAL -> ACT, the same engine plays both seats ------------------------------
  function apAfterMove() {
    const g = state.game;
    if (g.winner !== null) { apThinker = null; state.apMarks = null; state.scene = 'autoplay-over'; return; }
    state.ap = { phase: 'think', timer: 0, move: null, text: '' }; apThinker = null; state.apMarks = null;
  }
  function updateAutoPlay(dt, tap) {
    if (tap && inRect(BTN.apExit, tap.x, tap.y)) { apThinker = null; state.apMarks = null; state.scene = 'title'; return; }
    // Pause freezes the whole loop (timers, the engine search, the in-flight move animation): nothing below this line runs
    // while paused, and Resume continues the same phase, the same search and the same animation exactly where they stopped.
    if (tap && inRect(BTN.apPause, tap.x, tap.y)) { state.apPaused = !state.apPaused; clack(); return; }
    if (tap && inRect(BTN.apDec, tap.x, tap.y) && state.apThinkIdx > 0) { state.apThinkIdx--; savePrefs(); clack(); }
    else if (tap && inRect(BTN.apInc, tap.x, tap.y) && state.apThinkIdx < AP_THINK_STEPS.length - 1) { state.apThinkIdx++; savePrefs(); clack(); }
    if (state.apPaused) return;
    if (state.anim) { const A = state.anim, st = stepAnim(dt); if (st === 'done') afterMove(A); return; }
    const g = state.game, AP = state.ap;
    if (!AP || g.winner !== null) return;
    if (AP.phase === 'think') {
      AP.timer += dt;
      if (!apThinker) apThinker = createThinker(g, AP_LEVEL, rng);
      if (AP.move === null) {
        const n0 = apThinker.nodes();
        for (;;) { const r = apThinker.step(); if (r.move !== undefined) { AP.move = r.move; break; } if (apThinker.nodes() - n0 >= NODES_PER_TICK) break; }
      }
      if (AP.move !== null && AP.timer >= AP_THINK_STEPS[state.apThinkIdx]) {
        if (!AP.move) { state.scene = 'autoplay-over'; return; }
        AP.phase = 'reveal'; AP.timer = 0;
        const p = g.turn;
        AP.text = describeMove(g, AP.move, p === 0 ? 'Bottom seat' : 'Top seat'); say(AP.text, 9);
        const seen = new Set(), marks = [];
        for (const m of legalMoves(g)) if (!seen.has(m.r)) { seen.add(m.r); marks.push({ p, r: m.r, c: 'gold', a: 0.55 }); }
        marks.push({ p, r: AP.move.r, c: 'green' }); state.apMarks = marks;
      }
    } else if (AP.phase === 'reveal') {
      AP.timer += dt;
      if (AP.timer >= 2) { const mv = AP.move; AP.phase = 'act'; AP.timer = 0; AP.move = null; startMove(mv, false); }
    }
  }

  // ---- menus and pages ----------------------------------------------------------------------------------------------
  function updateTitle(tap) {
    if (!tap) return;
    const R = titleRows(!!state.saved, TEXT_SCALES[state.textScaleIdx]), hit = (r) => r && inRect(r, tap.x, tap.y);
    if (hit(R.resume)) resume();
    else if (hit(R.learn)) startLesson(0);
    else if (hit(R.play)) start(false);
    else if (hit(R.two)) start(true);
    else if (hit(R.autoplay)) startAutoPlay();
    else if (hit(R.howto)) { state.scene = 'howto'; state.page = 0; }
    else if (hit(R.rules)) { state.scene = 'rules'; state.page = 0; }
    else if (hit(R.about)) { state.scene = 'about'; state.page = 0; }
    else if (hit(R.settings)) state.scene = 'settings';
  }
  function updateSettings(tap) {
    if (!tap) return;
    const SET = setRows(TEXT_SCALES[state.textScaleIdx]);
    if (inRect(SET.level, tap.x, tap.y)) state.level = (state.level + 1) % LEVELS.length;
    else if (inRect(SET.sound, tap.x, tap.y)) { state.sound = !state.sound; audio.setMuted?.(!state.sound); }
    else if (inRect(SET.calm, tap.x, tap.y)) state.calm = !state.calm;
    else if (inRect(SET.text, tap.x, tap.y)) state.textScaleIdx = (state.textScaleIdx + 1) % TEXT_SCALES.length;
    else if (inRect(SET.seeds, tap.x, tap.y)) state.seeds = SEEDSETS[(SEEDSETS.indexOf(state.seeds) + 1) % SEEDSETS.length];
    else if (inRect(SET.wood, tap.x, tap.y)) state.wood = WOODS[(WOODS.indexOf(state.wood) + 1) % WOODS.length];
    else if (inRect(SET.think, tap.x, tap.y)) state.apThinkIdx = (state.apThinkIdx + 1) % AP_THINK_STEPS.length;
    else if (inRect(SET.back, tap.x, tap.y)) { state.scene = 'title'; savePrefs(); return; }
    else return;
    clack(); savePrefs();
  }
  function updatePage(tap) {
    if (!tap) return;
    const n = state.pageCount;
    if (inRect(BTN.textDec, tap.x, tap.y) && state.textScaleIdx > 0) { state.textScaleIdx--; state.page = 0; savePrefs(); clack(); }
    else if (inRect(BTN.textInc, tap.x, tap.y) && state.textScaleIdx < TEXT_SCALES.length - 1) { state.textScaleIdx++; state.page = 0; savePrefs(); clack(); }
    else if (inRect(BTN.pgBack, tap.x, tap.y)) { if (state.page > 0) state.page--; else state.scene = 'title'; }
    else if (inRect(BTN.pgNext, tap.x, tap.y)) { if (state.page >= n - 1) state.scene = 'title'; else state.page++; }
  }

  // Keyboard (web): arrows move along the glowing pits, Enter/Space plays, 1/2 or Left/Right answer a question, T think, U undo, Esc menu.
  function keyboard(input) {
    const k = input.keys.pressed, sc = state.scene;
    if (input.pointer.pressed) { state.kbPit = null; return null; }
    const at = (r) => ({ x: r.x + 5, y: r.y + 5 });
    if (sc === 'title') { const R = titleRows(!!state.saved, TEXT_SCALES[state.textScaleIdx]); if (k.has('Enter') || k.has('Space')) return at(R.resume || R.play); return null; }
    if (sc === 'over' || sc === 'autoplay-over') { if (k.has('Enter') || k.has('Space')) return at(BTN.again); if (k.has('Escape')) return at(BTN.back); return null; }
    if (sc === 'settings') { if (k.has('Escape')) return at(setRows(TEXT_SCALES[state.textScaleIdx]).back); return null; }
    if (DOCLEN[sc]) { if (k.has('Escape')) return at(BTN.pgBack); if (k.has('Enter') || k.has('Space') || k.has('ArrowRight')) return at(BTN.pgNext); if (k.has('ArrowLeft')) return at(BTN.pgBack); return null; }
    if (sc === 'autoplay') { if (k.has('Escape')) return at(BTN.apExit); if (k.has('Space') || k.has('KeyP')) return at(BTN.apPause); return null; }
    if (sc !== 'play' && sc !== 'lesson') return null;
    if (k.has('Escape')) return at(BTN.menu);
    if (state.prompt) { if (k.has('Digit1') || k.has('ArrowLeft')) return at(BTN.pick1); if (k.has('Digit2') || k.has('ArrowRight')) return at(BTN.pick2); return null; }
    if (sc === 'lesson' && state.lesson.done && (k.has('Enter') || k.has('Space'))) return at(BTN.next);
    if (k.has('KeyU')) return at(BTN.undo);
    if (k.has('KeyT') || k.has('KeyH')) return at(BTN.hint);
    if (!humanTurn()) return null;
    const list = state.legalMarks.filter((m) => m.c === 'gold').slice().sort((a, b) => { const A = pitPos(a.p, a.r), B = pitPos(b.p, b.r); return A.y - B.y || A.x - B.x; });
    if (!list.length) return null;
    const cur = state.kbPit ? list.findIndex((m) => m.r === state.kbPit.r) : -1;
    if (k.has('ArrowLeft') || k.has('ArrowUp')) { const m = list[(cur <= 0 ? list.length : cur) - 1]; state.kbPit = { p: m.p, r: m.r }; return null; }
    if (k.has('ArrowRight') || k.has('ArrowDown') || k.has('Tab')) { const m = list[(cur + 1) % list.length]; state.kbPit = { p: m.p, r: m.r }; return null; }
    if ((k.has('Enter') || k.has('Space')) && state.kbPit) { const q = pitPos(state.kbPit.p, state.kbPit.r); state.kbPit = null; return { x: q.x, y: q.y }; }
    return null;
  }

  return {
    update(dt, input) {
      state.t += dt;
      if (state.msg && !(state.scene === 'autoplay' && state.apPaused)) { state.msg.t += dt; if (state.msg.t > state.msg.hold) state.msg = null; }
      const p = input.pointer, kbd = keyboard(input);
      const tap = p.pressed ? { x: p.x, y: p.y } : kbd;
      const sc = state.scene;
      if (sc === 'title') updateTitle(tap);
      else if (sc === 'settings') updateSettings(tap);
      else if (DOCLEN[sc]) updatePage(tap);
      else if (sc === 'play') updatePlay(dt, tap);
      else if (sc === 'lesson') updateLesson(dt, tap);
      else if (sc === 'autoplay') updateAutoPlay(dt, tap);
      else if (sc === 'demo-limit') { if (tap && inRect(BTN.back, tap.x, tap.y)) state.scene = 'title'; }
      else if (sc === 'over' && tap) {
        if (inRect(BTN.again, tap.x, tap.y)) start(state.two);
        else if (inRect(BTN.back, tap.x, tap.y)) state.scene = 'title';
      } else if (sc === 'autoplay-over' && tap) {
        if (inRect(BTN.again, tap.x, tap.y)) startAutoPlay();
        else if (inRect(BTN.back, tap.x, tap.y)) state.scene = 'title';
      }
    },
    render(ctx) { render(ctx, state); },
    getState: () => state,
    // Everything except real play (menus, Rules/About/How to Play, settings, lessons, Watch & Learn, result screens) is free.
    isPreviewExempt: () => state.scene !== 'play',
  };
}
void H;

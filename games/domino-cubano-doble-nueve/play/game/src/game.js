// GAME CONTRACT (docs/GAME-CONTRACT.md). Dominó Cubano: Doble Nueve — see design/GDD.md.
import { SCREEN, inRect, BACK_BUTTON, PASS_BUTTON, HINT_BUTTON, UNDO_BUTTON, MEMORY_TOGGLE,
  rackTileRect, LINE_BOUNDS, difficultyCardRect, START_BUTTON, TITLE_PLAY_BUTTON,
  TITLE_HOWTO_BUTTON, TITLE_RULES_BUTTON, TITLE_AUTO_BUTTON, OVERLAY_CONTINUE_BUTTON,
  RULES_BACK_BUTTON, RULES_PREV_BUTTON, RULES_NEXT_BUTTON, TEXT_DEC, TEXT_INC, TEXT_SCALES,
  HOWTO_RULES_PANEL, AUTO_THINK_STEPS } from './layout.js';
import { dealHands, findOpener } from './tiles.js';
import { legalPlays, placeTile, scoreHand } from './rules.js';
import { createPassModel, recordPass, chooseAIPlay, DIFFICULTY } from './ai.js';
import { HOWTO_STEPS, DIFFICULTIES, RULES_PAGES } from './content.js';
import { render } from './view.js';

export const meta = { width: SCREEN.width, height: SCREEN.height };

const MATCH_TARGET = 100;
const DEMO_MATCH_LIMIT = 2;
const AI_THINK_MIN = 0.45;
const AI_THINK_MAX = 0.85;

export async function createGame(env) {
  const { rng, storage, audio, config } = env;

  const state = {
    scene: 'title',
    t: 0, sceneT: 0,
    howtoStep: 0, rulesPage: 0, howtoScroll: 0, rulesScroll: 0, scrollDrag: null,
    textScaleIdx: 0, autoThinkIdx: 1, autoPaused: false,
    difficulty: DIFFICULTY.CLUB,
    savedDifficulty: null,
    matchRecord: { wins: 0, losses: 0, dominoWins: 0, blockWins: 0, streak: 0, bestStreak: 0 },
    demo: Boolean(config?.demo),
    demoMatches: 0,
    demoLimitReached: false,

    matchScore: { A: 0, B: 0 },
    handsInMatch: 0,

    hands: [[], [], [], []],
    line: [],
    ends: null,
    turn: 0,
    openerSeat: 0,
    passStreak: 0,
    missing: null,
    aiThinkT: 0,
    dealT: 0,

    drag: null,
    hint: null,
    undoSnapshot: null,
    handResult: null,
    matchResult: null,
    showMemory: false,
    ptr: { x: 0, y: 0, down: false },
    // A short-lived status line shown in place of "first to 100" (view.js) — that row is fixed
    // and never has other content in it regardless of rack size or how long the line has grown,
    // so a message put there can never overlap anything else on screen.
    toastMsg: null, toastT: 0,
  };

  // Awaited before the game object is returned (boot.js awaits createGame) so the title screen
  // never renders or accepts a tap until these have actually resolved — a native storage bridge's
  // round-trip can take a moment, and a fire-and-forget read here let a fast first tap show stale
  // defaults (e.g. a demo player's real match count not applied before they could start playing).
  const [matchRecord, demoMatches, textScaleIdx, autoThinkIdx] = await Promise.all([
    storage.get('matchRecord', state.matchRecord),
    state.demo ? storage.get('demoMatches', 0) : Promise.resolve(0),
    storage.get('textScaleIdx', 0),
    storage.get('autoThinkIdx', 1),
  ]);
  if (matchRecord) state.matchRecord = matchRecord;
  if (state.demo) {
    state.demoMatches = demoMatches || 0;
    if (state.demoMatches >= DEMO_MATCH_LIMIT) state.demoLimitReached = true;
  }
  state.textScaleIdx = Math.min(Math.max(textScaleIdx ?? 0, 0), TEXT_SCALES.length - 1);
  state.autoThinkIdx = Math.min(Math.max(autoThinkIdx ?? 1, 0), AUTO_THINK_STEPS.length - 1);

  // Auto Play plays a full hand silently for anyone watching — no sound effects, matching every
  // other game's Auto Play in this portfolio ("no player to hear it for").
  function sfx(opts) { if (state.scene !== 'auto') audio.tone(opts); }
  // Normal AI opponents think for a quick, snappy random spread; Auto Play uses a slower,
  // configurable, watchable pace instead (the whole point is that a human can follow along).
  function nextThinkT() {
    return state.scene === 'auto' ? (AUTO_THINK_STEPS[state.autoThinkIdx] ?? 5) : rng.range(AI_THINK_MIN, AI_THINK_MAX);
  }

  // ------------------------------------------------------------------------------------- Hands
  function startHand() {
    const { hands } = dealHands(rng);
    const opener = findOpener(hands);
    state.hands = hands;
    state.line = [];
    state.ends = null;
    state.missing = createPassModel();
    state.passStreak = 0;
    state.handResult = null;
    state.undoSnapshot = null;
    state.hint = null;
    state.dealT = 0;
    state.openerSeat = opener.seat;

    const tile = hands[opener.seat].splice(opener.index, 1)[0];
    state.ends = placeTile(state.line, null, tile, 'left', opener.seat);
    state.turn = (opener.seat + 1) % 4;
    state.aiThinkT = nextThinkT(); // else the first AI turn is instant
    sfx({ freq: 200, dur: 0.09, type: 'triangle' });
  }

  function startMatch() {
    state.matchScore = { A: 0, B: 0 };
    state.handsInMatch = 0;
    state.matchResult = null;
    state.scene = 'playing';
    startHand();
  }

  // Auto Play ("Watch & Learn"): a full hand plays itself, every seat AI-controlled — including
  // seat 0, which is otherwise the player's own hand. Reuses the exact same turn/scoring machinery
  // as a real match (applyPlay/applyPass/endHand); only the scene flag and the AI-difficulty/pace
  // choices differ. Never touches matchRecord, demoMatches, or the preview-time clock (see
  // isPreviewExempt below) — a free, unlimited teaching/marketing demo, not real play.
  function startAutoMatch() {
    state.savedDifficulty = state.difficulty; // restored on exit — this is a demo, not a real pick
    state.matchScore = { A: 0, B: 0 };
    state.handsInMatch = 0;
    state.matchResult = null;
    state.difficulty = DIFFICULTY.TORNEO; // show off the smartest AI for the demo
    state.scene = 'auto';
    state.autoPaused = false;
    startHand();
  }

  function exitAutoMatch() {
    state.difficulty = state.savedDifficulty ?? DIFFICULTY.CLUB;
    state.scene = 'title';
  }

  function applyPlay(seat, index, side) {
    // Only an OPPONENT's play invalidates a pending undo — tryPlayerDrop sets the snapshot for
    // the player's own play immediately before calling this same function for seat 0, and this
    // used to unconditionally null it right back out again, so Undo could never actually do
    // anything. A pass doesn't touch the board, so it's deliberately left alone here too (an
    // opponent passing between the player's turns doesn't invalidate the player's own snapshot).
    if (seat !== 0) state.undoSnapshot = null;
    const tile = state.hands[seat].splice(index, 1)[0];
    state.ends = placeTile(state.line, state.ends, tile, side, seat);
    state.passStreak = 0;
    sfx({ freq: 190, dur: 0.08, type: 'triangle' });
    sfx({ freq: 260, dur: 0.06, type: 'triangle' });
    if (state.hands[seat].length === 0) { endHand(seat); return; }
    state.turn = (seat + 1) % 4;
  }

  function applyPass(seat) {
    recordPass(state.missing, seat, state.ends);
    state.passStreak += 1;
    sfx({ freq: 300, to: 180, dur: 0.16, type: 'sine', vol: 0.12 });
    if (state.passStreak >= 4) { endHand(null); return; }
    state.turn = (seat + 1) % 4;
  }

  function endHand(dominoSeat) {
    const result = scoreHand({ hands: state.hands, dominoSeat });
    state.handResult = result;
    if (result.winningTeam) {
      state.matchScore[result.winningTeam] += result.points;
      state.handsInMatch += 1;
      sfx(dominoSeat != null
        ? { freq: 520, to: 900, dur: 0.3, type: 'sine', vol: 0.16 }
        : { freq: 420, to: 620, dur: 0.22, type: 'sine', vol: 0.14 });
    }
  }

  // Tapping Continue on the hand-result overlay: either the match just ended (show the match
  // overlay next, same 'playing' scene — do NOT jump to lobby yet) or deal the next hand.
  function continueAfterHand() {
    const won = state.matchScore.A >= MATCH_TARGET || state.matchScore.B >= MATCH_TARGET;
    if (!won) { startHand(); return; }
    const winningTeam = state.matchScore.A >= MATCH_TARGET ? 'A' : 'B';
    state.matchResult = { winningTeam };
    const record = { ...state.matchRecord };
    if (winningTeam === 'A') {
      record.wins += 1; record.streak += 1; record.bestStreak = Math.max(record.bestStreak, record.streak);
    } else {
      record.losses += 1; record.streak = 0;
    }
    state.matchRecord = record;
    storage.set('matchRecord', record);
    audio.tone(winningTeam === 'A'
      ? { freq: 523, dur: 0.35, type: 'sine', vol: 0.18 }
      : { freq: 220, dur: 0.35, type: 'sawtooth', vol: 0.1 });
  }

  // Tapping Continue on the match-result overlay (only reachable after continueAfterHand set it).
  function continueAfterMatch() {
    state.matchResult = null;
    state.handResult = null;
    if (state.demo) {
      state.demoMatches += 1;
      storage.set('demoMatches', state.demoMatches);
      if (state.demoMatches >= DEMO_MATCH_LIMIT) { state.demoLimitReached = true; state.scene = 'demo-limit'; return; }
    }
    state.scene = 'lobby';
  }

  // A tap on Hint/Pass/Undo that can't actually do anything right now (not your turn, you still
  // have a legal play, nothing to undo) says so here instead of just silently doing nothing —
  // shown for a few seconds in place of "first to 100" (view.js), never anywhere that could
  // overlap the rack, the line, or anything else.
  function showToast(msg) {
    state.toastMsg = msg;
    state.toastT = 2.6;
  }

  // --------------------------------------------------------------------------------------- AI
  function runAITurn(dt) {
    state.aiThinkT -= dt;
    if (state.aiThinkT > 0) return;
    const seat = state.turn;
    const play = chooseAIPlay(seat, state.hands[seat], state.ends, state.missing, state.difficulty, rng);
    if (play) applyPlay(seat, play.index, play.side);
    else applyPass(seat);
    state.aiThinkT = nextThinkT();
  }

  // ------------------------------------------------------------------------------- Tap routing
  function handleTitle(x, y) {
    // Auto Play is checked before the demo-limit gate on purpose: it's a free, unlimited
    // teaching/marketing demo (see startAutoMatch), so someone who has used up their real demo
    // matches can still watch it — arguably the best moment to show it.
    if (inRect(x, y, TITLE_AUTO_BUTTON)) { startAutoMatch(); return; }
    if (state.demo && state.demoLimitReached) { state.scene = 'demo-limit'; return; }
    if (inRect(x, y, TITLE_PLAY_BUTTON)) {
      // Play always goes straight to the lobby — How to Play is its own button, never a forced
      // gate in front of Play. A first-time player who wants the tutorial taps that button
      // instead; nothing here should block someone who already knows dominoes.
      state.scene = 'lobby';
    } else if (inRect(x, y, TITLE_HOWTO_BUTTON)) { state.scene = 'howto'; state.howtoStep = 0; state.howtoScroll = 0; }
    else if (inRect(x, y, TITLE_RULES_BUTTON)) { state.scene = 'rules'; state.rulesPage = 0; state.rulesScroll = 0; }
  }

  function handleRules(x, y) {
    if (inRect(x, y, RULES_BACK_BUTTON)) { state.scene = 'title'; return; }
    if (inRect(x, y, TEXT_DEC) && state.textScaleIdx > 0) {
      state.textScaleIdx -= 1;
      state.rulesScroll = 0;
      storage.set('textScaleIdx', state.textScaleIdx);
      return;
    }
    if (inRect(x, y, TEXT_INC) && state.textScaleIdx < TEXT_SCALES.length - 1) {
      state.textScaleIdx += 1;
      state.rulesScroll = 0;
      storage.set('textScaleIdx', state.textScaleIdx);
      return;
    }
    if (inRect(x, y, RULES_PREV_BUTTON) && state.rulesPage > 0) { state.rulesPage -= 1; state.rulesScroll = 0; return; }
    if (inRect(x, y, RULES_NEXT_BUTTON) && state.rulesPage < RULES_PAGES.length - 1) { state.rulesPage += 1; state.rulesScroll = 0; return; }
    // Not a button — if the press landed on the panel itself, it's the start of a scroll drag
    // (only meaningful once the current page actually overflows; view.js clamps to 0 otherwise).
    if (inRect(x, y, HOWTO_RULES_PANEL)) state.scrollDrag = { startY: y, startScroll: state.rulesScroll };
  }

  // Same navigation model as Rules Reference: Back always returns to the title, Prev/Next step
  // through the pages, and the last page's Next becomes the actual way into the game.
  function handleHowto(x, y) {
    if (inRect(x, y, RULES_BACK_BUTTON)) { state.scene = 'title'; return; }
    if (inRect(x, y, TEXT_DEC) && state.textScaleIdx > 0) {
      state.textScaleIdx -= 1;
      state.howtoScroll = 0;
      storage.set('textScaleIdx', state.textScaleIdx);
      return;
    }
    if (inRect(x, y, TEXT_INC) && state.textScaleIdx < TEXT_SCALES.length - 1) {
      state.textScaleIdx += 1;
      state.howtoScroll = 0;
      storage.set('textScaleIdx', state.textScaleIdx);
      return;
    }
    if (inRect(x, y, RULES_PREV_BUTTON) && state.howtoStep > 0) { state.howtoStep -= 1; state.howtoScroll = 0; return; }
    if (inRect(x, y, RULES_NEXT_BUTTON)) {
      if (state.howtoStep < HOWTO_STEPS.length - 1) { state.howtoStep += 1; state.howtoScroll = 0; return; }
      state.scene = 'lobby';
      return;
    }
    if (inRect(x, y, HOWTO_RULES_PANEL)) state.scrollDrag = { startY: y, startScroll: state.howtoScroll };
  }

  function handleLobby(x, y) {
    for (let i = 0; i < DIFFICULTIES.length; i++) {
      if (inRect(x, y, difficultyCardRect(i))) { state.difficulty = i; return; }
    }
    if (inRect(x, y, START_BUTTON)) startMatch();
  }

  function tryPlayerDrop(x, y) {
    const drag = state.drag;
    state.drag = null;
    if (!drag) return;
    const hand = state.hands[0];
    const tile = hand[drag.index];
    if (!tile || !state.ends) return;
    const matchesLeft = tile.a === state.ends.left || tile.b === state.ends.left;
    const matchesRight = tile.a === state.ends.right || tile.b === state.ends.right;
    if (!matchesLeft && !matchesRight) return; // snaps back — not over a valid end
    let side;
    if (matchesLeft && matchesRight) side = x < SCREEN.width / 2 ? 'left' : 'right';
    else side = matchesLeft ? 'left' : 'right';
    state.undoSnapshot = {
      hands: state.hands.map((h) => h.slice()),
      line: state.line.map((t) => ({ ...t })),
      ends: { ...state.ends },
    };
    applyPlay(0, drag.index, side);
  }

  function handlePlayingDown(x, y) {
    if (state.matchResult) {
      if (inRect(x, y, OVERLAY_CONTINUE_BUTTON)) continueAfterMatch();
      return;
    }
    if (state.handResult) {
      if (inRect(x, y, OVERLAY_CONTINUE_BUTTON)) continueAfterHand();
      return;
    }
    if (inRect(x, y, BACK_BUTTON)) { state.scene = 'lobby'; return; }
    if (inRect(x, y, MEMORY_TOGGLE)) { state.showMemory = !state.showMemory; return; }
    // Every one of Hint/Pass/Undo is checked here regardless of whether it's currently usable,
    // and each says why when it isn't, rather than the tap just silently doing nothing — that
    // silence was read as the button being broken, not as "not applicable right now."
    if (inRect(x, y, UNDO_BUTTON)) {
      if (state.undoSnapshot) {
        state.hands = state.undoSnapshot.hands;
        state.line = state.undoSnapshot.line;
        state.ends = state.undoSnapshot.ends;
        state.turn = 0;
        state.undoSnapshot = null;
      } else {
        showToast('Nothing to undo yet.');
      }
      return;
    }
    if (inRect(x, y, PASS_BUTTON)) {
      if (state.turn !== 0) { showToast('Wait for your turn to pass.'); return; }
      if (legalPlays(state.hands[0], state.ends).length === 0) applyPass(0);
      else showToast("You still have a legal play — Pass isn't available.");
      return;
    }
    if (inRect(x, y, HINT_BUTTON)) {
      if (state.turn !== 0) { showToast('Wait for your turn to get a hint.'); return; }
      const play = chooseAIPlay(0, state.hands[0], state.ends, state.missing, DIFFICULTY.TORNEO, rng);
      // The gold ring alone read as nothing happening (subtle against the tile, and the button
      // itself gives no other feedback on tap) — spelling out the rule it satisfies here doubles
      // as visible proof the tap did something, not just a decoration on top of the ring.
      if (play) {
        state.hint = { index: play.index, side: play.side };
        const tile = state.hands[0][play.index];
        const openEnd = play.side === 'left' ? state.ends.left : state.ends.right;
        showToast(`Play ${tile.a}-${tile.b} (${play.side}) — matches the ${openEnd} on that end.`);
      } else {
        state.hint = null;
        showToast('No legal play in your hand — tap Pass instead.');
      }
      return;
    }
    if (state.turn !== 0) return;
    const hand = state.hands[0];
    for (let i = 0; i < hand.length; i++) {
      const r = rackTileRect(i, hand.length);
      if (inRect(x, y, r)) { state.drag = { index: i, x, y }; state.hint = null; return; }
    }
  }

  function handleDemoLimit() { /* deliberately a no-op — the web preview stays capped */ }

  // Auto Play's own tap routing: no rack to tap (every seat, including 0, is AI-controlled), no
  // Pass/Hint/Undo — Hint/Undo's rects become the think-time -/+ stepper instead.
  function handleAutoDown(x, y) {
    if (state.handResult) {
      if (inRect(x, y, OVERLAY_CONTINUE_BUTTON)) exitAutoMatch();
      return;
    }
    if (inRect(x, y, BACK_BUTTON)) { exitAutoMatch(); return; }
    if (inRect(x, y, MEMORY_TOGGLE)) { state.showMemory = !state.showMemory; return; }
    // The pace stepper's own middle button doubles as Pause/Resume — a player watching to learn
    // the partner-inference reasoning needs to be able to just stop and look at the table.
    if (inRect(x, y, PASS_BUTTON)) { state.autoPaused = !state.autoPaused; return; }
    if (inRect(x, y, HINT_BUTTON) && state.autoThinkIdx > 0) {
      state.autoThinkIdx -= 1;
      storage.set('autoThinkIdx', state.autoThinkIdx);
      return;
    }
    if (inRect(x, y, UNDO_BUTTON) && state.autoThinkIdx < AUTO_THINK_STEPS.length - 1) {
      state.autoThinkIdx += 1;
      storage.set('autoThinkIdx', state.autoThinkIdx);
    }
  }

  return {
    update(dt, input) {
      const before = state.scene;
      state.t += dt;
      state.sceneT += dt;
      state.dealT = Math.min(1, state.dealT + dt * 2.2);
      if (state.toastT > 0) state.toastT = Math.max(0, state.toastT - dt);
      state.ptr = { x: input.pointer.x, y: input.pointer.y, down: Boolean(input.pointer.down) };

      // Auto Play drives every seat, including 0 — the turn !== 0 guard only applies to a real
      // match, where seat 0 waits for the player's own tap/drag instead. Pausing just stops this
      // (aiThinkT holds wherever it was), leaving the table exactly as it is to study.
      const autoRunning = state.scene === 'auto' && !state.autoPaused;
      const aiTurn = autoRunning || (state.scene === 'playing' && state.turn !== 0);
      if (aiTurn && !state.handResult) runAITurn(dt);

      if (state.drag) {
        state.drag.x = input.pointer.x;
        state.drag.y = input.pointer.y;
      }

      // Drag-to-scroll for an overflowing How to Play / Rules Reference page: only the raw,
      // never-negative accumulator lives here — view.js clamps it against the real measured
      // overflow every frame (it has the text metrics; this file deliberately doesn't), so a
      // drag that overshoots the bottom just stops moving the page rather than going out of sync.
      if (state.scrollDrag) {
        const raw = state.scrollDrag.startScroll + (state.scrollDrag.startY - input.pointer.y);
        if (state.scene === 'howto') state.howtoScroll = Math.max(0, raw);
        else if (state.scene === 'rules') state.rulesScroll = Math.max(0, raw);
        if (input.pointer.released) state.scrollDrag = null;
      }

      if (input.pointer.pressed) {
        if (state.scene === 'title') handleTitle(input.pointer.x, input.pointer.y);
        else if (state.scene === 'howto') handleHowto(input.pointer.x, input.pointer.y);
        else if (state.scene === 'rules') handleRules(input.pointer.x, input.pointer.y);
        else if (state.scene === 'lobby') handleLobby(input.pointer.x, input.pointer.y);
        else if (state.scene === 'playing') handlePlayingDown(input.pointer.x, input.pointer.y);
        else if (state.scene === 'auto') handleAutoDown(input.pointer.x, input.pointer.y);
        else if (state.scene === 'demo-limit') handleDemoLimit();
      }
      if (input.pointer.released && state.drag) tryPlayerDrop(input.pointer.x, input.pointer.y);

      if (state.scene !== before) state.sceneT = 0;
    },

    render(ctx) {
      render(ctx, state, env.manifest, { HOWTO_STEPS, DIFFICULTIES, RULES_PAGES });
    },

    // Must be JSON-serializable and fully describe the run (used for determinism checks).
    getState: () => ({
      ...state,
      missing: state.missing ? state.missing.map((s) => Array.from(s)) : null,
    }),

    // Auto Play never counts against the purchase preview-time clock or the demo-match limit —
    // it's a free, unlimited teaching/marketing demo, same as every other game's Auto Play. Kit's
    // preview gate checks this once per update() tick (kit/preview.js).
    isPreviewExempt: () => !(state.scene === 'playing' && !state.handResult && !state.matchResult),
  };
}

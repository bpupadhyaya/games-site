// GAME CONTRACT (docs/GAME-CONTRACT.md) — every game exports exactly these two things:
//   meta                      virtual resolution the game draws in
//   createGame(env) -> { update(dt, input), render(ctx, view), getState() }
// Rules: no DOM/window access in web/src, no Math.random / Date.now (use env.rng and dt).
//
// WORD GAME: a target word is shown at the top; three candidate words drift freely (own speed,
// own vertical bounce within a band) across the screen from right to left. The player taps the
// one that correctly matches the target (synonym or antonym, chosen before the session and
// locked for its whole 90 seconds). See design/GDD.md for the full design.
import { WORDS } from './words.js';
import { SCHEMES } from './schemes.js';
import { RULES } from './content.js';
import { render } from './render.js';
import {
  W, H, BAND_TOP, SLICE_H, SLICE_MARGIN, CHIP_H, slipWidth, inRect, REVIEW_PER_PAGE,
  MODE_SYN_BTN, MODE_ANT_BTN, PLAY_BTN, TITLE_COLOR_BTN, TITLE_RULES_BTN, STOP_BTN, COLOR_BTN,
  PREV_BTN, NEXT_BTN, PLAY_AGAIN_BTN, CHANGE_MODE_BTN, RULES_BACK_BTN, RULES_NEXT_BTN,
} from './layout.js';

export const meta = { width: W, height: H };

const SESSION_SECONDS = 90;
// Web preview (env.config.demo) is a taste of the full iOS/Android game: only a couple of full
// sessions are playable there. See docs/GAME-CONTRACT.md's "Web preview" section.
const DEMO_SESSION_LIMIT = 2;
const RECENT_WORDS_MAX = 6;

const SPEED_BASE = 140;
const SPEED_PER_POINT = 18;
const SPEED_CAP_BONUS = 260;
const SPEED_JITTER = 40;

const KEY_CODES = ['Digit1', 'Digit2', 'Digit3'];

export function createGame(env) {
  const { rng, storage, monetization, audio, config } = env;
  const demo = Boolean(config?.demo);

  const state = {
    scene: 'title',
    selectedMode: 'synonym', // pending choice on the title screen
    mode: 'synonym', // locked for the whole session once Play is tapped
    score: 0,
    bestSynonym: 0,
    bestAntonym: 0,
    newBest: false,
    timeLeft: SESSION_SECONDS,
    sessionsCompleted: 0,
    history: [], // this session's answers: { word, mode, answer, picked (null = drifted past), correct }
    reviewPage: 0,
    rulesPage: 0,
    scheme: 0,
    demo,
    demoSessions: 0,
    demoLimitReached: false,
    // Presentation clocks, all advanced by the fixed step (never the wall clock):
    t: 0, // seconds since boot: idle motion
    sceneT: 1, // seconds since the scene changed: entrance easing (starts settled on first frame)
    press: null, // { id, t } last button pressed: springy press feedback
    fx: null, // { kind: 'right' | 'wrong' | 'miss', x, y, w, text, t } feedback for the last answer
    round: null, // { targetWord, mode, words: [{ text, correct, slot, w, x, y, vy, speed }] }
  };

  let recentWords = [];
  const setScene = (scene) => {
    state.scene = scene;
    state.sceneT = 0;
    state.fx = null;
  };
  const pressed = (id) => (state.press = { id, t: 0 });

  storage.get('scheme', 0).then((v) => (state.scheme = SCHEMES[v] ? v : 0));
  const cycleScheme = () => {
    state.scheme = (state.scheme + 1) % SCHEMES.length;
    storage.set('scheme', state.scheme);
  };
  storage.get('bestSynonym', 0).then((v) => (state.bestSynonym = v));
  storage.get('bestAntonym', 0).then((v) => (state.bestAntonym = v));
  if (demo) {
    storage.get('demoSessions', 0).then((v) => {
      state.demoSessions = v;
      if (v >= DEMO_SESSION_LIMIT) state.demoLimitReached = true;
    });
  }
  // Words without an antonym only appear in Synonym mode.
  // The web preview (config.demo) leaves out words flagged mobile-only ('m'), so the apps can carry more.
  const bank = demo ? WORDS.filter((e) => e[6] !== 'm') : WORDS;
  const activePack = () => (state.mode === 'synonym' ? bank : bank.filter((e) => e[2] !== null));

  const pickEntry = () => {
    const pack = activePack();
    let entry;
    let guard = 0;
    do {
      entry = pack[rng.int(pack.length)];
      guard += 1;
    } while (recentWords.includes(entry[0]) && recentWords.length < pack.length && guard < 50);
    recentWords.push(entry[0]);
    if (recentWords.length > RECENT_WORDS_MAX) recentWords.shift();
    return entry;
  };

  const spawnRound = () => {
    const [word, synonym, antonym, d1, d2, meaning] = pickEntry();
    const correctText = state.mode === 'synonym' ? synonym : antonym;
    const options = rng.shuffle([
      { text: correctText, correct: true },
      { text: d1, correct: false },
      { text: d2, correct: false },
    ]);
    const speed = SPEED_BASE + Math.min(SPEED_CAP_BONUS, state.score * SPEED_PER_POINT);
    state.round = {
      targetWord: word,
      age: 0,
      meaning,
      mode: state.mode,
      words: options.map((o, slot) => {
        const sliceTop = BAND_TOP + slot * SLICE_H + SLICE_MARGIN;
        const sliceBottom = BAND_TOP + (slot + 1) * SLICE_H - SLICE_MARGIN;
        return {
          text: o.text,
          correct: o.correct,
          slot,
          w: slipWidth(o.text),
          x: meta.width + 20 + rng.range(0, 140),
          y: rng.range(sliceTop, sliceBottom),
          vy: rng.range(-30, 30),
          sliceTop,
          sliceBottom,
          speed: speed + rng.range(0, SPEED_JITTER),
        };
      }),
    };
  };

  const startSession = () => {
    if (demo) {
      if (state.demoLimitReached) {
        setScene('demo-limit');
        return;
      }
      state.demoSessions += 1;
      storage.set('demoSessions', state.demoSessions);
      if (state.demoSessions >= DEMO_SESSION_LIMIT) state.demoLimitReached = true;
    }
    state.mode = state.selectedMode;
    state.history = [];
    state.reviewPage = 0;
    state.score = 0;
    state.timeLeft = SESSION_SECONDS;
    state.newBest = false;
    recentWords = [];
    setScene('playing');
    spawnRound();
  };

  const bestKey = () => (state.mode === 'synonym' ? 'bestSynonym' : 'bestAntonym');

  const endSession = () => {
    setScene('gameover');
    state.round = null;
    state.reviewPage = 0;
    const key = bestKey();
    if (state.score > state[key]) {
      state[key] = state.score;
      state.newBest = true;
      storage.set(key, state.score);
    }
    state.sessionsCompleted += 1;
    monetization.track('session_end', { mode: state.mode, score: state.score });
    // Brief descending tone marks the session ending (design/GDD.md > Art and audio). A single
    // glide (not two separately-scheduled notes) since env.audio.tone() has no delay parameter
    // and web/src cannot use setTimeout (see docs/GAME-CONTRACT.md's determinism rule).
    audio.tone({ freq: 560, to: 300, dur: 0.32, type: 'sine', vol: 0.22 });
  };

  const resolveRound = (picked) => {
    const round = state.round;
    const shown = round.words.find((w) => w.text === picked) ?? round.words.find((w) => w.correct);
    const answer = round.words.find((w) => w.correct).text;
    const hit = picked !== null && picked === answer;
    state.history.push({ word: round.targetWord, meaning: round.meaning, mode: round.mode, answer, picked, correct: hit });
    state.fx = {
      kind: hit ? 'right' : picked === null ? 'miss' : 'wrong',
      x: picked === null ? 0 : Math.max(shown.w / 2 + 12, Math.min(W - shown.w / 2 - 12, shown.x)),
      y: shown.y,
      w: shown.w,
      text: shown.text,
      t: 0,
    };
    if (hit) {
      state.score += 1;
      audio.tone({ freq: 620, to: 900, dur: 0.1, type: 'triangle', vol: 0.22 });
    } else {
      audio.tone({ freq: 220, to: 140, dur: 0.16, type: 'sawtooth', vol: 0.18 });
    }
    spawnRound();
  };

  const updateTitle = (input) => {
    if (!input.pointer.pressed) return;
    const { x, y } = input.pointer;
    if (inRect(x, y, MODE_SYN_BTN)) {
      state.selectedMode = 'synonym';
      pressed('syn');
    } else if (inRect(x, y, MODE_ANT_BTN)) {
      state.selectedMode = 'antonym';
      pressed('ant');
    } else if (inRect(x, y, PLAY_BTN)) startSession();
    else if (inRect(x, y, TITLE_COLOR_BTN)) {
      cycleScheme();
      pressed('colour');
    } else if (inRect(x, y, TITLE_RULES_BTN)) {
      state.rulesPage = 0;
      setScene('rules');
      pressed('rules');
    }
  };

  const updateRules = (input) => {
    if (!input.pointer.pressed) return;
    const { x, y } = input.pointer;
    if (inRect(x, y, RULES_BACK_BTN)) {
      setScene('title');
    } else if (inRect(x, y, RULES_NEXT_BTN)) {
      state.rulesPage = (state.rulesPage + 1) % RULES.length;
      pressed('rulesNext');
    }
  };

  const updatePlaying = (dt, input) => {
    state.timeLeft -= dt;
    if (state.timeLeft <= 0) {
      state.timeLeft = 0;
      endSession();
      return;
    }
    const round = state.round;
    if (!round) return;
    round.age += dt;
    for (const w of round.words) {
      w.x -= w.speed * dt;
      w.y += w.vy * dt;
      if (w.y < w.sliceTop || w.y > w.sliceBottom) {
        w.vy *= -1;
        w.y = Math.min(w.sliceBottom, Math.max(w.sliceTop, w.y));
      }
    }

    // Resolve at most one action per tick against this same `round` reference — resolveRound()
    // spawns a fresh round synchronously, so re-using a stale reference after that would let a
    // second input in the same tick (e.g. a key alongside a tap) score twice on words that no
    // longer exist.
    if (input.pointer.pressed) {
      if (inRect(input.pointer.x, input.pointer.y, COLOR_BTN)) {
        cycleScheme();
        pressed('colour');
        return;
      }
      if (inRect(input.pointer.x, input.pointer.y, STOP_BTN)) {
        endSession();
        return;
      }
      const hit = round.words.find((w) => input.pointer.x >= w.x - w.w / 2 && input.pointer.x <= w.x + w.w / 2 && input.pointer.y >= w.y - CHIP_H / 2 && input.pointer.y <= w.y + CHIP_H / 2);
      if (hit) {
        resolveRound(hit.text);
        return;
      }
    }
    for (const code of KEY_CODES) {
      if (input.keys.pressed.has(code)) {
        const slot = KEY_CODES.indexOf(code);
        const w = round.words.find((rw) => rw.slot === slot);
        if (w) {
          resolveRound(w.text);
          return;
        }
      }
    }

    const correctWord = round.words.find((w) => w.correct);
    if (correctWord && correctWord.x + correctWord.w / 2 < 0) resolveRound(null);
  };

  const reviewRows = () => {
    const wrong = state.history.filter((h) => !h.correct);
    return wrong.concat(state.history.filter((h) => h.correct));
  };
  const reviewPages = () => Math.max(1, Math.ceil(state.history.length / REVIEW_PER_PAGE));

  const updateGameover = (input) => {
    if (!input.pointer.pressed) return;
    const { x, y } = input.pointer;
    if (inRect(x, y, PLAY_AGAIN_BTN)) startSession();
    else if (inRect(x, y, CHANGE_MODE_BTN)) setScene('title');
    else if (inRect(x, y, PREV_BTN)) {
      state.reviewPage = Math.max(0, state.reviewPage - 1);
      pressed('prev');
    } else if (inRect(x, y, NEXT_BTN)) {
      state.reviewPage = Math.min(reviewPages() - 1, state.reviewPage + 1);
      pressed('next');
    }
  };

  return {
    update(dt, input) {
      state.t += dt;
      state.sceneT += dt;
      if (state.press && (state.press.t += dt) > 0.6) state.press = null;
      if (state.fx && (state.fx.t += dt) > 0.8) state.fx = null;
      if (state.scene === 'title') updateTitle(input);
      else if (state.scene === 'playing') updatePlaying(dt, input);
      else if (state.scene === 'gameover') updateGameover(input);
      else if (state.scene === 'rules') updateRules(input);
      // 'demo-limit': input is a deliberate no-op — see design/GDD.md "Demo cut".
    },

    render(ctx) {
      render(ctx, state, env.manifest.title, DEMO_SESSION_LIMIT);
    },

    getState() {
      return state;
    },
  };
}

